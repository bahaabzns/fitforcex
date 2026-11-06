import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';
import { createTestUser, createTestWorkspace, makeAuthCookie, request } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { ensureDemoClient, deleteDemoClient } from '../../src/modules/demoClient/demoClient.service';
import { DEMO_CLIENT, DEMO_DIET, DEMO_MESSAGES, DEMO_OBSERVATIONS, DEMO_PROGRESS } from '../../src/modules/demoClient/demoClient.content';
import { checkClientLimit, getWorkspaceUsageCounts } from '../../src/lib/seatLimits';

const PLAN_NAME = 'demo-client-test-plan';

async function seedLibraries(workspaceId: string) {
    const foodNames = DEMO_DIET.days.flatMap((day) => day.meals.flatMap((meal) => meal.items.map(([name]) => name as string)));
    await testPrisma.food_items.createMany({
        data: [...new Set(foodNames)].map((name) => ({
            id: createId(), workspace_id: workspaceId, name_en: name, calories_per_serving: 100, protein_per_serving: 10, carbs_per_serving: 10, fats_per_serving: 2,
            serving_size: 100, serving_unit: 'g',
        })),
    });
    await testPrisma.exercise_library.createMany({
        data: ['Barbell Bench Press', 'Lat Pulldown', 'Back Squat'].map((name) => ({ id: createId(), workspace_id: workspaceId, name_en: name, muscle_group: 'X', equipment: 'Barbell' })),
    });
}

async function createCoach(maxClients: number | null = 3, withLibraries = true) {
    const user = await createTestUser();
    const workspace = await createTestWorkspace(user.id);
    const plan = await testPrisma.plans.upsert({
        where: { name: PLAN_NAME }, update: {},
        create: { id: createId(), name: PLAN_NAME, display_name: 'Demo Test', duration_days: 30, max_team_seats: 5 },
    });
    const variation = await testPrisma.plan_variations.create({
        data: { id: createId(), plan_id: plan.id, max_clients: maxClients, max_team_seats: 5, price_monthly: 0, currency: 'EGP', sort_order: Math.floor(Math.random() * 1e6) },
    });
    await testPrisma.workspace_subscriptions.create({
        data: { id: createId(), workspace_id: workspace.id, plan_id: plan.id, variation_id: variation.id, status: 'active' },
    });
    if (withLibraries) await seedLibraries(workspace.id);
    const cookie = await makeAuthCookie(user.id, workspace.id);
    return { user, workspace, cookie };
}

async function addRealClient(workspaceId: string, code: number) {
    return testPrisma.clients.create({
        data: { id: createId(), client_code: code, fname: 'Real', lname: `Client${code}`, email: `real${code}-${createId()}@test.com`, workspace_id: workspaceId },
    });
}

describe('Demo client', () => {
    it('creates one demo client with every kind of sample data, all marked as demo', async () => {
        const { workspace, user } = await createCoach();

        await ensureDemoClient(workspace.id);

        const demo = await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } });
        expect(demo.email).toBe(DEMO_CLIENT.email);
        const [nutrition, training, requests, messages, observations, transactions, packages, methods, forms, measurements] = await Promise.all([
            testPrisma.nutrition_plans.findMany({ where: { client_id: demo.id }, include: { nutrition_cycles: { include: { nutrition_meals: { include: { nutrition_meal_items: true } } } } } }),
            testPrisma.training_plans.findMany({ where: { client_id: demo.id }, include: { training_days: true } }),
            testPrisma.form_requests.findMany({ where: { client_id: demo.id }, include: { form_responses: true } }),
            testPrisma.messages.count({ where: { thread_id: (await testPrisma.threads.findFirstOrThrow({ where: { client_id: demo.id } })).id } }),
            testPrisma.client_observations.findMany({ where: { client_id: demo.id } }),
            testPrisma.transactions.findMany({ where: { workspace_id: workspace.id } }),
            testPrisma.packages.findMany({ where: { workspace_id: workspace.id }, include: { package_variations: true } }),
            testPrisma.payment_methods.findMany({ where: { workspace_id: workspace.id } }),
            testPrisma.forms.findMany({ where: { workspace_id: workspace.id } }),
            testPrisma.client_measurements.findFirst({ where: { client_id: demo.id } }),
        ]);

        expect(nutrition).toHaveLength(1);
        expect(nutrition[0].name).toContain('not a treatment plan');
        expect(nutrition[0].nutrition_cycles).toHaveLength(DEMO_DIET.days.length);
        expect(nutrition[0].nutrition_cycles.every((cycle) => cycle.nutrition_meals.every((meal) => meal.nutrition_meal_items.length > 0))).toBe(true);
        expect(training).toHaveLength(1);
        expect(training[0].training_days.length).toBeGreaterThan(0);
        expect(requests).toHaveLength(DEMO_PROGRESS.checkIns.length + 1);
        // The newest check-in waits in the queue; the earlier ones are reviewed and NOT archived (charts skip archived ones).
        expect(requests.filter((request) => request.status === 'submitted' && !request.archived_at)).toHaveLength(1);
        expect(requests.filter((request) => request.status === 'reviewed' && !request.archived_at)).toHaveLength(DEMO_PROGRESS.checkIns.length - 1);
        expect(requests.filter((request) => request.archived_at)).toHaveLength(1);   // only the intake assessment
        expect(messages).toBe(DEMO_MESSAGES.length);
        expect(observations).toHaveLength(DEMO_OBSERVATIONS.length);
        expect(observations.some((observation) => observation.title.includes('التاريخ الطبي'))).toBe(true);
        expect(observations.every((observation) => observation.author_id === user.id)).toBe(true);
        expect(transactions.length).toBeGreaterThan(0);
        expect(transactions.every((transaction) => transaction.is_demo && transaction.client_id === demo.id)).toBe(true);
        expect(packages.every((p) => p.is_demo && p.name.startsWith('Demo'))).toBe(true);
        expect(methods.every((method) => method.is_demo)).toBe(true);
        expect(forms.every((form) => form.is_demo)).toBe(true);
        expect(measurements).not.toBeNull();

        // Progress shows improvement: the metric answers for weight go down week over week.
        const weightMetric = await testPrisma.metrics.findFirstOrThrow({ where: { workspace_id: workspace.id, name: 'Weight' } });
        const weights = (await testPrisma.form_responses.findMany({ where: { metric_id: weightMetric.id }, orderBy: { created_at: 'asc' } })).map((row) => Number(row.answer));
        expect(weights).toHaveLength(DEMO_PROGRESS.checkIns.length);
        expect(weights[weights.length - 1]).toBeLessThan(weights[0]);
    });

    it('is created only once and not for a coach who already has a real client', async () => {
        const { workspace } = await createCoach();
        await ensureDemoClient(workspace.id);
        await ensureDemoClient(workspace.id);
        expect(await testPrisma.clients.count({ where: { workspace_id: workspace.id, is_demo: true } })).toBe(1);

        const withRealClient = await createCoach();
        await addRealClient(withRealClient.workspace.id, 1);
        await ensureDemoClient(withRealClient.workspace.id);
        expect(await testPrisma.clients.count({ where: { workspace_id: withRealClient.workspace.id, is_demo: true } })).toBe(0);
    });

    it('waits until the libraries are copied into a new workspace', async () => {
        const { workspace } = await createCoach();
        await testPrisma.workspaces.update({ where: { id: workspace.id }, data: { clone_status: 'pending' } });

        await ensureDemoClient(workspace.id);
        expect(await testPrisma.clients.count({ where: { workspace_id: workspace.id } })).toBe(0);

        await testPrisma.workspaces.update({ where: { id: workspace.id }, data: { clone_status: 'ready' } });
        await ensureDemoClient(workspace.id);
        expect(await testPrisma.clients.count({ where: { workspace_id: workspace.id, is_demo: true } })).toBe(1);
    });

    it('does not use up the free-client limit', async () => {
        const { workspace } = await createCoach(1);
        await ensureDemoClient(workspace.id);

        await expect(checkClientLimit(workspace.id)).resolves.toBeUndefined();
        expect((await getWorkspaceUsageCounts(workspace.id)).clientCount).toBe(0);

        await addRealClient(workspace.id, 2);
        await expect(checkClientLimit(workspace.id)).rejects.toMatchObject({ status: 403 });
    });

    it('is left out of dashboard stats and shown with its payments flagged as demo', async () => {
        const { workspace, cookie } = await createCoach();
        await ensureDemoClient(workspace.id);

        const dashboard = await request.get('/api/dashboard').set('Cookie', cookie);
        expect(dashboard.status).toBe(200);
        expect(dashboard.body.stats.totalClients).toBe(0);
        expect(dashboard.body.recentClients).toHaveLength(0);

        const clients = await request.get('/api/clients').set('Cookie', cookie);
        expect(clients.body.data.some((client: { is_demo: boolean }) => client.is_demo)).toBe(true);

        const transactions = await request.get('/api/transactions').set('Cookie', cookie);
        expect(transactions.body.data.length).toBeGreaterThan(0);
        expect(transactions.body.data.every((transaction: { isDemo: boolean }) => transaction.isDemo)).toBe(true);
    });

    it('reports status through the API and creates the demo on first call', async () => {
        const { workspace, cookie } = await createCoach();

        const first = await request.get('/api/demo-client').set('Cookie', cookie);
        expect(first.status).toBe(200);
        expect(first.body).toMatchObject({ hasDemoClient: true, showWelcome: true, portalSlug: workspace.slug, login: { email: DEMO_CLIENT.email } });

        await request.post('/api/demo-client/welcome-seen').set('Cookie', cookie);
        const second = await request.get('/api/demo-client').set('Cookie', cookie);
        expect(second.body.showWelcome).toBe(false);
        expect(await testPrisma.demo_client_events.count({ where: { workspace_id: workspace.id, event_type: 'welcome_seen' } })).toBe(1);
    });

    it('records opened, edited and viewed-in-app the first time each happens', async () => {
        const { workspace, cookie } = await createCoach();
        await ensureDemoClient(workspace.id);
        const demo = await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } });

        await request.get(`/api/clients/${demo.id}`).set('Cookie', cookie);
        await request.post('/api/nutrition/plans/save-draft').set('Cookie', cookie).send({ clientId: demo.id, plans: [] });
        await request.post('/api/client-portal/login').send({ email: DEMO_CLIENT.email, password: DEMO_CLIENT.password, workspace_slug: workspace.slug });

        // The tracker writes in the background, so wait for the events to land.
        await new Promise((resolve) => setTimeout(resolve, 300));
        const types = (await testPrisma.demo_client_events.findMany({ where: { workspace_id: workspace.id } })).map((event) => event.event_type).sort();
        expect(types).toEqual(['demo_created', 'edited', 'opened', 'viewed_app']);
    });

    it('is not tracked for a real client', async () => {
        const { workspace, cookie } = await createCoach();
        const real = await addRealClient(workspace.id, 1);

        await request.get(`/api/clients/${real.id}`).set('Cookie', cookie);
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(await testPrisma.demo_client_events.count({ where: { workspace_id: workspace.id } })).toBe(0);
    });

    it('deletes the demo client and all its demo data, and it never comes back', async () => {
        const { workspace, cookie } = await createCoach();
        await request.get('/api/demo-client').set('Cookie', cookie);

        const deleted = await request.delete('/api/demo-client').set('Cookie', cookie);
        expect(deleted.status).toBe(200);

        const [clients, plans, training, transactions, packages, methods, forms, threads, observations, requests] = await Promise.all([
            testPrisma.clients.count({ where: { workspace_id: workspace.id } }),
            testPrisma.nutrition_plans.count({ where: { workspace_id: workspace.id } }),
            testPrisma.training_plans.count({ where: { workspace_id: workspace.id } }),
            testPrisma.transactions.count({ where: { workspace_id: workspace.id } }),
            testPrisma.packages.count({ where: { workspace_id: workspace.id } }),
            testPrisma.payment_methods.count({ where: { workspace_id: workspace.id } }),
            testPrisma.forms.count({ where: { workspace_id: workspace.id } }),
            testPrisma.threads.count({ where: { workspace_id: workspace.id } }),
            testPrisma.client_observations.count({ where: { workspace_id: workspace.id } }),
            testPrisma.form_requests.count({ where: { workspace_id: workspace.id } }),
        ]);
        expect([clients, plans, training, transactions, packages, methods, forms, threads, observations, requests]).toEqual(Array(10).fill(0));
        expect(await testPrisma.messages.count()).toBe(0);

        await ensureDemoClient(workspace.id);
        const again = await request.get('/api/demo-client').set('Cookie', cookie);
        expect(again.body.hasDemoClient).toBe(false);
        expect(await deleteDemoClient(workspace.id)).toBe(false);
        expect(await testPrisma.demo_client_events.count({ where: { workspace_id: workspace.id, event_type: 'deleted' } })).toBe(1);
    });

    it('keeps a demo package that a real client has started using', async () => {
        const { workspace } = await createCoach();
        await ensureDemoClient(workspace.id);
        const variation = await testPrisma.package_variations.findFirstOrThrow({ where: { packages: { workspace_id: workspace.id } } });
        const real = await addRealClient(workspace.id, 2);
        await testPrisma.clients.update({ where: { id: real.id }, data: { current_package_variation_id: variation.id } });

        await deleteDemoClient(workspace.id);

        const kept = await testPrisma.packages.findFirstOrThrow({ where: { workspace_id: workspace.id } });
        expect(kept.is_demo).toBe(false);
        expect(await testPrisma.clients.count({ where: { workspace_id: workspace.id } })).toBe(1);
    });

    it('reports the signup to first-real-client rate before and after launch, and the demo funnel', async () => {
        const adminCookie = `admin_token=${jwt.sign({ isAdmin: true, id: 'test-admin' }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' })}`;
        const DAY_MS = 24 * 60 * 60 * 1000;

        // Signed up 30 days ago, before the demo existed, and never added a client.
        const older = await createCoach();
        await testPrisma.workspaces.update({ where: { id: older.workspace.id }, data: { created_at: new Date(Date.now() - 30 * DAY_MS) } });

        // Signed up 10 days ago, got the demo, opened it, then added a real client 2 days after the demo appeared.
        const newer = await createCoach();
        const demoCreatedAt = new Date(Date.now() - 10 * DAY_MS);
        await testPrisma.workspaces.update({ where: { id: newer.workspace.id }, data: { created_at: demoCreatedAt } });
        await ensureDemoClient(newer.workspace.id);
        await testPrisma.workspaces.update({ where: { id: newer.workspace.id }, data: { demo_client_created_at: demoCreatedAt } });
        await testPrisma.demo_client_events.create({ data: { id: createId(), workspace_id: newer.workspace.id, event_type: 'opened' } });
        const real = await addRealClient(newer.workspace.id, 2);
        await testPrisma.clients.update({ where: { id: real.id }, data: { created_at: new Date(demoCreatedAt.getTime() + 2 * DAY_MS) } });

        const report = await request.get('/api/admin/demo-client-report').set('Cookie', adminCookie);

        expect(report.status).toBe(200);
        expect(report.body.cohorts.before).toMatchObject({ signups: 1, withRealClient: 0, rate: 0 });
        expect(report.body.cohorts.after).toMatchObject({ signups: 1, withRealClient: 1, rate: 100, rateWithinWindow: 100, medianDaysToFirstRealClient: 2 });
        expect(report.body.withDemo).toMatchObject({ coaches: 1, addedRealClientAfter: 1, medianDaysToFirstRealClient: 2 });
        expect(report.body.funnel.find((step: { key: string }) => step.key === 'opened').coaches).toBe(1);
        expect(report.body.funnel.find((step: { key: string }) => step.key === 'viewed_app').coaches).toBe(0);
    });

    it('fills the diet and training plans even when the coach has empty libraries', async () => {
        const { workspace } = await createCoach(3, false);

        await ensureDemoClient(workspace.id);

        const demo = await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } });
        expect(await testPrisma.nutrition_meal_items.count({ where: { nutrition_meals: { nutrition_cycles: { nutrition_plans: { client_id: demo.id } } } } })).toBeGreaterThan(0);
        expect(await testPrisma.training_exercises.count({ where: { training_days: { training_plans: { client_id: demo.id } } } })).toBeGreaterThan(0);
        expect(await testPrisma.food_items.count({ where: { workspace_id: workspace.id } })).toBeGreaterThan(0);
    });

    it('repairs an existing demo whose plans were created empty', async () => {
        const { workspace } = await createCoach(3, false);
        await ensureDemoClient(workspace.id);
        const demo = await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } });
        // Simulate the old behaviour: plans exist but hold no foods or exercises.
        await testPrisma.nutrition_meal_items.deleteMany({ where: { nutrition_meals: { nutrition_cycles: { nutrition_plans: { client_id: demo.id } } } } });
        await testPrisma.training_exercises.deleteMany({ where: { training_days: { training_plans: { client_id: demo.id } } } });

        await ensureDemoClient(workspace.id);

        expect(await testPrisma.nutrition_plans.count({ where: { client_id: demo.id } })).toBe(1);
        expect(await testPrisma.nutrition_meal_items.count({ where: { nutrition_meals: { nutrition_cycles: { nutrition_plans: { client_id: demo.id } } } } })).toBeGreaterThan(0);
        expect(await testPrisma.training_plans.count({ where: { client_id: demo.id } })).toBe(1);
        expect(await testPrisma.training_exercises.count({ where: { training_days: { training_plans: { client_id: demo.id } } } })).toBeGreaterThan(0);
    });

    it('shows the demo in the plans queue with one check-in waiting for review, flagged as demo', async () => {
        const { workspace, cookie } = await createCoach();
        await ensureDemoClient(workspace.id);

        const queue = await request.get('/api/forms/queue').set('Cookie', cookie);

        expect(queue.status).toBe(200);
        expect(queue.body.every((item: { isDemo: boolean }) => item.isDemo)).toBe(true);
        const waiting = queue.body.filter((item: { status: string }) => item.status === 'need-action');
        expect(waiting).toHaveLength(1);
        expect(waiting[0]).toMatchObject({ postAction: 'nutrition-plan' });
    });

    it('draws the progress charts from every reading', async () => {
        const { workspace, cookie } = await createCoach();
        await ensureDemoClient(workspace.id);
        const demo = await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } });

        const transformation = await request.get(`/api/clients/${demo.id}/transformation`).set('Cookie', cookie);

        const histories = Object.fromEntries(transformation.body.metrics.map((metric: { name: string; history: unknown[] }) => [metric.name, metric.history.length]));
        expect(histories).toEqual({ Weight: DEMO_PROGRESS.checkIns.length, Waist: DEMO_PROGRESS.checkIns.length, 'Body Fat': DEMO_PROGRESS.checkIns.length });
    });

    it('un-archives check-ins an older demo archived and re-opens the newest, but leaves one the coach archived', async () => {
        const { workspace, user } = await createCoach();
        await ensureDemoClient(workspace.id);
        const demo = await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } });
        const checkIns = await testPrisma.form_requests.findMany({ where: { client_id: demo.id, forms: { form_type: 'check-in' } }, orderBy: { submitted_at: 'desc' } });
        // Put it back exactly as an older seed left it: everything reviewed and archived at its own submit time.
        for (const row of checkIns) {
            await testPrisma.form_requests.update({
                where: { id: row.id },
                data: { status: 'reviewed', archived_at: row.submitted_at, action_taken_at: row.submitted_at, assigned_to: user.id },
            });
        }

        await ensureDemoClient(workspace.id);

        const repaired = await testPrisma.form_requests.findMany({ where: { client_id: demo.id, forms: { form_type: 'check-in' } }, orderBy: { submitted_at: 'desc' } });
        expect(repaired.every((row) => row.archived_at === null)).toBe(true);
        expect(repaired[0].status).toBe('submitted');

        // A coach who archives the waiting check-in later keeps it archived.
        await testPrisma.form_requests.update({ where: { id: repaired[0].id }, data: { status: 'reviewed', archived_at: new Date(Date.now() + 60_000) } });
        await ensureDemoClient(workspace.id);
        expect((await testPrisma.form_requests.findUniqueOrThrow({ where: { id: repaired[0].id } })).archived_at).not.toBeNull();
    });

    it('rebuilds the readings of an older demo that had fewer check-ins', async () => {
        const { workspace } = await createCoach();
        await ensureDemoClient(workspace.id);
        const demo = await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } });
        const extra = await testPrisma.form_requests.findMany({ where: { client_id: demo.id, forms: { form_type: 'check-in' } }, orderBy: { submitted_at: 'asc' }, take: 4 });
        await testPrisma.form_requests.deleteMany({ where: { id: { in: extra.map((row) => row.id) } } });

        await ensureDemoClient(workspace.id);

        expect(await testPrisma.form_requests.count({ where: { client_id: demo.id, forms: { form_type: 'check-in' } } })).toBe(DEMO_PROGRESS.checkIns.length);
        expect(await testPrisma.form_requests.count({ where: { client_id: demo.id, status: 'submitted', archived_at: null } })).toBe(1);
        expect(await testPrisma.forms.count({ where: { workspace_id: workspace.id, is_demo: true } })).toBe(2);
    });

    it('reports the progress of the 3 demo steps', async () => {
        const { workspace, cookie } = await createCoach();

        const first = await request.get('/api/demo-client').set('Cookie', cookie);
        expect(first.body.steps).toEqual({ edited: false, viewedApp: false, addedRealClient: false });

        await testPrisma.demo_client_events.createMany({ data: [{ id: createId(), workspace_id: workspace.id, event_type: 'edited' }] });
        await addRealClient(workspace.id, 5);
        const later = await request.get('/api/demo-client').set('Cookie', cookie);
        expect(later.body.steps).toEqual({ edited: true, viewedApp: false, addedRealClient: true });
    });

    it('puts the demo check-in back in the queue the first time it is opened, even after the demo plan completed it', async () => {
        const { workspace, cookie } = await createCoach();
        await ensureDemoClient(workspace.id);
        const demo = await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } });
        // Saving the demo plan completes its waiting check-in, which empties the queue.
        await testPrisma.form_requests.updateMany({ where: { client_id: demo.id, status: 'submitted' }, data: { status: 'reviewed', action_taken_at: new Date() } });

        const first = await request.get('/api/forms/queue').set('Cookie', cookie);
        expect(first.body.filter((item: { status: string }) => item.status === 'need-action')).toHaveLength(1);

        await new Promise((resolve) => setTimeout(resolve, 300));   // the first visit is recorded in the background
        await testPrisma.form_requests.updateMany({ where: { client_id: demo.id, status: 'submitted' }, data: { status: 'reviewed', action_taken_at: new Date() } });
        const later = await request.get('/api/forms/queue').set('Cookie', cookie);
        expect(later.body.filter((item: { status: string }) => item.status === 'need-action')).toHaveLength(0);
    });
});
