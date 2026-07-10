import { request, createTestUser, createTestWorkspace, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';
import { recordEvent } from '../../src/lib/events';

/**
 * Regression coverage for the client-portal notification endpoints the
 * Flutter app's Notifications screen calls. Added after a mobile bug report
 * ("Notifications spins forever") — this suite proved the backend responds
 * correctly (200, fast, well-formed body) even for a client with no
 * subscription row at all, isolating the bug to the Flutter widget layer
 * (a BoxDecoration paint crash, fixed separately).
 */
describe('Client portal notifications — GET /client-portal/notifications', () => {
    let workspaceId: string;
    let clientId: string;
    let cookie: string;

    beforeEach(async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        workspaceId     = workspace.id;

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
        cookie   = makeClientCookie(clientId, workspaceId);
    });

    test('a client with no subscription row gets an empty list, not an error', async () => {
        const res = await request.get('/api/client-portal/notifications').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('unread-count for the same no-subscription client is zero', async () => {
        const res = await request.get('/api/client-portal/notifications/unread-count').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ count: 0 });
    });

    test('returns the notification once one exists for this client', async () => {
        await recordEvent({
            workspaceId,
            type:       'plan.assigned',
            title:      'A new nutrition plan was assigned to you',
            recipients: [{ type: 'client', id: clientId }],
        });

        const res = await request.get('/api/client-portal/notifications').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].type).toBe('plan.assigned');
        expect(res.body[0].read_at).toBeNull();
    });
});
