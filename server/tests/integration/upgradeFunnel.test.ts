import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { applyPayment } from '../../src/modules/billing/billing.controller';

const PLAN_NAME = `upgrade-funnel-plan-${createId()}`;

async function seedPlanWithVariation() {
    const plan = await testPrisma.plans.upsert({
        where: { name: PLAN_NAME }, update: {},
        create: { id: createId(), name: PLAN_NAME, display_name: 'Funnel Plan', duration_days: 30, max_team_seats: 5 },
    });
    const variation = await testPrisma.plan_variations.create({
        data: { id: createId(), plan_id: plan.id, max_clients: 50, max_team_seats: 5, price_monthly: 200, currency: 'EGP', sort_order: Math.floor(Math.random() * 1e6) },
    });
    return { plan, variation };
}

async function seedFreeCoach(planId: string) {
    const user = await createTestUser();
    const workspace = await createTestWorkspace(user.id);
    await testPrisma.workspace_subscriptions.create({
        data: { id: createId(), workspace_id: workspace.id, plan_id: planId, status: 'active' },
    });
    const cookie = await makeAuthCookie(user.id, workspace.id);
    return { user, workspace, cookie };
}

async function startManualCheckout(
    cookie: string, plan: { id: string }, variation: { id: string }, extra: Record<string, unknown>
) {
    const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie)
        .send({ planId: plan.id, variationId: variation.id, paymentMethod: 'manual', ...extra });
    expect(res.status).toBe(200);
    return res.body.paymentId as string;
}

describe('Upgrade funnel tracking', () => {
    it('records which button opened checkout and where to return to', async () => {
        const { plan, variation } = await seedPlanWithVariation();
        const { workspace, cookie } = await seedFreeCoach(plan.id);

        const paymentId = await startManualCheckout(cookie, plan, variation, {
            source: 'sidebar_meter', returnTo: `/${workspace.slug}/clients?add=1`,
        });

        const event = await testPrisma.upgrade_events.findFirstOrThrow({ where: { payment_id: paymentId } });
        expect(event).toMatchObject({
            event_type: 'checkout_started', source: 'sidebar_meter', workspace_id: workspace.id,
            plan_id: plan.id, variation_id: variation.id, return_to: `/${workspace.slug}/clients?add=1`,
        });
    });

    it('files an unknown source under the subscription page and drops a return path outside the workspace', async () => {
        const { plan, variation } = await seedPlanWithVariation();
        const { cookie } = await seedFreeCoach(plan.id);

        const paymentId = await startManualCheckout(cookie, plan, variation, { source: 'made-up-button', returnTo: 'https://evil.example/x' });

        const event = await testPrisma.upgrade_events.findFirstOrThrow({ where: { payment_id: paymentId } });
        expect(event.source).toBe('subscription_page');
        expect(event.return_to).toBeNull();
    });

    it('credits a payment to the button that started its checkout, exactly once', async () => {
        const { plan, variation } = await seedPlanWithVariation();
        const { workspace, cookie } = await seedFreeCoach(plan.id);
        const paymentId = await startManualCheckout(cookie, plan, variation, { source: 'limit_popup' });

        await applyPayment(paymentId, workspace.id);
        await applyPayment(paymentId, workspace.id); // replayed webhook/poll must not double count
        await new Promise(resolve => setTimeout(resolve, 200)); // the paid event is written after commit, fire-and-forget

        const paid = await testPrisma.upgrade_events.findMany({ where: { payment_id: paymentId, event_type: 'paid' } });
        expect(paid).toHaveLength(1);
        expect(paid[0].source).toBe('limit_popup');
    });

    it('returns the saved return path from payment-status', async () => {
        const { plan, variation } = await seedPlanWithVariation();
        const { workspace, cookie } = await seedFreeCoach(plan.id);
        const returnTo = `/${workspace.slug}/settings/branding`;
        const paymentId = await startManualCheckout(cookie, plan, variation, { source: 'lock_branding', returnTo });

        const res = await request.get(`/api/billing/payment-status/${paymentId}`).set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.returnTo).toBe(returnTo);
    });

    it('accepts client-reported steps but rejects unknown sources and server-only steps', async () => {
        const { plan } = await seedPlanWithVariation();
        const { cookie } = await seedFreeCoach(plan.id);

        const valid = await request.post('/api/billing/upgrade-events').set('Cookie', cookie).send({ eventType: 'click', source: 'topbar' });
        const badSource = await request.post('/api/billing/upgrade-events').set('Cookie', cookie).send({ eventType: 'click', source: 'nope' });
        const forgedPaid = await request.post('/api/billing/upgrade-events').set('Cookie', cookie).send({ eventType: 'paid', source: 'topbar' });

        expect(valid.status).toBe(204);
        expect(badSource.status).toBe(400);
        expect(forgedPaid.status).toBe(400);
    });

    it('rejects upgrade events from callers who are not the workspace owner or not signed in', async () => {
        const { plan } = await seedPlanWithVariation();
        const { user, workspace } = await seedFreeCoach(plan.id);
        const memberCookie = await makeAuthCookie(user.id, workspace.id, 'member');

        const asMember = await request.post('/api/billing/upgrade-events').set('Cookie', memberCookie).send({ eventType: 'click', source: 'topbar' });
        const anonymous = await request.post('/api/billing/upgrade-events').send({ eventType: 'click', source: 'topbar' });

        expect(asMember.status).toBe(403);
        expect(anonymous.status).toBe(401);
    });

    it('reports the real client count and feature access on the subscription', async () => {
        const { plan } = await seedPlanWithVariation();
        const { workspace, cookie } = await seedFreeCoach(plan.id);
        await testPrisma.clients.create({
            data: { id: createId(), client_code: 1, fname: 'A', lname: 'B', email: `c-${createId()}@test.com`, workspace_id: workspace.id },
        });

        const res = await request.get('/api/billing/subscription').set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.subscription.clientCount).toBe(1);
        expect(res.body.featureAccess.custom_branding).toEqual(expect.objectContaining({ unlocked: false }));
    });
});
