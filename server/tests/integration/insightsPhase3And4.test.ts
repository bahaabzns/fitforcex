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

describe('Insights System — rating_with_text response type', () => {
    test('rejects a response with no ratingValue, accepts one with an optional note, accepts one with no note', async () => {
        const { cookie } = await makeClientFixture();
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'How has it been going?', responseType: 'rating_with_text', targetAudience: 'client' },
            'admin-1',
        );

        const missingRating = await request.post(`/api/client-portal/prompts/${prompt.id}/respond`).set('Cookie', cookie).send({ textValue: 'no rating here' });
        expect(missingRating.status).toBe(400);

        const withNote = await request.post(`/api/client-portal/prompts/${prompt.id}/respond`).set('Cookie', cookie).send({ ratingValue: 7, textValue: 'a bit slow lately' });
        expect(withNote.status).toBe(201);
        expect(withNote.body.rating_value).toBe(7);
        expect(withNote.body.text_value).toBe('a bit slow lately');

        const withoutNote = await request.post(`/api/client-portal/prompts/${prompt.id}/respond`).set('Cookie', cookie).send({ ratingValue: 5 });
        expect(withoutNote.status).toBe(201);
        expect(withoutNote.body.rating_value).toBe(5);
        expect(withoutNote.body.text_value).toBeNull();
    });

    test('the analytics funnel buckets rating_with_text the same way as a plain rating', async () => {
        const { cookie } = await makeClientFixture();
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Pulse check', responseType: 'rating_with_text', targetAudience: 'client' },
            'admin-1',
        );
        await request.post(`/api/client-portal/prompts/${prompt.id}/respond`).set('Cookie', cookie).send({ ratingValue: 3, textValue: 'rough week' });

        const analytics = await request.get(`/api/admin/prompts/${prompt.id}/analytics`).set('Cookie', makeAdminCookie());
        expect(analytics.body.rating.detractors).toBe(1);
        expect(analytics.body.rating.average).toBe(3);
    });
});

describe('Insights System — repeat_interval_days (recurring pulse prompts)', () => {
    test('without repeat_interval_days, answering excludes the submitter forever', async () => {
        const { cookie } = await makeClientFixture();
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Ask-once pulse', responseType: 'rating', targetAudience: 'client' },
            'admin-1',
        );
        await request.post(`/api/client-portal/prompts/${prompt.id}/respond`).set('Cookie', cookie).send({ ratingValue: 8 });

        const after = await request.get('/api/client-portal/prompts/active').set('Cookie', cookie);
        expect(after.body).toBeNull();
    });

    test('with repeat_interval_days, the submitter is excluded only until the interval elapses', async () => {
        const { cookie } = await makeClientFixture();
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Bi-weekly pulse', responseType: 'rating', targetAudience: 'client', repeatIntervalDays: 14 },
            'admin-1',
        );

        const before = await request.get('/api/client-portal/prompts/active').set('Cookie', cookie);
        expect(before.body?.id).toBe(prompt.id);

        const respond = await request.post(`/api/client-portal/prompts/${prompt.id}/respond`).set('Cookie', cookie).send({ ratingValue: 8 });
        expect(respond.status).toBe(201);

        const justAfter = await request.get('/api/client-portal/prompts/active').set('Cookie', cookie);
        expect(justAfter.body).toBeNull();

        // Simulate 15 days passing since the response was recorded.
        await testPrisma.insights.update({
            where: { id: respond.body.id },
            data: { created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
        });

        const afterInterval = await request.get('/api/client-portal/prompts/active').set('Cookie', cookie);
        expect(afterInterval.body?.id).toBe(prompt.id);
    });

    test('rejects repeatIntervalDays on a contextual prompt — getPromptForTrigger has no repeat logic, so it would silently never recur', async () => {
        const res = await request.post('/api/admin/prompts').set('Cookie', makeAdminCookie()).send({
            questionEn: 'Contextual with a bogus repeat', responseType: 'text', targetAudience: 'client',
            triggerEvent: 'first_checkin_completed', repeatIntervalDays: 14,
        });
        expect(res.status).toBe(400);
    });
});

describe('Insights System — endPrompt only ever ends the one prompt it targets', () => {
    test('endPrompt rejects a falsy id instead of matching every active prompt (Prisma drops undefined where-fields, not matches-none)', async () => {
        const a = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Keep me active A', responseType: 'text', targetAudience: 'everyone', allowConcurrent: true },
            'admin-1',
        );
        const b = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Keep me active B', responseType: 'text', targetAudience: 'everyone', allowConcurrent: true },
            'admin-1',
        );

        await expect(insightsService.endPrompt(undefined as unknown as string)).rejects.toThrow();
        await expect(insightsService.endPrompt('')).rejects.toThrow();

        const aAfter = await testPrisma.insight_prompts.findUnique({ where: { id: a.id } });
        const bAfter = await testPrisma.insight_prompts.findUnique({ where: { id: b.id } });
        expect(aAfter?.status).toBe('active');
        expect(bAfter?.status).toBe('active');
    });

    test('PATCH /admin/prompts/:id/end ends only the targeted prompt, leaving siblings active', async () => {
        const target = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'End me', responseType: 'text', targetAudience: 'everyone', allowConcurrent: true },
            'admin-1',
        );
        const sibling = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Do not end me', responseType: 'text', targetAudience: 'everyone', allowConcurrent: true },
            'admin-1',
        );

        const res = await request.patch(`/api/admin/prompts/${target.id}/end`).set('Cookie', makeAdminCookie());
        expect(res.status).toBe(200);

        const targetAfter = await testPrisma.insight_prompts.findUnique({ where: { id: target.id } });
        const siblingAfter = await testPrisma.insight_prompts.findUnique({ where: { id: sibling.id } });
        expect(targetAfter?.status).toBe('ended');
        expect(siblingAfter?.status).toBe('active');
    });

    test('PATCH /admin/prompts/ /end (id param effectively blank) is rejected with 400', async () => {
        const res = await request.patch('/api/admin/prompts/%20/end').set('Cookie', makeAdminCookie());
        expect(res.status).toBe(400);
    });
});

describe('Insights System — reactivating an ended prompt', () => {
    test('reactivating a plain ended prompt with no competitors just flips it back to active', async () => {
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Solo prompt', responseType: 'text', targetAudience: 'everyone' },
            'admin-1',
        );
        await insightsService.endPrompt(prompt.id);

        const res = await request.patch(`/api/admin/prompts/${prompt.id}/reactivate`).set('Cookie', makeAdminCookie());
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('active');
        expect(res.body.ended_at).toBeNull();
    });

    test('reactivating re-runs the exclusivity gate — it ends whichever prompt currently holds the overlapping-audience slot', async () => {
        const original = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Original manual prompt', responseType: 'text', targetAudience: 'user' },
            'admin-1',
        );
        await insightsService.endPrompt(original.id);

        const newer = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Newer manual prompt', responseType: 'text', targetAudience: 'everyone' },
            'admin-1',
        );

        const res = await request.patch(`/api/admin/prompts/${original.id}/reactivate`).set('Cookie', makeAdminCookie());
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('active');

        const newerAfter = await testPrisma.insight_prompts.findUnique({ where: { id: newer.id } });
        expect(newerAfter?.status).toBe('ended');
    });

    test('reactivating an already-active prompt is a harmless no-op', async () => {
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Already active', responseType: 'text', targetAudience: 'everyone' },
            'admin-1',
        );
        const res = await request.patch(`/api/admin/prompts/${prompt.id}/reactivate`).set('Cookie', makeAdminCookie());
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('active');
    });

    test('returns 404 for a nonexistent prompt id', async () => {
        const res = await request.patch('/api/admin/prompts/not-a-real-id/reactivate').set('Cookie', makeAdminCookie());
        expect(res.status).toBe(404);
    });
});

describe('Insights System — editing a prompt question (content only)', () => {
    test('updates question_en/question_ar and leaves audience, trigger, response type, and status untouched', async () => {
        const prompt = await insightsService.activatePrompt(
            {
                workspaceId: null, questionEn: 'Original wording', responseType: 'rating_with_text',
                targetAudience: 'client', triggerEvent: 'first_checkin_completed',
            },
            'admin-1',
        );

        const res = await request.patch(`/api/admin/prompts/${prompt.id}/question`).set('Cookie', makeAdminCookie()).send({
            questionEn: 'Reworded question', questionAr: 'سؤال معدل',
        });
        expect(res.status).toBe(200);
        expect(res.body.question_en).toBe('Reworded question');
        expect(res.body.question_ar).toBe('سؤال معدل');
        expect(res.body.target_audience).toBe('client');
        expect(res.body.trigger_event).toBe('first_checkin_completed');
        expect(res.body.response_type).toBe('rating_with_text');
        expect(res.body.status).toBe('active');
    });

    test('rejects an empty questionEn', async () => {
        const prompt = await insightsService.activatePrompt(
            { workspaceId: null, questionEn: 'Original wording', responseType: 'text', targetAudience: 'everyone' },
            'admin-1',
        );
        const res = await request.patch(`/api/admin/prompts/${prompt.id}/question`).set('Cookie', makeAdminCookie()).send({ questionEn: '   ' });
        expect(res.status).toBe(400);
    });

    test('returns 404 for a nonexistent prompt id', async () => {
        const res = await request.patch('/api/admin/prompts/not-a-real-id/question').set('Cookie', makeAdminCookie()).send({ questionEn: 'New text' });
        expect(res.status).toBe(404);
    });
});
