import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

const READ_ONLY = {
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
};

function policyBody(overrides: { expired?: object; frozen?: object } = {}) {
    return {
        expired: { ...READ_ONLY, grace_period_days: 0, ...overrides.expired },
        frozen:  { ...READ_ONLY, ...overrides.frozen },
    };
}

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

async function createClient(workspaceId: string, currentPackageVariationId: string | null = null) {
    return testPrisma.clients.create({
        data: {
            id:                           createId(),
            client_code:                  Math.floor(Math.random() * 90000) + 10000,
            fname:                        'Test',
            lname:                        'Client',
            email:                        `client-${createId()}@test.com`,
            workspace_id:                 workspaceId,
            current_package_variation_id: currentPackageVariationId,
        },
    });
}

async function createSubscriptionTx(workspaceId: string, clientId: string, startDate: Date, duration: number) {
    return testPrisma.transactions.create({
        data: {
            id:                      createId(),
            transaction_code:        Math.floor(Math.random() * 90000) + 10000,
            workspace_id:            workspaceId,
            client_id:               clientId,
            client_name:             'Test Client',
            payment_method:          'cash',
            amount:                  100,
            status:                  'completed',
            duration,
            start_mode:              'custom',
            subscription_start_date: startDate,
        },
    });
}

describe('Subscription policies — coach API', () => {
    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request.get('/api/subscription-policies');
        expect(res.status).toBe(401);
    });

    test('returns 403 when a member lacks finance permission', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'member');
        const res = await request.get('/api/subscription-policies').set('Cookie', cookie);
        expect(res.status).toBe(403);
    });

    test('GET returns read-only defaults before anything is saved', async () => {
        const res = await request.get('/api/subscription-policies').set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        expect(res.body.expired.view_training_plans).toBe(true);
        expect(res.body.expired.allow_messaging).toBe(false);
        expect(res.body.expired.grace_period_days).toBe(0);
        expect(res.body.frozen.allow_messaging).toBe(false);
    });

    test('PUT saves global policies and GET reflects them + writes an audit row', async () => {
        const body = policyBody({ expired: { allow_messaging: true, grace_period_days: 7 } });
        const put = await request.put('/api/subscription-policies').set('Cookie', ownerCookie).send(body);
        expect(put.status).toBe(200);
        expect(put.body.expired.allow_messaging).toBe(true);
        expect(put.body.expired.grace_period_days).toBe(7);

        const get = await request.get('/api/subscription-policies').set('Cookie', ownerCookie);
        expect(get.body.expired.allow_messaging).toBe(true);

        const audits = await testPrisma.subscription_status_audit.findMany({ where: { workspace_id: workspaceId, event_type: 'policy.update' } });
        expect(audits.length).toBeGreaterThan(0);
    });

    test('PUT with a missing scope is rejected with 400', async () => {
        const res = await request.put('/api/subscription-policies').set('Cookie', ownerCookie).send({ expired: { ...READ_ONLY, grace_period_days: 0 } });
        expect(res.status).toBe(400);
    });

    test('package override CRUD: set then clear', async () => {
        const pkg = await testPrisma.packages.create({ data: { id: createId(), workspace_id: workspaceId, name: 'Gold' } });

        const set = await request.put(`/api/subscription-policies/packages/${pkg.id}`).set('Cookie', ownerCookie)
            .send({ expired: { ...READ_ONLY, allow_messaging: true, grace_period_days: 0 } });
        expect(set.status).toBe(200);
        expect(set.body.expired.allow_messaging).toBe(true);
        expect(set.body.frozen).toBeNull();

        const cleared = await request.put(`/api/subscription-policies/packages/${pkg.id}`).set('Cookie', ownerCookie).send({ expired: null });
        expect(cleared.status).toBe(200);
        expect(cleared.body.expired).toBeNull();
    });

    test('tenant isolation: cannot read a package override from another workspace', async () => {
        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        const otherPkg  = await testPrisma.packages.create({ data: { id: createId(), workspace_id: otherWs.id, name: 'Other' } });

        const res = await request.get(`/api/subscription-policies/packages/${otherPkg.id}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(404);
    });
});

describe('Subscription policies — client portal enforcement', () => {
    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('expired client under default policy: messaging blocked, plan view allowed', async () => {
        const client = await createClient(workspaceId);
        await createSubscriptionTx(workspaceId, client.id, daysAgo(60), 30);
        const cookie = makeClientCookie(client.id, workspaceId);

        const access = await request.get('/api/client-portal/access').set('Cookie', cookie);
        expect(access.status).toBe(200);
        expect(access.body.status).toBe('Expired');
        expect(access.body.access.allow_messaging).toBe(false);

        const msg = await request.post('/api/client-portal/messages').set('Cookie', cookie).send({ body: 'hi' });
        expect(msg.status).toBe(403);
        expect(msg.body.code).toBe('ACCESS_RESTRICTED');

        // View is allowed by default → guard passes (404 = no plan, not 403).
        const plan = await request.get('/api/client-portal/active-plan').set('Cookie', cookie);
        expect(plan.status).not.toBe(403);
    });

    test('keep_portal_access=false blocks features but not /me or /access', async () => {
        const client = await createClient(workspaceId);
        await createSubscriptionTx(workspaceId, client.id, daysAgo(60), 30);
        const cookie = makeClientCookie(client.id, workspaceId);

        await request.put('/api/subscription-policies').set('Cookie', ownerCookie)
            .send(policyBody({ expired: { keep_portal_access: false } }));

        const plan = await request.get('/api/client-portal/active-plan').set('Cookie', cookie);
        expect(plan.status).toBe(403);
        expect(plan.body.code).toBe('PORTAL_RESTRICTED');

        const me = await request.get('/api/client-portal/me').set('Cookie', cookie);
        expect(me.status).toBe(200);
        expect(me.body.status).toBe('Expired');

        const access = await request.get('/api/client-portal/access').set('Cookie', cookie);
        expect(access.status).toBe(200);
    });

    test('active client keeps full access', async () => {
        const client = await createClient(workspaceId);
        await createSubscriptionTx(workspaceId, client.id, daysAgo(5), 30);
        const cookie = makeClientCookie(client.id, workspaceId);

        const access = await request.get('/api/client-portal/access').set('Cookie', cookie);
        expect(access.body.status).toBe('Active');
        expect(access.body.access.allow_messaging).toBe(true);

        const msg = await request.get('/api/client-portal/messages').set('Cookie', cookie);
        expect(msg.status).toBe(200);
    });

    test('package override beats the global policy', async () => {
        const pkg = await testPrisma.packages.create({ data: { id: createId(), workspace_id: workspaceId, name: 'Gold' } });
        const variation = await testPrisma.package_variations.create({
            data: { id: createId(), package_id: pkg.id, name: 'Gold Monthly', duration: 30, price: 100 },
        });
        const client = await createClient(workspaceId, variation.id);
        await createSubscriptionTx(workspaceId, client.id, daysAgo(60), 30);
        const cookie = makeClientCookie(client.id, workspaceId);

        // Global keeps messaging off; the package override turns it on for expired.
        await request.put(`/api/subscription-policies/packages/${pkg.id}`).set('Cookie', ownerCookie)
            .send({ expired: { ...READ_ONLY, allow_messaging: true, grace_period_days: 0 } });

        const access = await request.get('/api/client-portal/access').set('Cookie', cookie);
        expect(access.body.access.allow_messaging).toBe(true);

        const msg = await request.get('/api/client-portal/messages').set('Cookie', cookie);
        expect(msg.status).toBe(200);
    });
});
