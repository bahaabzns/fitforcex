import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

describe('P1-3 — Messenger', () => {
    let cookie: string;
    let workspaceId: string;
    let clientId: string;

    beforeEach(async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        workspaceId     = workspace.id;
        cookie          = await makeAuthCookie(user.id, workspaceId);

        const client = await testPrisma.clients.create({
            data: {
                id:           createId(),
                client_code:  Math.floor(Math.random() * 90000) + 10000,
                fname:        'Test',
                lname:        'Client',
                email:        `client-${createId()}@test.com`,
                workspace_id: workspaceId,
            },
        });
        clientId = client.id;
    });

    test('POST /messenger/threads creates a thread', async () => {
        const res = await request
            .post('/api/messenger/threads')
            .set('Cookie', cookie)
            .send({ clientId });
        expect(res.status).toBe(201);
        expect(res.body.client_id).toBe(clientId);
    });

    test('POST /messenger/threads is idempotent (same client returns existing thread)', async () => {
        await request.post('/api/messenger/threads').set('Cookie', cookie).send({ clientId });
        const res2 = await request.post('/api/messenger/threads').set('Cookie', cookie).send({ clientId });
        expect(res2.status).toBe(201);
        const threads = await testPrisma.threads.findMany({ where: { client_id: clientId } });
        expect(threads).toHaveLength(1);
    });

    test('POST /messenger/threads/:id/messages sends a message', async () => {
        const thread = await testPrisma.threads.create({
            data: { id: createId(), workspace_id: workspaceId, client_id: clientId },
        });
        const res = await request
            .post(`/api/messenger/threads/${thread.id}/messages`)
            .set('Cookie', cookie)
            .send({ body: 'Hello client!' });
        expect(res.status).toBe(201);
        expect(res.body.body).toBe('Hello client!');
        expect(res.body.sender_type).toBe('team');
    });

    test('GET /messenger/threads/:id/messages marks client messages as read', async () => {
        const thread = await testPrisma.threads.create({
            data: { id: createId(), workspace_id: workspaceId, client_id: clientId },
        });
        const msg = await testPrisma.messages.create({
            data: {
                id:              createId(),
                thread_id:       thread.id,
                sender_type:     'client',
                sender_id:       clientId,
                body:            'Hi coach',
                read_by_team_at: null,
            },
        });
        await request.get(`/api/messenger/threads/${thread.id}/messages`).set('Cookie', cookie);
        const updated = await testPrisma.messages.findUnique({ where: { id: msg.id } });
        expect(updated?.read_by_team_at).not.toBeNull();
    });

    describe('POST /messenger/threads/broadcast', () => {
        jest.setTimeout(30000);

        test('sends to every matching thread, well past the old hardcoded 500-thread cap', async () => {
            const THREAD_COUNT = 501;
            const clientsData = Array.from({ length: THREAD_COUNT }, (_, i) => ({
                id:           createId(),
                client_code:  200000 + i,
                fname:        'Bulk',
                lname:        `Client${i}`,
                email:        `bulk-client-${i}-${createId()}@test.com`,
                workspace_id: workspaceId,
            }));
            await testPrisma.clients.createMany({ data: clientsData });

            const threadsData = clientsData.map(client => ({
                id:           createId(),
                workspace_id: workspaceId,
                client_id:    client.id,
            }));
            await testPrisma.threads.createMany({ data: threadsData });
            const threadIds = threadsData.map(thread => thread.id);

            const res = await request
                .post('/api/messenger/threads/broadcast')
                .set('Cookie', cookie)
                .send({ threadIds, body: 'Broadcast to everyone' });

            expect(res.status).toBe(201);
            expect(res.body.sent).toBe(THREAD_COUNT);

            const messageCount = await testPrisma.messages.count({
                where: { thread_id: { in: threadIds }, body: 'Broadcast to everyone' },
            });
            expect(messageCount).toBe(THREAD_COUNT);
        });

        test('rejects an empty threadIds array', async () => {
            const res = await request
                .post('/api/messenger/threads/broadcast')
                .set('Cookie', cookie)
                .send({ threadIds: [], body: 'Hello' });
            expect(res.status).toBe(400);
        });
    });
});
