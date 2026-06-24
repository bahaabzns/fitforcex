import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';
import { recordEvent, teamRecipients } from '../../src/lib/events';

/**
 * Covers the canonical durability path: a client-message event runs through
 * recordEvent() (exactly what the client-portal controller calls), lands a
 * durable row for the team, and the bell endpoints read/clear it. recordEvent is
 * exercised directly rather than through the client-portal HTTP route so the test
 * targets the notification substrate, not the orthogonal subscription-access gate.
 */
describe('Notifications — durable substrate + bell API', () => {
    let cookie: string;
    let userId: string;
    let workspaceId: string;
    let clientId: string;

    beforeEach(async () => {
        const user      = await createTestUser();
        userId          = user.id;
        const workspace = await createTestWorkspace(user.id);
        workspaceId     = workspace.id;
        cookie          = await makeAuthCookie(user.id, workspaceId);

        // teamRecipients() resolves recipients from workspace_members; the owner
        // must be an active member for the team to receive notifications.
        await testPrisma.workspace_members.create({
            data: { id: createId(), workspace_id: workspaceId, user_id: userId, role: 'owner', is_active: true },
        });

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

    async function emitClientMessage(): Promise<void> {
        await recordEvent({
            workspaceId,
            type:       'message.received',
            importance: 'actionable',
            title:      'New message from a client',
            recipients: await teamRecipients(workspaceId),
            actor:      { type: 'client', id: clientId },
            entity:     { type: 'thread', id: createId() },
        });
    }

    test('a client message writes one durable, unread notification per team member', async () => {
        await emitClientMessage();

        const rows = await testPrisma.notifications.findMany({ where: { workspace_id: workspaceId } });
        expect(rows).toHaveLength(1);
        expect(rows[0].recipient_type).toBe('user');
        expect(rows[0].recipient_id).toBe(userId);
        expect(rows[0].type).toBe('message.received');
        expect(rows[0].read_at).toBeNull();
    });

    test('GET /notifications/unread-count reflects unread rows', async () => {
        await emitClientMessage();

        const res = await request.get('/api/notifications/unread-count').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
    });

    test('PATCH /notifications/:id/read clears one and decrements the unread count', async () => {
        await emitClientMessage();

        const list = await request.get('/api/notifications').set('Cookie', cookie);
        expect(list.body).toHaveLength(1);

        const patched = await request.patch(`/api/notifications/${list.body[0].id}/read`).set('Cookie', cookie);
        expect(patched.status).toBe(200);

        const count = await request.get('/api/notifications/unread-count').set('Cookie', cookie);
        expect(count.body.count).toBe(0);
    });

    test('PATCH /notifications/read-all clears every unread notification', async () => {
        await emitClientMessage();
        await recordEvent({
            workspaceId, type: 'checkin.submitted', title: 'A client submitted a check-in',
            recipients: await teamRecipients(workspaceId),
        });

        await request.patch('/api/notifications/read-all').set('Cookie', cookie);

        const count = await request.get('/api/notifications/unread-count').set('Cookie', cookie);
        expect(count.body.count).toBe(0);
    });

    test('a user cannot see or clear another workspace\'s notifications (tenant isolation)', async () => {
        await emitClientMessage(); // belongs to workspace A / userId

        const otherUser   = await createTestUser();
        const otherWs      = await createTestWorkspace(otherUser.id);
        const otherCookie  = await makeAuthCookie(otherUser.id, otherWs.id);

        const list = await request.get('/api/notifications').set('Cookie', otherCookie);
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(0);

        const count = await request.get('/api/notifications/unread-count').set('Cookie', otherCookie);
        expect(count.body.count).toBe(0);
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request.get('/api/notifications/unread-count');
        expect(res.status).toBe(401);
    });
});
