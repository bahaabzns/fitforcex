import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { env } from '../../src/config/env';

// Fawaterak is mocked at the fetch boundary — everything from the HTTP routes down to the DB
// (payment rows, subscriptions, notifications) is real.

const PLAN_NAME = `test-plan-${createId()}`;
const OTHER_PLAN_NAME = `test-plan-other-${createId()}`;

type GatewayState = { invoiceInitPay: 'ok' | 'error' | 'cart-total'; invoice: { paid: number; transactions: { status: string }[] } | 'unreachable' };
let gateway: GatewayState;

function installFetchMock() {
    return jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/invoiceInitPay')) {
            if (gateway.invoiceInitPay === 'cart-total') {
                return { ok: false, json: async () => ({ status: 'error', message: { cartTotal: ['Amount must be bigger than 5 EGP'] } }) } as Response;
            }
            if (gateway.invoiceInitPay === 'error') {
                return { ok: false, json: async () => ({ status: 'error', message: { token: ['Invalid Token'] } }) } as Response;
            }
            return { ok: true, json: async () => ({ status: 'success', data: { invoice_id: 777001, invoice_key: 'k', payment_data: { redirectTo: 'https://pay.example/hosted' } } }) } as Response;
        }
        if (url.includes('/getInvoiceData/')) {
            if (gateway.invoice === 'unreachable') throw new Error('network down');
            return { ok: true, json: async () => ({ status: 'success', data: { paid: gateway.invoice.paid, invoice_transactions: gateway.invoice.transactions } }) } as Response;
        }
        throw new Error(`unexpected fetch ${url}`);
    });
}

async function seedPlans() {
    const plan = await testPrisma.plans.upsert({
        where: { name: PLAN_NAME }, update: {},
        create: { id: createId(), name: PLAN_NAME, display_name: 'Test Plan', duration_days: 30, max_team_seats: 5 },
    });
    const variation = await testPrisma.plan_variations.create({
        data: { id: createId(), plan_id: plan.id, max_clients: 100, max_team_seats: 5, price_monthly: 100, currency: 'EGP', sort_order: Math.floor(Math.random() * 1e6) },
    });
    return { plan, variation };
}

async function seedCoach(subscription: { status?: string; planId: string; variationId?: string; lockedPrice?: number; expiresAt?: Date | null }) {
    const user = await createTestUser();
    const workspace = await createTestWorkspace(user.id);
    await testPrisma.workspace_subscriptions.create({
        data: {
            id: createId(), workspace_id: workspace.id, plan_id: subscription.planId, variation_id: subscription.variationId ?? null,
            locked_price_monthly: subscription.lockedPrice ?? null, locked_currency: 'EGP',
            status: subscription.status ?? 'active', expires_at: subscription.expiresAt ?? null,
        },
    });
    const cookie = await makeAuthCookie(user.id, workspace.id);
    return { user, workspace, cookie };
}

async function seedPendingPayment(workspaceId: string, planId: string, variationId: string, overrides: Record<string, unknown> = {}) {
    return testPrisma.workspace_payments.create({
        data: {
            id: createId(), workspace_id: workspaceId, plan_id: planId, variation_id: variationId, amount: 100, currency: 'EGP',
            duration_days: 30, gateway: 'fawaterak', gateway_reference_id: String(Math.floor(Math.random() * 1e9)), gateway_status: 'pending', payment_method: 'card',
            ...overrides,
        },
    });
}

function webhookBody(invoiceId: string, paymentId?: string) {
    return JSON.stringify({ invoice_id: invoiceId, invoice_key: 'k', payment_method: 'Visa-Mastercard', invoice_status: 'paid', hashKey: 'forged', pay_load: paymentId ? { payment_id: paymentId } : undefined });
}

function postWebhook(body: string) {
    return request.post('/api/payments/webhook/fawaterak').set('Content-Type', 'application/json').send(body);
}

beforeAll(() => {
    Object.assign(env, {
        PAYMENT_GATEWAY: 'fawaterak', FAWATERAK_API_TOKEN: 'tok', FAWATERAK_VENDOR_KEY: 'vendor',
        FAWATERAK_METHOD_ID_CARD: '2', FAWATERAK_METHOD_ID_WALLET: '4', FAWATERAK_METHOD_ID_FAWRY: '3',
    });
});

beforeEach(() => {
    gateway = { invoiceInitPay: 'ok', invoice: { paid: 0, transactions: [] } };
    installFetchMock();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => { jest.restoreAllMocks(); });

afterAll(async () => {
    await testPrisma.workspace_payments.deleteMany({ where: { plans: { name: { in: [PLAN_NAME, OTHER_PLAN_NAME] } } } });
    await testPrisma.workspace_subscriptions.deleteMany({ where: { plans: { name: { in: [PLAN_NAME, OTHER_PLAN_NAME] } } } });
    await testPrisma.plans.deleteMany({ where: { name: { in: [PLAN_NAME, OTHER_PLAN_NAME] } } });
});

describe('POST /api/billing/create-invoice', () => {
    test('returns 401 without a login', async () => {
        const res = await request.post('/api/billing/create-invoice').send({});
        expect(res.status).toBe(401);
    });

    test('returns 403 for a non-owner role', async () => {
        const { plan, variation } = await seedPlans();
        const { user, workspace } = await seedCoach({ planId: plan.id });
        const cookie = await makeAuthCookie(user.id, workspace.id, 'member');
        const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id, variationId: variation.id, paymentMethod: 'card' });
        expect(res.status).toBe(403);
    });

    test('returns 400 when the plan or variation id is missing or not a string', async () => {
        const { plan } = await seedPlans();
        const { cookie } = await seedCoach({ planId: plan.id });
        expect((await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id })).status).toBe(400);
        expect((await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: { $ne: null }, variationId: { $ne: null } })).status).toBe(400);
    });

    test('returns 400 for a wallet payment without a valid wallet number', async () => {
        const { plan, variation } = await seedPlans();
        const { cookie } = await seedCoach({ planId: plan.id });
        for (const walletPhoneNumber of [undefined, '', 'abc', '123']) {
            const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id, variationId: variation.id, paymentMethod: 'wallet', walletPhoneNumber });
            expect(res.status).toBe(400);
        }
    });

    test('creates a hosted card invoice for the variation price and records the gateway', async () => {
        const { plan, variation } = await seedPlans();
        const { cookie, workspace } = await seedCoach({ planId: plan.id });

        const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id, variationId: variation.id, paymentMethod: 'card' });

        expect(res.status).toBe(200);
        expect(res.body.paymentUrl).toBe('https://pay.example/hosted');
        expect(res.body.amountCharged).toBe(100);
        const row = await testPrisma.workspace_payments.findUniqueOrThrow({ where: { id: res.body.paymentId } });
        expect(row).toMatchObject({ workspace_id: workspace.id, gateway: 'fawaterak', gateway_reference_id: '777001', gateway_status: 'pending', payment_method: 'card' });
    });

    test('an unpaid trial earns no credit, so the invoice is the full variation price', async () => {
        const { plan, variation } = await seedPlans();
        const trialPlan = await testPrisma.plans.upsert({ where: { name: OTHER_PLAN_NAME }, update: {}, create: { id: createId(), name: OTHER_PLAN_NAME, display_name: 'Trial Plan', duration_days: 30 } });
        const { cookie } = await seedCoach({ planId: trialPlan.id, status: 'trialing', lockedPrice: 1000, expiresAt: new Date(Date.now() + 14 * 86400000) });

        const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id, variationId: variation.id, paymentMethod: 'card' });

        expect(res.status).toBe(200);
        expect(res.body.amountCharged).toBe(100);
        expect(res.body.creditApplied).toBeNull();
    });

    test('a paid subscription with time left still gets credit on a tier change', async () => {
        const { plan, variation } = await seedPlans();
        const paidPlan = await testPrisma.plans.upsert({ where: { name: OTHER_PLAN_NAME }, update: {}, create: { id: createId(), name: OTHER_PLAN_NAME, display_name: 'Paid Plan', duration_days: 30 } });
        const { cookie } = await seedCoach({ planId: paidPlan.id, status: 'active', lockedPrice: 60, expiresAt: new Date(Date.now() + 15 * 86400000) });

        const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id, variationId: variation.id, paymentMethod: 'card' });

        expect(res.status).toBe(200);
        expect(res.body.creditApplied).toBeGreaterThan(0);
        expect(res.body.amountCharged).toBeLessThan(100);
    });

    test('a gateway failure returns a generic error, leaks nothing, and closes the payment as failed', async () => {
        gateway.invoiceInitPay = 'error';
        const { plan, variation } = await seedPlans();
        const { cookie, workspace } = await seedCoach({ planId: plan.id });

        const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id, variationId: variation.id, paymentMethod: 'card' });

        expect(res.status).toBe(502);
        expect(JSON.stringify(res.body)).not.toMatch(/Token|Fawaterak/);
        const rows = await testPrisma.workspace_payments.findMany({ where: { workspace_id: workspace.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0].gateway_status).toBe('failed');
    });

    test('a below-minimum amount is a clean 400', async () => {
        gateway.invoiceInitPay = 'cart-total';
        const { plan, variation } = await seedPlans();
        const { cookie } = await seedCoach({ planId: plan.id });

        const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id, variationId: variation.id, paymentMethod: 'card' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/too low/i);
    });

    test('manual transfer never calls the gateway', async () => {
        const { plan, variation } = await seedPlans();
        const { cookie } = await seedCoach({ planId: plan.id });
        const fetchSpy = jest.spyOn(global, 'fetch');
        fetchSpy.mockClear();

        const res = await request.post('/api/billing/create-invoice').set('Cookie', cookie).send({ planId: plan.id, variationId: variation.id, paymentMethod: 'manual' });

        expect(res.status).toBe(200);
        expect(res.body.manualPayment.referenceCode).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('GET /api/billing/payment-status/:id', () => {
    test("returns 404 for another workspace's payment", async () => {
        const { plan, variation } = await seedPlans();
        const owner = await seedCoach({ planId: plan.id });
        const stranger = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(owner.workspace.id, plan.id, variation.id);

        const res = await request.get(`/api/billing/payment-status/${payment.id}`).set('Cookie', stranger.cookie);

        expect(res.status).toBe(404);
    });

    test('activates the subscription once Fawaterak reports the invoice paid', async () => {
        gateway.invoice = { paid: 1, transactions: [{ status: 'paid' }] };
        const { plan, variation } = await seedPlans();
        const { cookie, workspace } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id);

        const res = await request.get(`/api/billing/payment-status/${payment.id}`).set('Cookie', cookie);

        expect(res.body.status).toBe('paid');
        const sub = await testPrisma.workspace_subscriptions.findUniqueOrThrow({ where: { workspace_id: workspace.id } });
        expect(sub.status).toBe('active');
        expect(sub.variation_id).toBe(variation.id);
        expect(sub.expires_at!.getTime()).toBeGreaterThan(Date.now());
    });

    test('marks the payment failed when every attempt on the invoice failed', async () => {
        gateway.invoice = { paid: 0, transactions: [{ status: 'failed' }] };
        const { plan, variation } = await seedPlans();
        const { cookie, workspace } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id);

        const res = await request.get(`/api/billing/payment-status/${payment.id}`).set('Cookie', cookie);

        expect(res.body.status).toBe('failed');
        expect((await testPrisma.workspace_payments.findUniqueOrThrow({ where: { id: payment.id } })).gateway_status).toBe('failed');
    });

    test('stays pending while an attempt is still unpaid, and when Fawaterak is unreachable', async () => {
        const { plan, variation } = await seedPlans();
        const { cookie, workspace } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id);

        gateway.invoice = { paid: 0, transactions: [{ status: 'failed' }, { status: 'Unpaid' }] };
        expect((await request.get(`/api/billing/payment-status/${payment.id}`).set('Cookie', cookie)).body.status).toBe('pending');

        gateway.invoice = 'unreachable';
        expect((await request.get(`/api/billing/payment-status/${payment.id}`).set('Cookie', cookie)).body.status).toBe('pending');
    });
});

describe('POST /api/payments/webhook/fawaterak', () => {
    test('a forged paid payload is ignored when Fawaterak says the invoice is not paid', async () => {
        gateway.invoice = { paid: 0, transactions: [] };
        const { plan, variation } = await seedPlans();
        const { workspace } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id, { gateway_reference_id: '555001' });

        const res = await postWebhook(webhookBody('555001', payment.id));

        expect(res.status).toBe(200);
        const row = await testPrisma.workspace_payments.findUniqueOrThrow({ where: { id: payment.id } });
        expect(row.gateway_status).toBe('pending');
        expect(row.paid_at).toBeNull();
    });

    test('activates the subscription and notifies the owner once when Fawaterak confirms payment', async () => {
        gateway.invoice = { paid: 1, transactions: [{ status: 'paid' }] };
        const { plan, variation } = await seedPlans();
        const { workspace, user } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id, { gateway_reference_id: '555002' });

        expect((await postWebhook(webhookBody('555002', payment.id))).status).toBe(200);

        const sub = await testPrisma.workspace_subscriptions.findUniqueOrThrow({ where: { workspace_id: workspace.id } });
        expect(sub).toMatchObject({ status: 'active', variation_id: variation.id });
        const notifications = await testPrisma.notifications.findMany({ where: { workspace_id: workspace.id, type: 'billing.payment_received' } });
        expect(notifications).toHaveLength(1);
        expect(notifications[0].recipient_id).toBe(user.id);
    });

    test('a replayed webhook changes nothing and does not notify again', async () => {
        gateway.invoice = { paid: 1, transactions: [{ status: 'paid' }] };
        const { plan, variation } = await seedPlans();
        const { workspace } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id, { gateway_reference_id: '555003' });
        await postWebhook(webhookBody('555003', payment.id));
        const afterFirst = await testPrisma.workspace_subscriptions.findUniqueOrThrow({ where: { workspace_id: workspace.id } });

        await postWebhook(webhookBody('555003', payment.id));

        const afterSecond = await testPrisma.workspace_subscriptions.findUniqueOrThrow({ where: { workspace_id: workspace.id } });
        expect(afterSecond.expires_at).toEqual(afterFirst.expires_at);
        expect(await testPrisma.notifications.count({ where: { workspace_id: workspace.id, type: 'billing.payment_received' } })).toBe(1);
        expect(await testPrisma.workspace_subscription_events.count({ where: { workspace_id: workspace.id } })).toBe(1);
    });

    test("a payload cannot activate someone else's payment by pointing pay_load at it", async () => {
        gateway.invoice = { paid: 0, transactions: [] }; // the victim's own invoice is NOT paid
        const { plan, variation } = await seedPlans();
        const attacker = await seedCoach({ planId: plan.id });
        const victim = await seedCoach({ planId: plan.id });
        await seedPendingPayment(attacker.workspace.id, plan.id, variation.id, { gateway_reference_id: '555004' });
        const victimPayment = await seedPendingPayment(victim.workspace.id, plan.id, variation.id, { gateway_reference_id: '555005' });

        await postWebhook(webhookBody('555004', victimPayment.id));

        const row = await testPrisma.workspace_payments.findUniqueOrThrow({ where: { id: victimPayment.id } });
        expect(row.gateway_status).toBe('pending');
    });

    test('marks the payment failed when Fawaterak reports every attempt failed', async () => {
        gateway.invoice = { paid: 0, transactions: [{ status: 'failed' }] };
        const { plan, variation } = await seedPlans();
        const { workspace } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id, { gateway_reference_id: '555006' });

        await postWebhook(webhookBody('555006', payment.id));

        expect((await testPrisma.workspace_payments.findUniqueOrThrow({ where: { id: payment.id } })).gateway_status).toBe('failed');
    });

    test('a payment that was marked failed is still activated if the invoice is later paid', async () => {
        gateway.invoice = { paid: 1, transactions: [{ status: 'failed' }, { status: 'paid' }] };
        const { plan, variation } = await seedPlans();
        const { workspace } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id, { gateway_reference_id: '555008', gateway_status: 'failed' });

        await postWebhook(webhookBody('555008', payment.id));

        const row = await testPrisma.workspace_payments.findUniqueOrThrow({ where: { id: payment.id } });
        expect(row.gateway_status).toBe('paid');
        expect(row.paid_at).not.toBeNull();
    });

    test('asks the gateway to retry (503) when it cannot confirm the invoice', async () => {
        gateway.invoice = 'unreachable';
        const { plan, variation } = await seedPlans();
        const { workspace } = await seedCoach({ planId: plan.id });
        const payment = await seedPendingPayment(workspace.id, plan.id, variation.id, { gateway_reference_id: '555007' });

        const res = await postWebhook(webhookBody('555007', payment.id));

        expect(res.status).toBe(503);
        expect((await testPrisma.workspace_payments.findUniqueOrThrow({ where: { id: payment.id } })).gateway_status).toBe('pending');
    });

    test('acknowledges webhooks that match none of our payments', async () => {
        const res = await postWebhook(webhookBody('999999999'));
        expect(res.status).toBe(200);
    });

    test('rejects an unparseable body with 400', async () => {
        const res = await postWebhook('');
        expect(res.status).toBe(400);
    });
});
