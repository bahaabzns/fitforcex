import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

async function createClientWithThread(workspaceId: string) {
    const client = await testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Unread',
            lname:        'Client',
            email:        `client-${createId()}@test.com`,
            workspace_id: workspaceId,
        },
    });
    const thread = await testPrisma.threads.create({
        data: { id: createId(), workspace_id: workspaceId, client_id: client.id },
    });
    return { client, thread };
}

function addMessage(threadId: string, overrides: Record<string, unknown> = {}) {
    return testPrisma.messages.create({
        data: { id: createId(), thread_id: threadId, sender_type: 'client', sender_id: createId(), body: 'hi', ...overrides },
    });
}

describe('GET /api/messenger/unread-count', () => {
    let workspaceId: string;
    let cookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        cookie      = await makeAuthCookie(user.id, ws.id, 'owner');
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request.get('/api/messenger/unread-count');
        expect(res.status).toBe(401);
    });

    test('returns 0 for a workspace with no messages', async () => {
        const res = await request.get('/api/messenger/unread-count').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ count: 0 });
    });

    test('counts unread client messages across all threads in the workspace', async () => {
        const a = await createClientWithThread(workspaceId);
        const b = await createClientWithThread(workspaceId);
        await addMessage(a.thread.id);
        await addMessage(a.thread.id);
        await addMessage(b.thread.id);

        const res = await request.get('/api/messenger/unread-count').set('Cookie', cookie);

        expect(res.body.count).toBe(3);
    });

    test('ignores team messages, already-read messages and deleted messages', async () => {
        const { thread } = await createClientWithThread(workspaceId);
        await addMessage(thread.id);                                              // counts
        await addMessage(thread.id, { sender_type: 'team' });                    // sent by the coach
        await addMessage(thread.id, { read_by_team_at: new Date() });            // already read
        await addMessage(thread.id, { deleted_at: new Date() });                 // deleted

        const res = await request.get('/api/messenger/unread-count').set('Cookie', cookie);

        expect(res.body.count).toBe(1);
    });

    test('never counts another workspace’s messages (tenant isolation)', async () => {
        const otherOwner = await createTestUser();
        const otherWs    = await createTestWorkspace(otherOwner.id);
        const other      = await createClientWithThread(otherWs.id);
        await addMessage(other.thread.id);
        await addMessage(other.thread.id);

        const mine = await createClientWithThread(workspaceId);
        await addMessage(mine.thread.id);

        const res = await request.get('/api/messenger/unread-count').set('Cookie', cookie);

        expect(res.body.count).toBe(1);
    });

    test('matches the sum of unread_count returned by GET /threads', async () => {
        const a = await createClientWithThread(workspaceId);
        const b = await createClientWithThread(workspaceId);
        await addMessage(a.thread.id);
        await addMessage(b.thread.id);
        await addMessage(b.thread.id, { deleted_at: new Date() });

        const count   = await request.get('/api/messenger/unread-count').set('Cookie', cookie);
        const threads = await request.get('/api/messenger/threads').set('Cookie', cookie);
        const summed  = (threads.body as Array<{ unread_count?: number }>).reduce((sum, t) => sum + (t.unread_count || 0), 0);

        expect(count.body.count).toBe(summed);
    });

    test('drops after the coach opens the thread (messages marked read)', async () => {
        const { thread } = await createClientWithThread(workspaceId);
        await addMessage(thread.id);
        await addMessage(thread.id);

        await request.get(`/api/messenger/threads/${thread.id}/messages`).set('Cookie', cookie);
        const res = await request.get('/api/messenger/unread-count').set('Cookie', cookie);

        expect(res.body.count).toBe(0);
    });
});
