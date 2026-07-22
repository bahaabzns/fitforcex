import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import * as insightsService from '../../src/modules/insights/insights.service';

function makeAdminCookie(id = 'test-admin-id'): string {
    const token = jwt.sign({ isAdmin: true, id }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' });
    return `admin_token=${token}`;
}

async function makeClientFixture(overrides: Record<string, unknown> = {}) {
    const user = await createTestUser();
    const workspace = await createTestWorkspace(user.id);
    const client = await testPrisma.clients.create({
        data: {
            id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
            fname: 'C', lname: 'Lient', email: `client-${createId()}@test.com`, workspace_id: workspace.id,
            ...overrides,
        },
    });
    return { user, workspace, client, cookie: makeClientCookie(client.id, workspace.id) };
}

describe('Insights System — Phase 3 (contextual triggers)', () => {
    test('first_workout_logged: null before the first log, eligible right after, null again after the second', async () => {
        const { workspace, client, cookie } = await makeClientFixture();
        await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'How was your first workout?', responseType: 'rating', targetAudience: 'client', triggerEvent: 'first_workout_logged' },
            'admin-1',
        );

        const before = await request.get('/api/client-portal/prompts/for-trigger/first_workout_logged').set('Cookie', cookie);
        expect(before.body).toBeNull();

        await testPrisma.workout_logs.create({
            data: { id: createId(), client_id: client.id, workspace_id: workspace.id, date: new Date(), completed: true },
        });

        const after = await request.get('/api/client-portal/prompts/for-trigger/first_workout_logged').set('Cookie', cookie);
        expect(after.body?.question_en).toBe('How was your first workout?');

        await testPrisma.workout_logs.create({
            data: { id: createId(), client_id: client.id, workspace_id: workspace.id, date: new Date(), completed: true },
        });
        const afterSecond = await request.get('/api/client-portal/prompts/for-trigger/first_workout_logged').set('Cookie', cookie);
        expect(afterSecond.body).toBeNull();
    });

    test('returns 400 for an unknown trigger event', async () => {
        const { cookie } = await makeClientFixture();
        const res = await request.get('/api/client-portal/prompts/for-trigger/not-a-real-trigger').set('Cookie', cookie);
        expect(res.status).toBe(400);
    });

    test('dismissing a contextual prompt persists — it stays hidden even though the trigger condition still holds', async () => {
        const { workspace, client, cookie } = await makeClientFixture();
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'First workout feedback?', responseType: 'text', targetAudience: 'client', triggerEvent: 'first_workout_logged' },
            'admin-1',
        );
        await testPrisma.workout_logs.create({
            data: { id: createId(), client_id: client.id, workspace_id: workspace.id, date: new Date(), completed: true },
        });

        const eligible = await request.get('/api/client-portal/prompts/for-trigger/first_workout_logged').set('Cookie', cookie);
        expect(eligible.body?.id).toBe(prompt.id);

        const dismiss = await request.post(`/api/client-portal/prompts/${prompt.id}/dismiss`).set('Cookie', cookie);
        expect(dismiss.status).toBe(200);

        const afterDismiss = await request.get('/api/client-portal/prompts/for-trigger/first_workout_logged').set('Cookie', cookie);
        expect(afterDismiss.body).toBeNull();
    });

    test('activating a second prompt on the same trigger ends the first; a different trigger stays independent', async () => {
        const first = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'v1', responseType: 'text', targetAudience: 'client', triggerEvent: 'first_workout_logged' },
            'admin-1',
        );
        const otherTrigger = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'checkin q', responseType: 'text', targetAudience: 'client', triggerEvent: 'first_checkin_completed' },
            'admin-1',
        );
        const manual = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'manual q', responseType: 'text', targetAudience: 'client' },
            'admin-1',
        );

        await request.post('/api/admin/prompts').set('Cookie', makeAdminCookie()).send({
            questionEn: 'v2', responseType: 'text', targetAudience: 'client', triggerEvent: 'first_workout_logged',
        });

        const firstAfter = await testPrisma.insight_prompts.findUnique({ where: { id: first.id } });
        expect(firstAfter?.status).toBe('ended');

        const otherAfter = await testPrisma.insight_prompts.findUnique({ where: { id: otherTrigger.id } });
        expect(otherAfter?.status).toBe('active');

        const manualAfter = await testPrisma.insight_prompts.findUnique({ where: { id: manual.id } });
        expect(manualAfter?.status).toBe('active');
    });
});

describe('Insights System — Phase 4 (research platform)', () => {
    test('a prompt scheduled in the future is not eligible until starts_at, and expireScheduledPrompts ends it after ends_at', async () => {
        const { workspace, cookie } = await makeClientFixture();
        const future = new Date(Date.now() + 60_000);
        const past = new Date(Date.now() - 60_000);

        const res = await request.post('/api/admin/prompts').set('Cookie', makeAdminCookie()).send({
            questionEn: 'Scheduled campaign', responseType: 'text', targetAudience: 'everyone', startsAt: future.toISOString(),
        });
        expect(res.status).toBe(201);

        const notYet = await request.get('/api/client-portal/prompts/active').set('Cookie', cookie);
        expect(notYet.body).toBeNull();

        await testPrisma.insight_prompts.update({ where: { id: res.body.id }, data: { starts_at: past, ends_at: past } });
        const expiredCount = await insightsService.expireScheduledPrompts();
        expect(expiredCount).toBeGreaterThanOrEqual(1);

        const promptAfter = await testPrisma.insight_prompts.findUnique({ where: { id: res.body.id } });
        expect(promptAfter?.status).toBe('ended');
    });

    test('max_shows_per_user stops eligibility once the cap is hit', async () => {
        const { cookie } = await makeClientFixture();
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Capped', responseType: 'text', targetAudience: 'client', maxShowsPerUser: 2 },
            'admin-1',
        );

        const first = await request.get('/api/client-portal/prompts/active').set('Cookie', cookie);
        expect(first.body?.id).toBe(prompt.id);
        const second = await request.get('/api/client-portal/prompts/active').set('Cookie', cookie);
        expect(second.body?.id).toBe(prompt.id);
        const third = await request.get('/api/client-portal/prompts/active').set('Cookie', cookie);
        expect(third.body).toBeNull();
    });

    test('allow_concurrent skips exclusivity in both directions', async () => {
        const exclusive = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'exclusive', responseType: 'text', targetAudience: 'everyone' },
            'admin-1',
        );
        const concurrent = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'concurrent campaign', responseType: 'text', targetAudience: 'everyone', allowConcurrent: true },
            'admin-1',
        );

        // exclusive should still be active — the concurrent one didn't end it
        const exclusiveAfter = await testPrisma.insight_prompts.findUnique({ where: { id: exclusive.id } });
        expect(exclusiveAfter?.status).toBe('active');

        // a NEW exclusive prompt ends the old exclusive one but not the concurrent one
        await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'newer exclusive', responseType: 'text', targetAudience: 'everyone' },
            'admin-1',
        );
        const exclusiveAfter2 = await testPrisma.insight_prompts.findUnique({ where: { id: exclusive.id } });
        expect(exclusiveAfter2?.status).toBe('ended');
        const concurrentAfter = await testPrisma.insight_prompts.findUnique({ where: { id: concurrent.id } });
        expect(concurrentAfter?.status).toBe('active');
    });

    test('multi-workspace targeting only surfaces the prompt in the chosen workspaces', async () => {
        const { workspace: workspaceA, cookie: cookieA } = await makeClientFixture();
        const { cookie: cookieB } = await makeClientFixture();

        await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Workspace A only', responseType: 'text', targetAudience: 'client', workspaceIds: [workspaceA.id] },
            'admin-1',
        );

        const inA = await request.get('/api/client-portal/prompts/active').set('Cookie', cookieA);
        expect(inA.body?.question_en).toBe('Workspace A only');

        const inB = await request.get('/api/client-portal/prompts/active').set('Cookie', cookieB);
        expect(inB.body).toBeNull();
    });

    test('conditions: only a client whose subscription_status matches sees the prompt; a coach never does', async () => {
        const { cookie: activeCookie } = await makeClientFixture({ subscription_status: 'Active' });
        const { cookie: expiredCookie } = await makeClientFixture({ subscription_status: 'Expired' });
        const coach = await createTestUser();
        const coachWorkspace = await createTestWorkspace(coach.id);
        const coachCookie = await makeAuthCookie(coach.id, coachWorkspace.id, 'owner');

        await insightsService.activatePrompt(
            {
                workspaceId: null, questionEn: 'Active clients only', responseType: 'text', targetAudience: 'everyone',
                conditions: [{ field: 'subscription_status', value: 'Active' }],
            },
            'admin-1',
        );

        const activeRes = await request.get('/api/client-portal/prompts/active').set('Cookie', activeCookie);
        expect(activeRes.body?.question_en).toBe('Active clients only');

        const expiredRes = await request.get('/api/client-portal/prompts/active').set('Cookie', expiredCookie);
        expect(expiredRes.body).toBeNull();

        const coachRes = await request.get('/api/insights/prompts/active').set('Cookie', coachCookie);
        expect(coachRes.body).toBeNull();
    });

    test('analytics funnel: sent/started/completed and an NPS-style rating breakdown', async () => {
        const { cookie: cookieA } = await makeClientFixture();
        const { cookie: cookieB } = await makeClientFixture();

        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Rate us', responseType: 'rating', targetAudience: 'client' },
            'admin-1',
        );

        // Client A: fetches it (sent), starts it, then answers 9 (promoter).
        await request.get('/api/client-portal/prompts/active').set('Cookie', cookieA);
        await request.post(`/api/client-portal/prompts/${prompt.id}/started`).set('Cookie', cookieA);
        await request.post(`/api/client-portal/prompts/${prompt.id}/respond`).set('Cookie', cookieA).send({ ratingValue: 9 });

        // Client B: only fetches it (sent), never answers.
        await request.get('/api/client-portal/prompts/active').set('Cookie', cookieB);

        const analytics = await request.get(`/api/admin/prompts/${prompt.id}/analytics`).set('Cookie', makeAdminCookie());
        expect(analytics.status).toBe(200);
        expect(analytics.body.sent).toBe(2);
        expect(analytics.body.started).toBe(1);
        expect(analytics.body.completed).toBe(1);
        expect(analytics.body.rating.promoters).toBe(1);
        expect(analytics.body.rating.passives).toBe(0);
        expect(analytics.body.rating.detractors).toBe(0);
        expect(analytics.body.rating.average).toBe(9);
    });
});
