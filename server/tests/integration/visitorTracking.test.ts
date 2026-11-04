import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { classifySource, SESSION_GAP_MS } from '../../src/modules/tracking/tracking.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36';

function adminCookie(): string {
    const token = jwt.sign({ isAdmin: true, adminId: 'test-admin' }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' });
    return `admin_token=${token}`;
}

function visit(body: Record<string, unknown>, userAgent = BROWSER_UA) {
    return request.post('/api/track/visit').set('User-Agent', userAgent).send(body);
}

describe('classifySource', () => {
    test('treats a Facebook click id as a Meta ad', () => {
        expect(classifySource({ hasFbclid: true, referrer: 'https://l.facebook.com/' })).toBe('Facebook/Instagram ad');
    });

    test('labels a paid utm_source as an ad', () => {
        expect(classifySource({ utmSource: 'tiktok', utmMedium: 'cpc' })).toBe('TikTok ad');
    });

    test('maps a referrer host to a friendly name', () => {
        expect(classifySource({ referrer: 'https://www.instagram.com/some/post' })).toBe('Instagram');
    });

    test('keeps an unknown referrer host as-is', () => {
        expect(classifySource({ referrer: 'https://some-blog.example.com/post' })).toBe('some-blog.example.com');
    });

    test('falls back to direct with no signals or an unparseable referrer', () => {
        expect(classifySource({})).toBe('direct');
        expect(classifySource({ referrer: 'not a url' })).toBe('direct');
    });
});

describe('POST /api/track/visit', () => {
    beforeEach(async () => {
        await testPrisma.visitors.deleteMany({});
    });

    test('creates the visitor with first-touch source and one session', async () => {
        const visitorId = randomUUID();
        const res = await visit({ visitorId, path: '/', referrer: 'https://www.instagram.com/', utmCampaign: 'ramadan' });

        expect(res.status).toBe(204);
        const visitor = await testPrisma.visitors.findUnique({ where: { id: visitorId } });
        expect(visitor?.first_source).toBe('Instagram');
        expect(visitor?.first_utm_campaign).toBe('ramadan');
        expect(await testPrisma.visitor_sessions.count({ where: { visitor_id: visitorId } })).toBe(1);
    });

    test('a second visit inside the session window joins the same session', async () => {
        const visitorId = randomUUID();
        await visit({ visitorId, path: '/' });
        await visit({ visitorId, path: '/register' });

        const sessions = await testPrisma.visitor_sessions.findMany({ where: { visitor_id: visitorId } });
        expect(sessions).toHaveLength(1);
        expect(sessions[0].page_count).toBe(2);
    });

    test('a visit after the inactivity gap starts a new session and keeps the first-touch source', async () => {
        const visitorId = randomUUID();
        await visit({ visitorId, path: '/', referrer: 'https://www.instagram.com/' });
        await testPrisma.visitor_sessions.updateMany({
            where: { visitor_id: visitorId },
            data:  { last_seen_at: new Date(Date.now() - SESSION_GAP_MS - 60_000) },
        });

        await visit({ visitorId, path: '/', referrer: 'https://www.google.com/' });

        expect(await testPrisma.visitor_sessions.count({ where: { visitor_id: visitorId } })).toBe(2);
        const visitor = await testPrisma.visitors.findUnique({ where: { id: visitorId } });
        expect(visitor?.first_source).toBe('Instagram');
    });

    test('rejects a payload with a non-UUID visitor id (400)', async () => {
        const res = await visit({ visitorId: 'not-a-uuid', path: '/' });
        expect(res.status).toBe(400);
        expect(await testPrisma.visitors.count()).toBe(0);
    });

    test('ignores crawlers without recording anything (204)', async () => {
        const res = await visit({ visitorId: randomUUID(), path: '/' }, 'Googlebot/2.1 (+http://www.google.com/bot.html)');
        expect(res.status).toBe(204);
        expect(await testPrisma.visitors.count()).toBe(0);
    });
});

describe('signup links the anonymous visitor', () => {
    beforeEach(async () => {
        await testPrisma.visitors.deleteMany({});
    });

    async function register(extra: Record<string, unknown>) {
        const unique = createId().slice(0, 8);
        return request.post('/api/auth/register').send({
            fname: 'Link', lname: 'Test', email: `link-${unique}@test.com`,
            password: 'password123', phone: `+2010${Math.floor(10000000 + Math.random() * 89999999)}`,
            ...extra,
        });
    }

    test('stamps visitor_id on the new workspace when the visitor is known', async () => {
        const visitorId = randomUUID();
        await visit({ visitorId, path: '/' });

        const res = await register({ visitorId });

        expect(res.status).toBe(201);
        const workspace = await testPrisma.workspaces.findUnique({ where: { id: res.body.workspace_id } });
        expect(workspace?.visitor_id).toBe(visitorId);
    });

    test('still registers when the visitor id is unknown, leaving visitor_id empty', async () => {
        const res = await register({ visitorId: randomUUID() });

        expect(res.status).toBe(201);
        const workspace = await testPrisma.workspaces.findUnique({ where: { id: res.body.workspace_id } });
        expect(workspace?.visitor_id).toBeNull();
    });
});

describe('GET /api/admin/conversions', () => {
    let paidPlanId: string;

    beforeEach(async () => {
        await testPrisma.visitors.deleteMany({});
        await testPrisma.workspace_payments.deleteMany({ where: { plans: { display_name: 'Conversion Plan' } } });
        await testPrisma.plans.deleteMany({ where: { display_name: 'Conversion Plan' } });
        paidPlanId = (await testPrisma.plans.create({
            data: { id: createId(), name: `plan-${createId()}`, display_name: 'Conversion Plan', is_active: true },
        })).id;
    });

    afterEach(async () => {
        await testPrisma.workspace_payments.deleteMany({ where: { plan_id: paidPlanId } });
        await testPrisma.workspace_subscriptions.deleteMany({ where: { plan_id: paidPlanId } });
        await testPrisma.plans.deleteMany({ where: { id: paidPlanId } });
    });

    // A coach with no subscription row is a free coach (the Free plan is the default state).
    async function createCoach(options: {
        visitorId?: string; signedUpAt: Date; paidAt?: Date; planExpiresAt?: Date | null;
    }) {
        const owner = await createTestUser();
        const workspace = await createTestWorkspace(owner.id);
        await testPrisma.workspaces.update({
            where: { id: workspace.id },
            data:  { created_at: options.signedUpAt, visitor_id: options.visitorId ?? null },
        });
        if (options.paidAt) {
            await testPrisma.workspace_subscriptions.create({
                data: {
                    id: createId(), workspace_id: workspace.id, plan_id: paidPlanId, status: 'active',
                    expires_at: options.planExpiresAt === undefined ? new Date(Date.now() + 10 * DAY_MS) : options.planExpiresAt,
                },
            });
            await testPrisma.workspace_payments.create({
                data: {
                    id: createId(), workspace_id: workspace.id, plan_id: paidPlanId, amount: 100,
                    duration_days: 30, gateway_status: 'paid', paid_at: options.paidAt,
                },
            });
        }
        return workspace;
    }

    async function createVisitor(firstSeenAt: Date, source: string, sessionOffsetsDays: number[]) {
        const id = randomUUID();
        await testPrisma.visitors.create({ data: { id, first_seen_at: firstSeenAt, first_source: source } });
        await testPrisma.visitor_sessions.createMany({
            data: sessionOffsetsDays.map(offset => ({
                id: createId(), visitor_id: id,
                started_at: new Date(firstSeenAt.getTime() + offset * DAY_MS),
                last_seen_at: new Date(firstSeenAt.getTime() + offset * DAY_MS),
            })),
        });
        return id;
    }

    test('requires an admin (401 without one)', async () => {
        const res = await request.get('/api/admin/conversions');
        expect(res.status).toBe(401);
    });

    test('lists subscribers with days/visits, marks pre-tracking coaches unknown, and averages tracked ones only', async () => {
        const base = Date.now() - 20 * DAY_MS;
        // tracked + still subscribed: first visit day 0, visits on days 0/2/4/7, free signup day 4, pays day 6
        const subscribedVisitor = await createVisitor(new Date(base), 'Instagram', [0, 2, 4, 7]);
        await createCoach({ visitorId: subscribedVisitor, signedUpAt: new Date(base + 4 * DAY_MS), paidAt: new Date(base + 6 * DAY_MS) });
        // tracked + plan has run out: signs up and pays the next day
        const expiredVisitor = await createVisitor(new Date(base), 'Google', [0]);
        await createCoach({
            visitorId: expiredVisitor, signedUpAt: new Date(base), paidAt: new Date(base + 1 * DAY_MS),
            planExpiresAt: new Date(Date.now() - 2 * DAY_MS),
        });
        // subscribed before tracking existed
        await createCoach({ signedUpAt: new Date(base), paidAt: new Date(base + 2 * DAY_MS) });
        // free coach (tracked) + a visitor who never signed up — they only show in the funnel and totals
        const freeVisitor = await createVisitor(new Date(base), 'Instagram', [0]);
        await createCoach({ visitorId: freeVisitor, signedUpAt: new Date(base + 1 * DAY_MS) });
        await createVisitor(new Date(base), 'direct', [0]);

        const res = await request.get('/api/admin/conversions').set('Cookie', adminCookie());

        expect(res.status).toBe(200);
        expect(res.body.coaches).toHaveLength(3);

        const subscribed = res.body.coaches.find((coach: { firstSource: string }) => coach.firstSource === 'Instagram');
        expect(subscribed).toMatchObject({
            status: 'subscribed', daysToSubscribe: 6, visitsBeforeSubscribing: 3, daysOnFreeBeforePaying: 2,
        });

        const expired = res.body.coaches.find((coach: { firstSource: string }) => coach.firstSource === 'Google');
        expect(expired).toMatchObject({ status: 'expired', daysToSubscribe: 1, visitsBeforeSubscribing: 1 });

        const legacy = res.body.coaches.find((coach: { firstVisitAt: unknown }) => coach.firstVisitAt === null);
        expect(legacy).toMatchObject({
            status: 'subscribed', daysToSubscribe: null, visitsBeforeSubscribing: null, firstSource: null, daysOnFreeBeforePaying: 2,
        });

        const { summary } = res.body;
        expect(summary).toMatchObject({ totalSignups: 4, totalSubscribers: 3, trackedSubscribers: 2 });
        expect(summary.avgDaysToSubscribe).toEqual({ value: 3.5, basedOn: 2 });
        expect(summary.medianDaysToSubscribe).toBe(3.5);
        expect(summary.avgVisitsBeforeSubscribing).toEqual({ value: 2, basedOn: 2 });
        expect(summary.avgDaysOnFreeBeforePaying).toEqual({ value: 1.7, basedOn: 3 });
    });

    test('builds the funnel, source breakdown, weekly trend and time-to-subscribe buckets', async () => {
        const base = Date.now() - 20 * DAY_MS;
        const paidVisitor = await createVisitor(new Date(base), 'Instagram', [0, 3]);
        await createCoach({ visitorId: paidVisitor, signedUpAt: new Date(base + 3 * DAY_MS), paidAt: new Date(base + 6 * DAY_MS) });
        const freeVisitor = await createVisitor(new Date(base), 'Instagram', [0]);
        await createCoach({ visitorId: freeVisitor, signedUpAt: new Date(base + 1 * DAY_MS) });
        await createVisitor(new Date(base), 'direct', [0]);

        const res = await request.get('/api/admin/conversions').set('Cookie', adminCookie());

        expect(res.body.funnel).toEqual({ visitors: 3, signedUp: 2, subscribed: 1 });

        const instagram = res.body.bySource.find((row: { source: string }) => row.source === 'Instagram');
        expect(instagram).toMatchObject({ visitors: 2, signups: 2, subscribers: 1 });
        const direct = res.body.bySource.find((row: { source: string }) => row.source === 'direct');
        expect(direct).toMatchObject({ visitors: 1, signups: 0, subscribers: 0 });

        expect(res.body.weekly).toHaveLength(12);
        const weeklyTotals = res.body.weekly.reduce(
            (totals: { signups: number; subscriptions: number }, week: { signups: number; subscriptions: number }) => ({
                signups: totals.signups + week.signups, subscriptions: totals.subscriptions + week.subscriptions,
            }), { signups: 0, subscriptions: 0 });
        expect(weeklyTotals).toEqual({ signups: 2, subscriptions: 1 });

        expect(res.body.timeToSubscribe.find((bucket: { label: string }) => bucket.label === '4–7 days').count).toBe(1);
    });

    describe('manual payments', () => {
        let variationId: string;

        beforeEach(async () => {
            variationId = (await testPrisma.plan_variations.create({
                data: { id: createId(), plan_id: paidPlanId, price_monthly: 300, currency: 'EGP', is_default: true },
            })).id;
        });

        // A coach on a subscription row that is not yet paid for (applyPayment updates this row).
        async function createUnpaidCoach() {
            const workspace = await createCoach({ signedUpAt: new Date(Date.now() - 10 * DAY_MS) });
            await testPrisma.workspace_subscriptions.create({
                data: { id: createId(), workspace_id: workspace.id, plan_id: paidPlanId, status: 'active' },
            });
            return workspace;
        }

        function findCoach(body: { coaches: Array<{ workspaceId: string }> }, workspaceId: string) {
            return body.coaches.find(coach => coach.workspaceId === workspaceId) as Record<string, unknown> | undefined;
        }

        test('counts a payment you record yourself, dated by the backdated start you gave', async () => {
            const workspace = await createUnpaidCoach();
            const startDate = new Date(Date.now() - 3 * DAY_MS).toISOString().slice(0, 10);

            const recorded = await request.post(`/api/admin/workspaces/${workspace.id}/manual-payment`).set('Cookie', adminCookie())
                .send({ planId: paidPlanId, variationId, amount: 300, startDate, notes: 'cash at the gym' });
            expect(recorded.status).toBe(201);

            const res = await request.get('/api/admin/conversions').set('Cookie', adminCookie());
            const coach = findCoach(res.body, workspace.id);

            expect(coach).toMatchObject({ paidVia: 'admin', paidAmount: 300, paidCurrency: 'EGP' });
            // the real start date wins over the moment the payment was typed in
            expect(new Date(coach!.paidAt as string).toISOString()).toBe(new Date(startDate).toISOString());
            expect(res.body.paidVia).toEqual([{ method: 'admin', count: 1 }]);
        });

        test('ignores a 0 EGP free grant everywhere a subscriber is counted', async () => {
            const visitorId = await createVisitor(new Date(Date.now() - 12 * DAY_MS), 'Instagram', [0]);
            const workspace = await createCoach({ visitorId, signedUpAt: new Date(Date.now() - 10 * DAY_MS) });
            await testPrisma.workspace_payments.create({
                data: {
                    id: createId(), workspace_id: workspace.id, plan_id: paidPlanId, variation_id: variationId, amount: 0,
                    duration_days: 30, gateway_status: 'paid', paid_at: new Date(Date.now() - 2 * DAY_MS),
                },
            });

            const res = await request.get('/api/admin/conversions').set('Cookie', adminCookie());

            expect(findCoach(res.body, workspace.id)).toBeUndefined();
            expect(res.body.summary.totalSubscribers).toBe(0);
            expect(res.body.funnel).toEqual({ visitors: 1, signedUp: 1, subscribed: 0 });
            expect(res.body.weekly.reduce((sum: number, week: { subscriptions: number }) => sum + week.subscriptions, 0)).toBe(0);
        });

        test('counts a payment you record without a start date as of now', async () => {
            const workspace = await createUnpaidCoach();

            await request.post(`/api/admin/workspaces/${workspace.id}/manual-payment`).set('Cookie', adminCookie())
                .send({ planId: paidPlanId, variationId, amount: 300 });

            const res = await request.get('/api/admin/conversions').set('Cookie', adminCookie());
            const coach = findCoach(res.body, workspace.id);

            expect(coach).toMatchObject({ paidVia: 'admin' });
            expect(Math.abs(new Date(coach!.paidAt as string).getTime() - Date.now())).toBeLessThan(60_000);
        });

        test("leaves a coach's own manual transfer out until you confirm it, then labels it Manual transfer", async () => {
            const workspace = await createUnpaidCoach();
            const payment = await testPrisma.workspace_payments.create({
                data: {
                    id: createId(), workspace_id: workspace.id, plan_id: paidPlanId, variation_id: variationId, amount: 300,
                    duration_days: 30, gateway_status: 'pending', payment_method: 'manual', reference_code: `REF-${createId().slice(0, 8)}`,
                },
            });

            const before = await request.get('/api/admin/conversions').set('Cookie', adminCookie());
            expect(findCoach(before.body, workspace.id)).toBeUndefined();

            const confirmed = await request.post(`/api/admin/payments/${payment.id}/mark-paid`).set('Cookie', adminCookie());
            expect(confirmed.status).toBe(200);

            const after = await request.get('/api/admin/conversions').set('Cookie', adminCookie());
            expect(findCoach(after.body, workspace.id)).toMatchObject({ paidVia: 'manual', paidAmount: 300 });
        });
    });
});
