import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

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

describe('Form submission archiving — Plans Queue API', () => {
    let workspaceId: string;
    let ownerId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        ownerId = user.id;
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('archives a submitted request and hides it from the active queue', async () => {
        const client = await createClient(workspaceId);
        const form = await createForm(workspaceId);
        const req = await createRequest(workspaceId, form.id, client.id, 'submitted');

        const res = await request.patch('/api/forms/queue/archive').set('Cookie', ownerCookie)
            .send({ ids: [req.id], action: 'archive' });
        expect(res.status).toBe(200);
        expect(res.body.updatedIds).toContain(req.id);

        const row = await testPrisma.form_requests.findUnique({ where: { id: req.id } });
        expect(row!.archived_at).not.toBeNull();
        expect(row!.archived_by).toBe(ownerId);

        const activeQueue = await request.get('/api/forms/queue').set('Cookie', ownerCookie);
        expect(activeQueue.body.find((r: { id: string }) => r.id === req.id)).toBeUndefined();

        const archivedQueue = await request.get('/api/forms/queue?archived=true').set('Cookie', ownerCookie);
        const archivedItem = archivedQueue.body.find((r: { id: string }) => r.id === req.id);
        expect(archivedItem).toBeDefined();
        expect(archivedItem.isArchived).toBe(true);
    });

    test('restores an archived request back into the active queue', async () => {
        const client = await createClient(workspaceId);
        const form = await createForm(workspaceId);
        const req = await createRequest(workspaceId, form.id, client.id, 'reviewed');
        await testPrisma.form_requests.update({
            where: { id: req.id },
            data:  { archived_at: new Date(), archived_by: ownerId },
        });

        const res = await request.patch('/api/forms/queue/archive').set('Cookie', ownerCookie)
            .send({ ids: [req.id], action: 'restore' });
        expect(res.status).toBe(200);

        const row = await testPrisma.form_requests.findUnique({ where: { id: req.id } });
        expect(row!.archived_at).toBeNull();
        expect(row!.archived_by).toBeNull();

        const activeQueue = await request.get('/api/forms/queue').set('Cookie', ownerCookie);
        expect(activeQueue.body.find((r: { id: string }) => r.id === req.id)).toBeDefined();
    });

    test('pending requests are not archivable — only submitted/reviewed', async () => {
        const client = await createClient(workspaceId);
        const form = await createForm(workspaceId);
        const req = await createRequest(workspaceId, form.id, client.id, 'pending');

        const res = await request.patch('/api/forms/queue/archive').set('Cookie', ownerCookie)
            .send({ ids: [req.id], action: 'archive' });
        expect(res.status).toBe(200);

        const row = await testPrisma.form_requests.findUnique({ where: { id: req.id } });
        expect(row!.archived_at).toBeNull(); // untouched — still awaiting the client
    });

    test('missing ids array returns 400', async () => {
        const res = await request.patch('/api/forms/queue/archive').set('Cookie', ownerCookie)
            .send({ action: 'archive' });
        expect(res.status).toBe(400);
    });

    test('no auth cookie is rejected with 401', async () => {
        const client = await createClient(workspaceId);
        const form = await createForm(workspaceId);
        const req = await createRequest(workspaceId, form.id, client.id, 'submitted');

        const res = await request.patch('/api/forms/queue/archive')
            .send({ ids: [req.id], action: 'archive' });
        expect(res.status).toBe(401);
    });

    test('tenant isolation: cannot archive a request belonging to another workspace', async () => {
        const otherUser = await createTestUser();
        const otherWs = await createTestWorkspace(otherUser.id);
        const otherClient = await createClient(otherWs.id);
        const otherForm = await createForm(otherWs.id);
        const foreignReq = await createRequest(otherWs.id, otherForm.id, otherClient.id, 'submitted');

        const res = await request.patch('/api/forms/queue/archive').set('Cookie', ownerCookie)
            .send({ ids: [foreignReq.id], action: 'archive' });
        expect(res.status).toBe(200); // silently no-ops on ids outside the caller's workspace

        const row = await testPrisma.form_requests.findUnique({ where: { id: foreignReq.id } });
        expect(row!.archived_at).toBeNull();
    });

    test('client details history keeps archived submissions visible, flagged is_archived', async () => {
        const client = await createClient(workspaceId);
        const form = await createForm(workspaceId);
        const active = await createRequest(workspaceId, form.id, client.id, 'reviewed');
        const archived = await createRequest(workspaceId, form.id, client.id, 'reviewed');
        await testPrisma.form_requests.update({
            where: { id: archived.id },
            data:  { archived_at: new Date(), archived_by: ownerId },
        });

        const res = await request.get(`/api/forms/requests/client/${client.id}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        const byId = Object.fromEntries(res.body.map((r: { id: string }) => [r.id, r]));

        expect(byId[active.id]).toBeDefined();
        expect(byId[active.id].is_archived).toBe(false);
        expect(byId[archived.id]).toBeDefined();
        expect(byId[archived.id].is_archived).toBe(true);
    });

    test('archiving a submission with metric/photo answers removes its readings from the transformation chart', async () => {
        const client = await createClient(workspaceId);
        const form = await createForm(workspaceId);

        const weightMetric = await testPrisma.metrics.create({
            data: { id: createId(), workspace_id: workspaceId, name: 'Weight', type: 'number', unit: 'kg' },
        });
        const photoMetric = await testPrisma.metrics.create({
            data: { id: createId(), workspace_id: workspaceId, name: 'Front Photo', type: 'image' },
        });

        const keptReq = await createRequest(workspaceId, form.id, client.id, 'submitted');
        await testPrisma.form_responses.create({
            data: { id: createId(), request_id: keptReq.id, metric_id: weightMetric.id, answer: '80' },
        });

        const archivedReq = await createRequest(workspaceId, form.id, client.id, 'submitted');
        await testPrisma.form_responses.create({
            data: { id: createId(), request_id: archivedReq.id, metric_id: weightMetric.id, answer: '78' },
        });
        await testPrisma.form_responses.create({
            data: { id: createId(), request_id: archivedReq.id, metric_id: photoMetric.id, answer: 'https://example.com/photo.jpg' },
        });

        // Before archiving: both readings present, photo metric shows up.
        const before = await request.get(`/api/clients/${client.id}/transformation`).set('Cookie', ownerCookie);
        expect(before.status).toBe(200);
        const weightBefore = before.body.metrics.find((m: { id: string }) => m.id === weightMetric.id);
        expect(weightBefore.history).toHaveLength(2);
        expect(before.body.metrics.some((m: { id: string }) => m.id === photoMetric.id)).toBe(true);

        const archiveRes = await request.patch('/api/forms/queue/archive').set('Cookie', ownerCookie)
            .send({ ids: [archivedReq.id], action: 'archive' });
        expect(archiveRes.status).toBe(200);

        // After archiving: only the kept request's weight reading remains, and
        // the photo metric (which only ever had the archived reading) drops out entirely.
        const after = await request.get(`/api/clients/${client.id}/transformation`).set('Cookie', ownerCookie);
        const weightAfter = after.body.metrics.find((m: { id: string }) => m.id === weightMetric.id);
        expect(weightAfter.history).toHaveLength(1);
        expect(weightAfter.history[0].value).toBe('80');
        expect(after.body.metrics.some((m: { id: string }) => m.id === photoMetric.id)).toBe(false);
        expect(after.body.timeline.some((t: { submissionId: string }) => t.submissionId === archivedReq.id)).toBe(false);
    });
});
