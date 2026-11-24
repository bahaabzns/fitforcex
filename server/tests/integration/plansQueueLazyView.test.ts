import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

// The Plans Queue main view asks for ?view=need-action&answers=lazy so a big workspace doesn't download every
// reviewed row and every answer on page open. These cover the opt-in query params, the one-request answers
// endpoint, and that the default (no params) response is unchanged for existing callers.

async function createClient(workspaceId: string) {
    return testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Sara',
            lname:        'Client',
            email:        `client-${createId()}@test.com`,
            workspace_id: workspaceId,
        },
    });
}

async function createForm(workspaceId: string) {
    return testPrisma.forms.create({
        data: { id: createId(), workspace_id: workspaceId, title_en: 'Weekly Check-in' },
    });
}

async function createRequest(workspaceId: string, formId: string, clientId: string, status: string) {
    return testPrisma.form_requests.create({
        data: {
            id:           createId(),
            workspace_id: workspaceId,
            form_id:      formId,
            client_id:    clientId,
            status,
            submitted_at: status === 'submitted' || status === 'reviewed' ? new Date() : null,
        },
    });
}

async function addAnswers(requestId: string, count: number) {
    for (let index = 0; index < count; index++) {
        await testPrisma.form_responses.create({
            data: { id: createId(), request_id: requestId, question_id: null, answer: `answer ${index}` },
        });
    }
}

type QueueRow = { id: string; status: string; responses: unknown[]; responseCount: number };

describe('Plans Queue — need-action view, lazy answers and per-row answers', () => {
    let workspaceId: string;
    let ownerCookie: string;
    let clientId: string;
    let formId: string;
    let submittedId: string;
    let reviewedId: string;
    let pendingId: string;
    let scheduledId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
        clientId = (await createClient(workspaceId)).id;
        formId = (await createForm(workspaceId)).id;

        submittedId = (await createRequest(workspaceId, formId, clientId, 'submitted')).id;
        reviewedId = (await createRequest(workspaceId, formId, clientId, 'reviewed')).id;
        pendingId = (await createRequest(workspaceId, formId, clientId, 'pending')).id;
        scheduledId = (await createRequest(workspaceId, formId, clientId, 'scheduled')).id;
        await addAnswers(submittedId, 3);
        await addAnswers(reviewedId, 2);
    });

    const getQueue = (query = '', cookie = ownerCookie) => request.get(`/api/forms/queue${query}`).set('Cookie', cookie);
    const idsOf = (body: QueueRow[]) => body.map((row) => row.id).sort();

    describe('?view=need-action', () => {
        test('returns only the rows still needing action', async () => {
            const res = await getQueue('?view=need-action');

            expect(res.status).toBe(200);
            expect(idsOf(res.body)).toEqual([submittedId]);
            expect(res.body[0].status).toBe('need-action');
        });

        test('the default view still returns every active row', async () => {
            const res = await getQueue();

            expect(idsOf(res.body)).toEqual([submittedId, reviewedId, pendingId, scheduledId].sort());
        });

        test('includeId also returns the row the coach just finished, and only that one', async () => {
            const res = await getQueue(`?view=need-action&includeId=${reviewedId}`);

            expect(idsOf(res.body)).toEqual([submittedId, reviewedId].sort());
            expect(res.body.find((row: QueueRow) => row.id === reviewedId).status).toBe('action-done');
        });

        test('includeId cannot pull in a row from another workspace', async () => {
            const other = await createTestUser();
            const otherWs = await createTestWorkspace(other.id);
            const otherClient = await createClient(otherWs.id);
            const otherForm = await createForm(otherWs.id);
            const foreign = await createRequest(otherWs.id, otherForm.id, otherClient.id, 'reviewed');

            const res = await getQueue(`?view=need-action&includeId=${foreign.id}`);

            expect(res.status).toBe(200);
            expect(idsOf(res.body)).toEqual([submittedId]);
        });

        test('archived rows stay out of the need-action view', async () => {
            await testPrisma.form_requests.update({ where: { id: submittedId }, data: { archived_at: new Date() } });

            const res = await getQueue('?view=need-action');

            expect(res.body).toEqual([]);
        });

        test('treats a request id that is not a string as no includeId', async () => {
            const res = await getQueue('?view=need-action&includeId[]=x&includeId[]=y');

            expect(res.status).toBe(200);
            expect(idsOf(res.body)).toEqual([submittedId]);
        });
    });

    describe('?answers=lazy', () => {
        test('rows carry the answer count but not the answers', async () => {
            const res = await getQueue('?answers=lazy');

            const byId = new Map<string, QueueRow>(res.body.map((row: QueueRow) => [row.id, row]));
            expect(byId.get(submittedId)!.responseCount).toBe(3);
            expect(byId.get(submittedId)!.responses).toEqual([]);
            expect(byId.get(reviewedId)!.responseCount).toBe(2);
            expect(byId.get(pendingId)!.responseCount).toBe(0);
        });

        test('the default response still carries the answers, plus their count', async () => {
            const res = await getQueue();

            const submitted = res.body.find((row: QueueRow) => row.id === submittedId);
            expect(submitted.responses).toHaveLength(3);
            expect(submitted.responseCount).toBe(3);
        });
    });

    describe('GET /forms/queue/:requestId/responses', () => {
        test('returns that request\'s answers', async () => {
            const res = await request.get(`/api/forms/queue/${submittedId}/responses`).set('Cookie', ownerCookie);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(3);
            expect(res.body.map((response: { answer: string }) => response.answer).sort()).toEqual(['answer 0', 'answer 1', 'answer 2']);
        });

        test('returns an empty list for a request with no answers yet', async () => {
            const res = await request.get(`/api/forms/queue/${pendingId}/responses`).set('Cookie', ownerCookie);

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        test('returns 404 for a request id that does not exist', async () => {
            const res = await request.get(`/api/forms/queue/${createId()}/responses`).set('Cookie', ownerCookie);

            expect(res.status).toBe(404);
        });

        test('returns 404 for another workspace\'s request, never its answers', async () => {
            const other = await createTestUser();
            const otherWs = await createTestWorkspace(other.id);
            const otherCookie = await makeAuthCookie(other.id, otherWs.id, 'owner');

            const res = await request.get(`/api/forms/queue/${submittedId}/responses`).set('Cookie', otherCookie);

            expect(res.status).toBe(404);
            expect(JSON.stringify(res.body)).not.toContain('answer 0');
        });

        test('returns 401 without a login', async () => {
            const res = await request.get(`/api/forms/queue/${submittedId}/responses`);

            expect(res.status).toBe(401);
        });

        test('does not shadow the fixed queue routes', async () => {
            const labels = await request.get('/api/forms/queue/labels').set('Cookie', ownerCookie);
            const autoAssign = await request.get('/api/forms/queue/auto-assign').set('Cookie', ownerCookie);

            expect(Array.isArray(labels.body)).toBe(true);
            expect(autoAssign.body).toHaveProperty('totalRules');
        });
    });
});
