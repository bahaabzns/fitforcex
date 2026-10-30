import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

describe('Messenger — reply to a specific message', () => {
    let coachCookie: string;
    let clientCookie: string;
    let workspaceId: string;
    let clientId: string;
    let threadId: string;

    async function createClientWithThread(wsId: string) {
        const client = await testPrisma.clients.create({
            data: {
                id:           createId(),
                client_code:  Math.floor(Math.random() * 90000) + 10000,
                fname:        'Reply',
                lname:        'Tester',
                email:        `client-${createId()}@test.com`,
                workspace_id: wsId,
            },
        });
        const thread = await testPrisma.threads.create({
            data: { id: createId(), workspace_id: wsId, client_id: client.id },
        });
        return { client, thread };
    }

    function seedMessage(data: Record<string, unknown> = {}) {
        return testPrisma.messages.create({
            data: {
                id:          createId(),
                thread_id:   threadId,
                sender_type: 'client',
                sender_id:   clientId,
                body:        'Original question',
                ...data,
            } as never,
        });
    }

    beforeEach(async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        workspaceId     = workspace.id;
        coachCookie     = await makeAuthCookie(user.id, workspaceId);

        const { client, thread } = await createClientWithThread(workspaceId);
        clientId     = client.id;
        threadId     = thread.id;
        clientCookie = makeClientCookie(clientId, workspaceId);
    });

    test('coach reply quotes the client message, and the client sees the quote', async () => {
        const original = await seedMessage();

        const sent = await request
            .post(`/api/messenger/threads/${threadId}/messages`)
            .set('Cookie', coachCookie)
            .send({ body: 'Answer', replyToId: original.id });

        expect(sent.status).toBe(201);
        expect(sent.body.reply_to_id).toBe(original.id);
        expect(sent.body.reply_to).toMatchObject({ id: original.id, sender_type: 'client', body: 'Original question', deleted_at: null });

        const clientView = await request.get('/api/client-portal/messages').set('Cookie', clientCookie);
        const reply = clientView.body.messages.find((m: { id: string }) => m.id === sent.body.id);
        expect(reply.reply_to).toMatchObject({ id: original.id, body: 'Original question' });
    });

    test('client reply quotes the coach message, and the coach sees the quote', async () => {
        const original = await seedMessage({ sender_type: 'team', sender_id: 'coach', body: 'How was training?' });

        const sent = await request
            .post('/api/client-portal/messages')
            .set('Cookie', clientCookie)
            .send({ body: 'Great!', replyToId: original.id });

        expect(sent.status).toBe(201);
        expect(sent.body.reply_to).toMatchObject({ id: original.id, sender_type: 'team', body: 'How was training?' });

        const coachView = await request.get(`/api/messenger/threads/${threadId}/messages`).set('Cookie', coachCookie);
        const reply = coachView.body.find((m: { id: string }) => m.id === sent.body.id);
        expect(reply.reply_to.id).toBe(original.id);
    });

    test('quote of an image carries its type and name for the thumbnail/label', async () => {
        const image = await seedMessage({
            type: 'image', body: null, attachment_url: 'messenger-attachments/pic.png',
            attachment_name: 'pic.png', attachment_mime: 'image/png',
        });

        const sent = await request
            .post(`/api/messenger/threads/${threadId}/messages`)
            .set('Cookie', coachCookie)
            .send({ body: 'Nice photo', replyToId: image.id });

        expect(sent.body.reply_to).toMatchObject({ type: 'image', attachment_name: 'pic.png' });
        expect(sent.body.reply_to.attachment_url).toBeTruthy();
    });

    test('an attachment can be a reply too', async () => {
        const original = await seedMessage();

        const sent = await request
            .post(`/api/messenger/threads/${threadId}/attachments`)
            .set('Cookie', coachCookie)
            .field('replyToId', original.id)
            .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'plan.pdf', contentType: 'application/pdf' });

        expect(sent.status).toBe(201);
        expect(sent.body.type).toBe('file');
        expect(sent.body.reply_to_id).toBe(original.id);
    });

    test('after the original is deleted, the quote shows it as deleted with no content', async () => {
        const original = await seedMessage({ sender_type: 'team', sender_id: 'coach', body: 'Secret' });
        const sent = await request
            .post('/api/client-portal/messages')
            .set('Cookie', clientCookie)
            .send({ body: 'Replying', replyToId: original.id });

        await request.delete(`/api/messenger/threads/${threadId}/messages/${original.id}`).set('Cookie', coachCookie);

        const view = await request.get('/api/client-portal/messages').set('Cookie', clientCookie);
        const reply = view.body.messages.find((m: { id: string }) => m.id === sent.body.id);
        expect(reply.reply_to.deleted_at).not.toBeNull();
        expect(reply.reply_to.body).toBeNull();
        expect(reply.reply_to.attachment_url).toBeNull();
    });

    test('rejects replying to a deleted message', async () => {
        const deleted = await seedMessage({ deleted_at: new Date(), body: null });

        const res = await request
            .post(`/api/messenger/threads/${threadId}/messages`)
            .set('Cookie', coachCookie)
            .send({ body: 'Hello?', replyToId: deleted.id });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/deleted/i);
    });

    test('rejects a replyToId that belongs to another thread (cannot quote across conversations)', async () => {
        const otherUser      = await createTestUser();
        const otherWorkspace = await createTestWorkspace(otherUser.id);
        const other          = await createClientWithThread(otherWorkspace.id);
        const foreign        = await testPrisma.messages.create({
            data: { id: createId(), thread_id: other.thread.id, sender_type: 'client', sender_id: other.client.id, body: 'Private' },
        });

        const fromCoach = await request
            .post(`/api/messenger/threads/${threadId}/messages`)
            .set('Cookie', coachCookie)
            .send({ body: 'Peek', replyToId: foreign.id });
        const fromClient = await request
            .post('/api/client-portal/messages')
            .set('Cookie', clientCookie)
            .send({ body: 'Peek', replyToId: foreign.id });

        expect(fromCoach.status).toBe(400);
        expect(fromClient.status).toBe(400);
        expect(JSON.stringify([fromCoach.body, fromClient.body])).not.toContain('Private');
    });

    test('rejects a non-string replyToId', async () => {
        const res = await request
            .post(`/api/messenger/threads/${threadId}/messages`)
            .set('Cookie', coachCookie)
            .send({ body: 'Hi', replyToId: { id: 'x' } });

        expect(res.status).toBe(400);
    });

    test('messages without a reply (including old rows) load with a null quote', async () => {
        const legacy = await seedMessage();

        const plain = await request
            .post(`/api/messenger/threads/${threadId}/messages`)
            .set('Cookie', coachCookie)
            .send({ body: 'No reply here' });
        expect(plain.status).toBe(201);
        expect(plain.body.reply_to).toBeNull();

        const coachView = await request.get(`/api/messenger/threads/${threadId}/messages`).set('Cookie', coachCookie);
        const clientView = await request.get('/api/client-portal/messages').set('Cookie', clientCookie);
        for (const list of [coachView.body, clientView.body.messages]) {
            const old = list.find((m: { id: string }) => m.id === legacy.id);
            expect(old.body).toBe('Original question');
            expect(old.reply_to).toBeNull();
            expect(old.reply_to_id).toBeNull();
        }
    });

    test('deleting a reply drops its quote', async () => {
        const original = await seedMessage();
        const sent = await request
            .post(`/api/messenger/threads/${threadId}/messages`)
            .set('Cookie', coachCookie)
            .send({ body: 'Answer', replyToId: original.id });

        const deleted = await request
            .delete(`/api/messenger/threads/${threadId}/messages/${sent.body.id}`)
            .set('Cookie', coachCookie);

        expect(deleted.body.reply_to).toBeNull();
    });
});
