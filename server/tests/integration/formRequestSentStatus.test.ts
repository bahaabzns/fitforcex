import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

/**
 * Bug fix — a client's check-in (or any manually-scheduled form) went
 * invisible the moment the generic scheduleFormDispatcher cron (scheduler.ts)
 * ticked its due 'pending' request over to 'sent'. That cron matches on
 * status='pending' + a past scheduled_at + a null action_taken_at without
 * regard for which subsystem put the row into 'pending' — including a
 * check-in schedule's dispatch, which leaves scheduled_at populated with the
 * original due date. 'sent' was never meant to be a distinct client-facing
 * state (the coach's Plans Queue already treats it as "awaiting", the same
 * bucket as 'pending' — see getQueue in forms.controller.ts), but every
 * client-facing surface only recognized 'pending' literally, so the request
 * dropped out of the client's list, and even direct access rendered it as
 * already-submitted and refused to accept an answer.
 *
 * These tests simulate exactly what that cron does — flip an already-pending
 * request to 'sent', keeping scheduled_at/action_taken_at populated — then
 * assert the client-facing surfaces still treat it as awaiting their answer.
 */
describe('form_requests in \'sent\' status remain visible and fillable to the client', () => {
    let workspaceId: string;
    let ownerCookie: string;
    let clientId: string;
    let clientCookie: string;
    let formId: string;
    let questionId: string;
    let requestId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');

        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Sent', lname: 'Status', email: `sent-status-${createId()}@test.com`,
                workspace_id: workspaceId,
            },
        });
        clientId = client.id;
        clientCookie = makeClientCookie(clientId, workspaceId);

        const formRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Cycle-End Check-in', formType: 'check-in' });
        formId = formRes.body.id;
        const qRes = await request.post(`/api/forms/${formId}/questions`).set('Cookie', ownerCookie)
            .send({ label_en: 'How did this cycle go?', type: 'text' });
        questionId = qRes.body.id;

        const assignRes = await request.post('/api/forms/requests').set('Cookie', ownerCookie)
            .send({ form_ids: [formId], client_id: clientId, mode: 'now' });
        requestId = assignRes.body[0].id;
        expect((await testPrisma.form_requests.findUnique({ where: { id: requestId } }))!.status).toBe('pending');

        // Simulate scheduleFormDispatcher's tick: a due 'pending' request with
        // a past scheduled_at and a null action_taken_at gets stamped 'sent'.
        await testPrisma.form_requests.update({
            where: { id: requestId },
            data:  { status: 'sent', scheduled_at: new Date(Date.now() - 60 * 60 * 1000), action_taken_at: new Date() },
        });
    });

    test('still appears in the client\'s form-requests list', async () => {
        const res = await request.get('/api/client-portal/form-requests').set('Cookie', clientCookie);
        expect(res.status).toBe(200);
        expect(res.body.find((r: { id: string }) => r.id === requestId)).toBeDefined();
    });

    test('still appears as a pending action item on the home page', async () => {
        const res = await request.get('/api/client-portal/action-items').set('Cookie', clientCookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({ id: requestId, kind: 'pending_form' });
    });

    test('the client can still submit an answer', async () => {
        const res = await request.post(`/api/client-portal/form-requests/${requestId}/submit`)
            .set('Cookie', clientCookie)
            .send({ answers: [{ question_id: questionId, answer: 'Went well!' }] });
        expect(res.status).toBe(200);
        expect((await testPrisma.form_requests.findUnique({ where: { id: requestId } }))!.status).toBe('submitted');
    });

    test('the coach can still cancel it, same as a pending request', async () => {
        const res = await request.delete(`/api/forms/requests/${requestId}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        expect(await testPrisma.form_requests.findUnique({ where: { id: requestId } })).toBeNull();
    });
});
