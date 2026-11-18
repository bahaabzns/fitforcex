// The session and client-access caches are switched off under test (TTL 0) so every other
// test sees fresh data. This file turns them on BEFORE the app is loaded to prove that:
//   - the caches really are active, and
//   - every coach action that should change what a caller can do takes effect at once.
process.env.CLIENT_ACCESS_CACHE_TTL_MS = '30000';
process.env.SESSION_CACHE_TTL_MS       = '30000';

import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

const AUTHED_COACH_ENDPOINT   = '/api/subscription-policies';
const PORTAL_ACCESS_ENDPOINT  = '/api/client-portal/access';

const READ_ONLY_POLICY = {
    keep_portal_access:         true,
    view_training_plans:        true,
    view_nutrition_plans:       true,
    view_progress_history:      true,
    view_assessments:           true,
    view_checkins:              true,
    allow_messaging:            false,
    allow_submit_checkins:      false,
    allow_booking_appointments: false,
    allow_download_files:       false,
    allow_food_swap:            false,
};

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

async function createActiveClient(workspaceId: string) {
    const client = await testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Cache',
            lname:        'Client',
            email:        `client-${createId()}@test.com`,
            workspace_id: workspaceId,
        },
    });
    await testPrisma.transactions.create({
        data: {
            id:                      createId(),
            transaction_code:        Math.floor(Math.random() * 90000) + 10000,
            workspace_id:            workspaceId,
            client_id:               client.id,
            client_name:             'Cache Client',
            payment_method:          'cash',
            amount:                  100,
            status:                  'completed',
            duration:                30,
            start_mode:              'custom',
            subscription_start_date: daysAgo(5),
        },
    });
    return client;
}

describe('Request caches (enabled)', () => {
    describe('coach session cache', () => {
        let userId: string;
        let cookie: string;

        beforeEach(async () => {
            const user = await createTestUser();
            const ws   = await createTestWorkspace(user.id);
            userId = user.id;
            cookie = await makeAuthCookie(user.id, ws.id, 'owner');
        });

        test('logging out through the API blocks the very next request', async () => {
            const before = await request.get(AUTHED_COACH_ENDPOINT).set('Cookie', cookie);
            expect(before.status).toBe(200);

            const logout = await request.post('/api/auth/logout').set('Cookie', cookie);
            expect(logout.status).toBe(200);

            const after = await request.get(AUTHED_COACH_ENDPOINT).set('Cookie', cookie);
            expect(after.status).toBe(401);
        });

        test('a session row changed behind the API is only noticed after the TTL (proves the cache is on)', async () => {
            const before = await request.get(AUTHED_COACH_ENDPOINT).set('Cookie', cookie);
            expect(before.status).toBe(200);

            await testPrisma.user_sessions.updateMany({ where: { user_id: userId }, data: { revoked_at: new Date() } });

            const after = await request.get(AUTHED_COACH_ENDPOINT).set('Cookie', cookie);
            expect(after.status).toBe(200);
        });

        test('an unknown token is rejected and a session created afterwards is accepted at once', async () => {
            const user = await createTestUser();
            const ws   = await createTestWorkspace(user.id);
            const lateCookie = await makeAuthCookie(user.id, ws.id, 'owner');
            await testPrisma.user_sessions.deleteMany({ where: { user_id: user.id } });

            const rejected = await request.get(AUTHED_COACH_ENDPOINT).set('Cookie', lateCookie);
            expect(rejected.status).toBe(401);

            // Same token, session row appears afterwards (e.g. created by a concurrent login).
            const token = lateCookie.replace('token=', '');
            const { createSession } = await import('../../src/modules/auth/auth.service');
            await createSession(user.id, token);

            const accepted = await request.get(AUTHED_COACH_ENDPOINT).set('Cookie', lateCookie);
            expect(accepted.status).toBe(200);
        });
    });

    describe('client portal access cache', () => {
        let workspaceId: string;
        let coachCookie: string;

        beforeEach(async () => {
            const user = await createTestUser();
            const ws   = await createTestWorkspace(user.id);
            workspaceId = ws.id;
            coachCookie = await makeAuthCookie(user.id, ws.id, 'owner');
        });

        test('freezing a client through the API changes portal access at once', async () => {
            const client = await createActiveClient(workspaceId);
            const portalCookie = makeClientCookie(client.id, workspaceId);

            const before = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            expect(before.status).toBe(200);
            expect(before.body.status).toBe('Active');

            const freeze = await request.post(`/api/clients/${client.id}/freezes`).set('Cookie', coachCookie)
                .send({ freezeStartDate: new Date().toISOString().slice(0, 10), freezeDurationDays: 7 });
            expect(freeze.status).toBeLessThan(300);

            const after = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            expect(after.body.status).toBe('Frozen');
        });

        test('archiving then restoring a client changes portal access at once', async () => {
            const client = await createActiveClient(workspaceId);
            const portalCookie = makeClientCookie(client.id, workspaceId);
            await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);

            const archived = await request.delete(`/api/clients/${client.id}`).set('Cookie', coachCookie);
            expect(archived.status).toBeLessThan(300);
            const whileArchived = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            expect(whileArchived.body.status).toBe('Archived');

            const restored = await request.post(`/api/clients/${client.id}/restore`).set('Cookie', coachCookie);
            expect(restored.status).toBeLessThan(300);
            const afterRestore = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            expect(afterRestore.body.status).toBe('Active');
        });

        test('saving the workspace policies changes the access flags of every cached client at once', async () => {
            const client = await createActiveClient(workspaceId);
            const portalCookie = makeClientCookie(client.id, workspaceId);
            const before = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            expect(before.body.access.allow_messaging).toBe(true);

            // Active clients are not governed by the expired/frozen policies, so freeze the
            // client first (also via the API) and then tighten the frozen policy.
            await request.post(`/api/clients/${client.id}/freezes`).set('Cookie', coachCookie)
                .send({ freezeStartDate: new Date().toISOString().slice(0, 10), freezeDurationDays: 7 });
            const frozenOpen = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            const messagingWhileFrozen = frozenOpen.body.access.allow_messaging;

            const saved = await request.put(AUTHED_COACH_ENDPOINT).set('Cookie', coachCookie).send({
                expired: { ...READ_ONLY_POLICY, grace_period_days: 0 },
                frozen:  { ...READ_ONLY_POLICY, allow_messaging: !messagingWhileFrozen },
            });
            expect(saved.status).toBe(200);

            const after = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            expect(after.body.access.allow_messaging).toBe(!messagingWhileFrozen);
        });

        test('a freeze inserted behind the API is only noticed after the TTL (proves the cache is on)', async () => {
            const client = await createActiveClient(workspaceId);
            const portalCookie = makeClientCookie(client.id, workspaceId);
            const before = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            expect(before.body.status).toBe('Active');

            await testPrisma.subscription_freezes.create({
                data: { id: createId(), client_id: client.id, freeze_start_date: new Date(), freeze_duration_days: 7 },
            });

            const after = await request.get(PORTAL_ACCESS_ENDPOINT).set('Cookie', portalCookie);
            expect(after.body.status).toBe('Active');
        });
    });
});
