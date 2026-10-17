import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { DEFAULT_PERMISSIONS } from '../../src/lib/defaultPermissions';

async function createClient(workspaceId: string, currentPackage: string | null = 'Gold') {
    return testPrisma.clients.create({
        data: {
            id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
            fname: 'Sara', lname: 'Client', email: `client-${createId()}@test.com`,
            workspace_id: workspaceId, current_package: currentPackage,
        },
    });
}

async function createForm(workspaceId: string, formType = 'check-in', postAction = 'nutrition-plan') {
    return testPrisma.forms.create({
        data: { id: createId(), workspace_id: workspaceId, title_en: 'Form', form_type: formType, post_action: postAction },
    });
}

interface RequestOpts { status?: string; assignedTo?: string | null; archived?: boolean; submittedDaysAgo?: number }
async function createRequest(workspaceId: string, formId: string, clientId: string, opts: RequestOpts = {}) {
    const submitted = new Date(Date.now() - (opts.submittedDaysAgo ?? 0) * 86400000);
    // Production stamps the form's post_action onto each request at creation.
    const form = await testPrisma.forms.findUniqueOrThrow({ where: { id: formId }, select: { post_action: true } });
    return testPrisma.form_requests.create({
        data: {
            id: createId(), workspace_id: workspaceId, form_id: formId, client_id: clientId,
            status: opts.status ?? 'submitted', submitted_at: submitted,
            assigned_to: opts.assignedTo ?? null,
            archived_at: opts.archived ? new Date() : null,
            post_action: form.post_action,
        },
    });
}

async function addMember(workspaceId: string, role: string, extra: Record<string, unknown> = {}) {
    const user = await createTestUser();
    const member = await testPrisma.workspace_members.create({
        data: {
            id: createId(), workspace_id: workspaceId, user_id: user.id, role,
            permissions: DEFAULT_PERMISSIONS[role] as object, ...extra,
        },
    });
    return { user, member, cookie: await makeAuthCookie(user.id, workspaceId, role, DEFAULT_PERMISSIONS[role]) };
}

describe('Operations API', () => {
    let workspaceId: string;
    let ownerId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const owner = await createTestUser();
        ownerId = owner.id;
        const ws = await createTestWorkspace(owner.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(owner.id, workspaceId, 'owner');
    });

    describe('GET /api/operations/summary', () => {
        test('aggregates demand by package, action and type, and loads per trainer', async () => {
            const trainer = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 4 });
            const nutritionForm = await createForm(workspaceId, 'check-in', 'nutrition-plan');
            const workoutForm = await createForm(workspaceId, 'assessment', 'workout-plan');
            const gold = await createClient(workspaceId, 'Gold');
            const silver = await createClient(workspaceId, 'Silver');

            await createRequest(workspaceId, nutritionForm.id, gold.id, { assignedTo: trainer.user.id });
            await createRequest(workspaceId, nutritionForm.id, gold.id);
            await createRequest(workspaceId, workoutForm.id, silver.id, { assignedTo: trainer.user.id, submittedDaysAgo: 8 });

            const res = await request.get('/api/operations/summary').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.scope).toBe('team');
            expect(res.body.demand).toMatchObject({ total: 3, unassigned: 1 });
            expect(res.body.breakdown.byAction).toEqual({ nutrition: 2, workout: 1 });
            expect(res.body.breakdown.byType).toEqual({ assessment: 1, checkIn: 2 });
            expect(res.body.breakdown.byPackage).toEqual([{ package: 'Gold', count: 2 }, { package: 'Silver', count: 1 }]);
            expect(res.body.aging).toMatchObject({ over7d: 1, over1d: 1 });
            expect(res.body.capacity.total).toBe(4);
            expect(res.body.trainers[0]).toMatchObject({ userId: trainer.user.id, load: { total: 2, nutrition: 1, workout: 1 }, utilizationPct: 50, status: 'healthy' });
            expect(res.body.utilization).toMatchObject({ pct: 75, gap: 1, status: 'healthy' });
        });

        test('excludes archived, reviewed, awaiting and review-only items from the headline', async () => {
            const form = await createForm(workspaceId);
            const reviewOnlyForm = await createForm(workspaceId, 'check-in', 'nothing');
            const client = await createClient(workspaceId);

            await createRequest(workspaceId, form.id, client.id);
            await createRequest(workspaceId, form.id, client.id, { archived: true });
            await createRequest(workspaceId, form.id, client.id, { status: 'reviewed' });
            await createRequest(workspaceId, form.id, client.id, { status: 'pending' });
            await createRequest(workspaceId, reviewOnlyForm.id, client.id);

            const res = await request.get('/api/operations/summary').set('Cookie', ownerCookie);
            expect(res.body.demand).toEqual({ total: 1, unassigned: 1, reviewOnly: 1, incoming: 1 });
        });

        test('filters combine: package + type narrow the aggregate', async () => {
            const checkIn = await createForm(workspaceId, 'check-in');
            const assessment = await createForm(workspaceId, 'assessment');
            const gold = await createClient(workspaceId, 'Gold');
            const silver = await createClient(workspaceId, 'Silver');
            await createRequest(workspaceId, checkIn.id, gold.id);
            await createRequest(workspaceId, assessment.id, gold.id);
            await createRequest(workspaceId, assessment.id, silver.id);

            const res = await request.get('/api/operations/summary?package=Gold&type=assessment').set('Cookie', ownerCookie);
            expect(res.body.demand.total).toBe(1);
        });

        test('clients with no package are filterable via __none__', async () => {
            const form = await createForm(workspaceId);
            const noPackage = await createClient(workspaceId, null);
            const gold = await createClient(workspaceId, 'Gold');
            await createRequest(workspaceId, form.id, noPackage.id);
            await createRequest(workspaceId, form.id, gold.id);

            const res = await request.get('/api/operations/summary?package=__none__').set('Cookie', ownerCookie);
            expect(res.body.demand.total).toBe(1);
            expect(res.body.breakdown.byPackage).toEqual([{ package: null, count: 1 }]);
        });

        test('several packages can be filtered at once, including "no package"', async () => {
            const form = await createForm(workspaceId);
            const noPackage = await createClient(workspaceId, null);
            const gold = await createClient(workspaceId, 'Gold');
            const silver = await createClient(workspaceId, 'Silver');
            await createRequest(workspaceId, form.id, noPackage.id);
            await createRequest(workspaceId, form.id, gold.id);
            await createRequest(workspaceId, form.id, silver.id);

            const two = await request.get('/api/operations/summary?package=Gold&package=Silver').set('Cookie', ownerCookie);
            expect(two.body.demand.total).toBe(2);

            const withNone = await request.get('/api/operations/summary?package=Gold&package=__none__').set('Cookie', ownerCookie);
            expect(withNone.body.demand.total).toBe(2);
            expect(withNone.body.breakdown.byPackage).toEqual(expect.arrayContaining([{ package: 'Gold', count: 1 }, { package: null, count: 1 }]));
        });

        test('owner capacity counts only when set', async () => {
            await testPrisma.workspaces.update({ where: { id: workspaceId }, data: { owner_daily_plan_capacity: 6 } });
            const res = await request.get('/api/operations/summary').set('Cookie', ownerCookie);
            expect(res.body.capacity.total).toBe(6);
            expect(res.body.trainers[0]).toMatchObject({ userId: ownerId, isOwner: true });
        });

        test('tenant isolation: another workspace\'s queue and members are never counted', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            await addMember(otherWs.id, 'trainer', { daily_plan_capacity: 50 });
            const form = await createForm(otherWs.id);
            const client = await createClient(otherWs.id);
            await createRequest(otherWs.id, form.id, client.id);

            const res = await request.get('/api/operations/summary').set('Cookie', ownerCookie);
            expect(res.body.demand.total).toBe(0);
            expect(res.body.capacity.total).toBe(0);
            expect(res.body.trainers).toEqual([]);
        });

        test('manager sees the full team view', async () => {
            const manager = await addMember(workspaceId, 'manager', { daily_plan_capacity: 3 });
            const res = await request.get('/api/operations/summary').set('Cookie', manager.cookie);
            expect(res.status).toBe(200);
            expect(res.body.scope).toBe('team');
            expect(res.body.capacity.total).toBe(3);
        });

        test('trainer sees only their own row, with no team totals or colleagues', async () => {
            const trainer = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 4 });
            const colleague = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 9 });
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await createRequest(workspaceId, form.id, client.id, { assignedTo: trainer.user.id });
            await createRequest(workspaceId, form.id, client.id, { assignedTo: colleague.user.id });

            const res = await request.get('/api/operations/summary').set('Cookie', trainer.cookie);
            expect(res.status).toBe(200);
            expect(res.body.scope).toBe('self');
            expect(res.body.me).toMatchObject({ userId: trainer.user.id, load: { total: 1 } });
            expect(res.body).not.toHaveProperty('capacity');
            expect(res.body).not.toHaveProperty('trainers');
            expect(res.body).not.toHaveProperty('demand');
            expect(JSON.stringify(res.body)).not.toContain(colleague.user.id);
        });

        test('trainer with no capacity set still gets their own load, with null utilization', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const res = await request.get('/api/operations/summary').set('Cookie', trainer.cookie);
            expect(res.body.me).toMatchObject({ userId: trainer.user.id, utilizationPct: null, status: null });
        });

        test('roles without forms.read are denied with 403', async () => {
            const receptionist = await addMember(workspaceId, 'receptionist');
            const res = await request.get('/api/operations/summary').set('Cookie', receptionist.cookie);
            expect(res.status).toBe(403);
        });

        test('no auth cookie is rejected with 401', async () => {
            const res = await request.get('/api/operations/summary');
            expect(res.status).toBe(401);
        });

        test('an unsupported horizonDays falls back to 1 day', async () => {
            const res = await request.get('/api/operations/summary?horizonDays=99').set('Cookie', ownerCookie);
            expect(res.body.horizonDays).toBe(1);
        });
    });

    describe('GET /api/operations/demand-trend', () => {
        const isoDay = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

        test('counts plan-producing submissions per day and fills empty days with zero', async () => {
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 0 });
            await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 0 });
            await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 2 });

            const res = await request.get('/api/operations/demand-trend?days=7&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.points).toHaveLength(7);
            const byDate = Object.fromEntries(res.body.points.map((p: { date: string; count: number }) => [p.date, p.count]));
            expect(byDate[isoDay(0)]).toBe(2);
            expect(byDate[isoDay(1)]).toBe(0);
            expect(byDate[isoDay(2)]).toBe(1);
            expect(res.body.total).toBe(3);
        });

        test('includes reviewed and archived requests (they were demand when they arrived) but not unsubmitted or review-only', async () => {
            const form = await createForm(workspaceId);
            const reviewOnlyForm = await createForm(workspaceId, 'check-in', 'nothing');
            const client = await createClient(workspaceId);
            await createRequest(workspaceId, form.id, client.id, { status: 'reviewed' });
            await createRequest(workspaceId, form.id, client.id, { archived: true });
            await createRequest(workspaceId, reviewOnlyForm.id, client.id);
            const pending = await createRequest(workspaceId, form.id, client.id, { status: 'pending' });
            await testPrisma.form_requests.update({ where: { id: pending.id }, data: { submitted_at: null } });

            const res = await request.get('/api/operations/demand-trend?days=7&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.total).toBe(2);
        });

        test('buckets days in the requested time zone', async () => {
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            const request1 = await createRequest(workspaceId, form.id, client.id);
            // 23:30 UTC is already the next calendar day in UTC+14.
            await testPrisma.form_requests.update({ where: { id: request1.id }, data: { submitted_at: new Date('2026-10-16T23:30:00Z') } });

            const res = await request.get('/api/operations/demand-trend?days=90&timeZone=Pacific/Kiritimati').set('Cookie', ownerCookie);
            const byDate = Object.fromEntries(res.body.points.map((p: { date: string; count: number }) => [p.date, p.count]));
            expect(byDate['2026-10-17']).toBe(1);
            expect(byDate['2026-10-16'] ?? 0).toBe(0);
        });

        test('filters narrow the series and an unknown time zone falls back to UTC', async () => {
            const checkIn = await createForm(workspaceId, 'check-in');
            const assessment = await createForm(workspaceId, 'assessment');
            const client = await createClient(workspaceId);
            await createRequest(workspaceId, checkIn.id, client.id);
            await createRequest(workspaceId, assessment.id, client.id);

            const res = await request.get('/api/operations/demand-trend?type=assessment&timeZone=Nope/Zone').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.timeZone).toBe('UTC');
            expect(res.body.total).toBe(1);
        });

        test('a custom from/to range returns exactly that window, inclusive, with totals and average', async () => {
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            for (const day of ['2026-09-10', '2026-09-10', '2026-09-12', '2026-09-20']) {
                const created = await createRequest(workspaceId, form.id, client.id);
                await testPrisma.form_requests.update({ where: { id: created.id }, data: { submitted_at: new Date(`${day}T12:00:00Z`) } });
            }

            const res = await request.get('/api/operations/demand-trend?from=2026-09-10&to=2026-09-14&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ from: '2026-09-10', to: '2026-09-14', days: 5, total: 3, averagePerDay: 0.6 });
            expect(res.body.points.map((p: { count: number }) => p.count)).toEqual([2, 0, 1, 0, 0]);
        });

        test('a custom range overrides the days preset, and a future end date is clamped to today', async () => {
            const res = await request.get('/api/operations/demand-trend?days=7&from=2026-10-01&to=2099-01-01&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.from).toBe('2026-10-01');
            expect(res.body.to).toBe(isoDay(0));
        });

        test.each([
            ['unparseable dates', 'from=nope&to=2026-10-01'],
            ['start after end', 'from=2026-10-10&to=2026-10-01'],
            ['a half-specified range', 'from=2026-10-01'],
            ['a range over 366 days', 'from=2024-01-01&to=2026-10-01'],
        ])('rejects %s with 400', async (_label, query) => {
            const res = await request.get(`/api/operations/demand-trend?${query}`).set('Cookie', ownerCookie);
            expect(res.status).toBe(400);
        });

        test('days=1 (the Today filter) returns just today, for demand, finished and service level', async () => {
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 0 });
            await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 2 });

            const demand = await request.get('/api/operations/demand-trend?days=1&timeZone=UTC').set('Cookie', ownerCookie);
            expect(demand.body).toMatchObject({ days: 1, from: isoDay(0), to: isoDay(0), total: 1 });
            expect(demand.body.points).toHaveLength(1);

            const finished = await request.get('/api/operations/finished-trend?days=1&timeZone=UTC').set('Cookie', ownerCookie);
            expect(finished.body).toMatchObject({ days: 1, from: isoDay(0) });
            expect(finished.body.team.points).toHaveLength(1);

            const service = await request.get('/api/operations/service-level?days=1&timeZone=UTC').set('Cookie', ownerCookie);
            expect(service.body).toMatchObject({ days: 1, from: isoDay(0) });
            expect(service.body.daily).toHaveLength(1);
        });

        test('a custom range of a single day works too', async () => {
            const res = await request.get(`/api/operations/demand-trend?from=${isoDay(3)}&to=${isoDay(3)}&timeZone=UTC`).set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ days: 1, from: isoDay(3), to: isoDay(3) });
        });

        test('an unsupported days value falls back to 30', async () => {
            const res = await request.get('/api/operations/demand-trend?days=5').set('Cookie', ownerCookie);
            expect(res.body.days).toBe(30);
            expect(res.body.points).toHaveLength(30);
        });

        test('replays the team capacity of each day from capacity history', async () => {
            const joined = new Date('2026-01-01T00:00:00Z');
            const trainer = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 8, joined_at: joined });
            const steady = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 3, joined_at: joined });
            // trainer: 5 -> 8 on 2026-10-12 (UTC); steady has no history.
            await testPrisma.capacity_history.create({ data: {
                id: createId(), workspace_id: workspaceId, user_id: trainer.user.id,
                previous_capacity: 5, new_capacity: 8, changed_at: new Date('2026-10-12T10:00:00Z'),
            } });

            const res = await request.get('/api/operations/demand-trend?from=2026-10-10&to=2026-10-13&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.points.map((p: { capacity: number }) => p.capacity)).toEqual([8, 8, 11, 11]);
            expect(steady.user.id).toBeTruthy();
        });

        test('capacity is zero before a member joined and ignores inactive or ineligible members', async () => {
            await addMember(workspaceId, 'trainer', { daily_plan_capacity: 6, joined_at: new Date('2026-10-12T08:00:00Z') });
            await addMember(workspaceId, 'trainer', { daily_plan_capacity: 9, is_active: false, joined_at: new Date('2026-01-01T00:00:00Z') });
            await addMember(workspaceId, 'receptionist', { daily_plan_capacity: 9, joined_at: new Date('2026-01-01T00:00:00Z') });

            const res = await request.get('/api/operations/demand-trend?from=2026-10-10&to=2026-10-13&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.points.map((p: { capacity: number }) => p.capacity)).toEqual([0, 0, 6, 6]);
        });

        test('lists the package names the chart filter can offer, and whether some clients have none', async () => {
            await createClient(workspaceId, 'Gold');
            await createClient(workspaceId, 'Silver');
            await createClient(workspaceId, 'Gold');
            const none = await request.get('/api/operations/demand-trend?timeZone=UTC').set('Cookie', ownerCookie);
            expect(none.body.filterOptions).toEqual({ packages: ['Gold', 'Silver'], hasNoPackage: false });

            await createClient(workspaceId, null);
            const withNone = await request.get('/api/operations/demand-trend?timeZone=UTC').set('Cookie', ownerCookie);
            expect(withNone.body.filterOptions.hasNoPackage).toBe(true);
        });

        test('package options come only from this workspace', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            await createClient(otherWs.id, 'Secret package');
            const res = await request.get('/api/operations/demand-trend?timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.filterOptions.packages).not.toContain('Secret package');
        });

        test('reports current total daily capacity for reference', async () => {
            await addMember(workspaceId, 'trainer', { daily_plan_capacity: 4 });
            await addMember(workspaceId, 'trainer', { daily_plan_capacity: 6 });
            const res = await request.get('/api/operations/demand-trend').set('Cookie', ownerCookie);
            expect(res.body.currentDailyCapacity).toBe(10);
        });

        test('tenant isolation: another workspace\'s submissions are not counted', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const form = await createForm(otherWs.id);
            const client = await createClient(otherWs.id);
            await createRequest(otherWs.id, form.id, client.id);

            const res = await request.get('/api/operations/demand-trend').set('Cookie', ownerCookie);
            expect(res.body.total).toBe(0);
        });

        test('manager allowed; trainer 403; no cookie 401', async () => {
            const manager = await addMember(workspaceId, 'manager');
            const trainer = await addMember(workspaceId, 'trainer');
            expect((await request.get('/api/operations/demand-trend').set('Cookie', manager.cookie)).status).toBe(200);
            expect((await request.get('/api/operations/demand-trend').set('Cookie', trainer.cookie)).status).toBe(403);
            expect((await request.get('/api/operations/demand-trend')).status).toBe(401);
        });
    });

    describe('POST /api/operations/capacity/bulk', () => {
        test('sets one value for every active plan-producing member who has none, and logs each', async () => {
            const unsetTrainer = await addMember(workspaceId, 'trainer');
            const unsetNutri = await addMember(workspaceId, 'nutritionist');
            const hasValue = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 9 });
            const inactive = await addMember(workspaceId, 'trainer', { is_active: false });
            const receptionist = await addMember(workspaceId, 'receptionist');

            const res = await request.post('/api/operations/capacity/bulk').set('Cookie', ownerCookie).send({ dailyCapacity: 5 });
            expect(res.status).toBe(200);
            expect(res.body.updated).toBe(2);

            const capacityOf = async (id: string) => (await testPrisma.workspace_members.findUnique({ where: { id } }))?.daily_plan_capacity;
            expect(await capacityOf(unsetTrainer.member.id)).toBe(5);
            expect(await capacityOf(unsetNutri.member.id)).toBe(5);
            expect(await capacityOf(hasValue.member.id)).toBe(9);       // untouched
            expect(await capacityOf(inactive.member.id)).toBeNull();
            expect(await capacityOf(receptionist.member.id)).toBeNull();
            expect(await testPrisma.capacity_history.count({ where: { workspace_id: workspaceId } })).toBe(2);
        });

        test('rejects zero, negative, non-integer and missing values', async () => {
            for (const bad of [0, -1, 2.5, 501, null, undefined, '5']) {
                const res = await request.post('/api/operations/capacity/bulk').set('Cookie', ownerCookie).send({ dailyCapacity: bad });
                expect(res.status).toBe(400);
            }
        });

        test('is owner/manager only and tenant-scoped', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            expect((await request.post('/api/operations/capacity/bulk').set('Cookie', trainer.cookie).send({ dailyCapacity: 5 })).status).toBe(403);

            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const foreign = await addMember(otherWs.id, 'trainer');
            await request.post('/api/operations/capacity/bulk').set('Cookie', ownerCookie).send({ dailyCapacity: 5 });
            expect((await testPrisma.workspace_members.findUnique({ where: { id: foreign.member.id } }))?.daily_plan_capacity).toBeNull();
        });
    });

    describe('POST /api/operations/assign-waiting', () => {
        const assign = (cookie: string, body: object) => request.post('/api/operations/assign-waiting').set('Cookie', cookie).send(body);

        test('assigns up to `limit` of the oldest unassigned plan-producing needs-action requests', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const form = await createForm(workspaceId);
            const reviewOnlyForm = await createForm(workspaceId, 'check-in', 'nothing');
            const client = await createClient(workspaceId);
            const oldest = await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 5 });
            const middle = await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 3 });
            const newest = await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 1 });
            const reviewOnly = await createRequest(workspaceId, reviewOnlyForm.id, client.id, { submittedDaysAgo: 9 });
            const alreadyMine = await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 8, assignedTo: ownerId });
            const archived = await createRequest(workspaceId, form.id, client.id, { submittedDaysAgo: 7, archived: true });

            const res = await assign(ownerCookie, { assigneeUserId: trainer.user.id, limit: 2 });
            expect(res.status).toBe(200);
            expect(res.body.assigned).toBe(2);

            const assignee = async (id: string) => (await testPrisma.form_requests.findUnique({ where: { id } }))?.assigned_to;
            expect(await assignee(oldest.id)).toBe(trainer.user.id);
            expect(await assignee(middle.id)).toBe(trainer.user.id);
            expect(await assignee(newest.id)).toBeNull();
            expect(await assignee(reviewOnly.id)).toBeNull();
            expect(await assignee(alreadyMine.id)).toBe(ownerId);
            expect(await assignee(archived.id)).toBeNull();
        });

        test('notifies the assignee once per plan', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await createRequest(workspaceId, form.id, client.id);
            await createRequest(workspaceId, form.id, client.id);

            await assign(ownerCookie, { assigneeUserId: trainer.user.id, limit: 5 });
            expect(await testPrisma.notifications.count({ where: { recipient_id: trainer.user.id, type: 'checkin.assigned' } })).toBe(2);
        });

        test('refuses people who cannot receive plans (inactive, receptionist, other workspace)', async () => {
            const inactive = await addMember(workspaceId, 'trainer', { is_active: false });
            const receptionist = await addMember(workspaceId, 'receptionist');
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const foreign = await addMember(otherWs.id, 'trainer');
            for (const person of [inactive, receptionist, foreign]) {
                expect((await assign(ownerCookie, { assigneeUserId: person.user.id, limit: 1 })).status).toBe(400);
            }
        });

        test('validates the body', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const bodies = [{}, { assigneeUserId: trainer.user.id }, { assigneeUserId: trainer.user.id, limit: 0 }, { assigneeUserId: trainer.user.id, limit: 201 }, { assigneeUserId: trainer.user.id, limit: 1.5 }];
            for (const body of bodies) {
                expect((await assign(ownerCookie, body)).status).toBe(400);
            }
        });

        test('is owner/manager only, and never touches another workspace requests', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            expect((await assign(trainer.cookie, { assigneeUserId: trainer.user.id, limit: 1 })).status).toBe(403);

            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const form = await createForm(otherWs.id);
            const client = await createClient(otherWs.id);
            const foreignRequest = await createRequest(otherWs.id, form.id, client.id);
            const res = await assign(ownerCookie, { assigneeUserId: trainer.user.id, limit: 10 });
            expect(res.body.assigned).toBe(0);
            expect((await testPrisma.form_requests.findUnique({ where: { id: foreignRequest.id } }))?.assigned_to).toBeNull();
        });
    });

    describe('GET /api/operations/finished-trend', () => {
        const isoDay = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

        async function finish(formId: string, clientId: string, opts: { by?: string | null; assignedTo?: string | null; daysAgo?: number }) {
            const created = await createRequest(workspaceId, formId, clientId, { status: 'reviewed', assignedTo: opts.assignedTo ?? null });
            await testPrisma.form_requests.update({
                where: { id: created.id },
                data: { action_taken_at: new Date(Date.now() - (opts.daysAgo ?? 0) * 86400000), action_taken_by: opts.by ?? null },
            });
            return created;
        }

        test('counts finished plans per person per day, crediting whoever finished them', async () => {
            const trainer = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 5, joined_at: new Date('2026-01-01T00:00:00Z') });
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await finish(form.id, client.id, { by: trainer.user.id, daysAgo: 0 });
            await finish(form.id, client.id, { by: trainer.user.id, daysAgo: 0 });
            await finish(form.id, client.id, { by: trainer.user.id, daysAgo: 2 });
            await finish(form.id, client.id, { by: ownerId, daysAgo: 1 });

            const res = await request.get('/api/operations/finished-trend?days=7&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.scope).toBe('team');
            expect(res.body.team.total).toBe(4);
            const row = res.body.people.find((p: { userId: string }) => p.userId === trainer.user.id);
            expect(row).toMatchObject({ total: 3, today: 2 });
            const byDate = Object.fromEntries(row.points.map((p: { date: string; count: number }) => [p.date, p.count]));
            expect(byDate[isoDay(0)]).toBe(2);
            expect(byDate[isoDay(2)]).toBe(1);
            expect(row.points.at(-1).capacity).toBe(5);
        });

        test('older rows with no recorded finisher are credited to the assignee; with neither they are unattributed', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await finish(form.id, client.id, { assignedTo: trainer.user.id });
            await finish(form.id, client.id, {});

            const res = await request.get('/api/operations/finished-trend?days=7&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.people.find((p: { userId: string }) => p.userId === trainer.user.id).total).toBe(1);
            expect(res.body.unattributed.total).toBe(1);
            expect(res.body.team.total).toBe(2);
        });

        test('the finisher wins over the assignee', async () => {
            const assignee = await addMember(workspaceId, 'trainer');
            const finisher = await addMember(workspaceId, 'trainer');
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await finish(form.id, client.id, { by: finisher.user.id, assignedTo: assignee.user.id });

            const res = await request.get('/api/operations/finished-trend?days=7&timeZone=UTC').set('Cookie', ownerCookie);
            const total = (id: string) => res.body.people.find((p: { userId: string }) => p.userId === id).total;
            expect(total(finisher.user.id)).toBe(1);
            expect(total(assignee.user.id)).toBe(0);
        });

        test('only counts finished (reviewed) plan-producing requests', async () => {
            const form = await createForm(workspaceId);
            const reviewOnlyForm = await createForm(workspaceId, 'check-in', 'nothing');
            const client = await createClient(workspaceId);
            await createRequest(workspaceId, form.id, client.id, { status: 'submitted' });
            await finish(reviewOnlyForm.id, client.id, { by: ownerId });
            await finish(form.id, client.id, { by: ownerId });

            const res = await request.get('/api/operations/finished-trend?days=7&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.team.total).toBe(1);
        });

        test('someone who is no longer a counted member keeps a row for the work they finished', async () => {
            const inactive = await addMember(workspaceId, 'trainer', { is_active: false });
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await finish(form.id, client.id, { by: inactive.user.id });

            const res = await request.get('/api/operations/finished-trend?days=7&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.people.find((p: { userId: string }) => p.userId === inactive.user.id)).toMatchObject({ total: 1, role: 'former' });
            expect(res.body.unattributed.total).toBe(0);
        });

        test('supports a custom range, filters, and rejects a bad range', async () => {
            const form = await createForm(workspaceId, 'assessment');
            const other = await createForm(workspaceId, 'check-in');
            const client = await createClient(workspaceId);
            await finish(form.id, client.id, { by: ownerId, daysAgo: 1 });
            await finish(other.id, client.id, { by: ownerId, daysAgo: 1 });

            const filtered = await request.get(`/api/operations/finished-trend?from=${isoDay(3)}&to=${isoDay(0)}&type=assessment&timeZone=UTC`).set('Cookie', ownerCookie);
            expect(filtered.body).toMatchObject({ days: 4, from: isoDay(3) });
            expect(filtered.body.team.total).toBe(1);
            expect((await request.get('/api/operations/finished-trend?from=bad&to=worse').set('Cookie', ownerCookie)).status).toBe(400);
        });

        test('a trainer sees only their own row, with no team totals or colleagues', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const colleague = await addMember(workspaceId, 'trainer');
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await finish(form.id, client.id, { by: trainer.user.id });
            await finish(form.id, client.id, { by: colleague.user.id });

            const res = await request.get('/api/operations/finished-trend?days=7&timeZone=UTC').set('Cookie', trainer.cookie);
            expect(res.status).toBe(200);
            expect(res.body.scope).toBe('self');
            expect(res.body.me).toMatchObject({ userId: trainer.user.id, total: 1 });
            expect(res.body).not.toHaveProperty('team');
            expect(res.body).not.toHaveProperty('people');
            expect(JSON.stringify(res.body)).not.toContain(colleague.user.id);
        });

        test('tenant isolation, and 403 / 401 for other callers', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const form = await createForm(otherWs.id);
            const client = await createClient(otherWs.id);
            const created = await createRequest(otherWs.id, form.id, client.id, { status: 'reviewed' });
            await testPrisma.form_requests.update({ where: { id: created.id }, data: { action_taken_at: new Date(), action_taken_by: otherOwner.id } });

            expect((await request.get('/api/operations/finished-trend?timeZone=UTC').set('Cookie', ownerCookie)).body.team.total).toBe(0);
            const receptionist = await addMember(workspaceId, 'receptionist');
            expect((await request.get('/api/operations/finished-trend').set('Cookie', receptionist.cookie)).status).toBe(403);
            expect((await request.get('/api/operations/finished-trend')).status).toBe(401);
        });
    });

    describe('GET /api/operations/kpi-trend', () => {
        const isoDay = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
        const get = (cookie: string, query = '') => request.get(`/api/operations/kpi-trend?timeZone=UTC${query}`).set('Cookie', cookie);

        async function submittedAt(formId: string, clientId: string, daysAgo: number, opts: { finishedDaysAgo?: number; archivedDaysAgo?: number } = {}) {
            const created = await createRequest(workspaceId, formId, clientId, { status: opts.finishedDaysAgo !== undefined ? 'reviewed' : 'submitted' });
            await testPrisma.form_requests.update({
                where: { id: created.id },
                data: {
                    submitted_at: new Date(Date.now() - daysAgo * 86400000),
                    action_taken_at: opts.finishedDaysAgo !== undefined ? new Date(Date.now() - opts.finishedDaysAgo * 86400000) : null,
                    archived_at: opts.archivedDaysAgo !== undefined ? new Date(Date.now() - opts.archivedDaysAgo * 86400000) : null,
                },
            });
        }

        test('returns 14 days ending today, with the backlog counted on every day a request was waiting', async () => {
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await submittedAt(form.id, client.id, 5);                                          // waiting since 5 days ago, still open
            await submittedAt(form.id, client.id, 4, { finishedDaysAgo: 2 });                   // waiting 4..3 days ago, done 2 days ago
            await submittedAt(form.id, client.id, 3, { archivedDaysAgo: 1 });                   // waiting 3..2 days ago, archived 1 day ago

            const res = await get(ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.points).toHaveLength(14);
            expect(res.body.to).toBe(isoDay(0));
            const waiting = (daysAgo: number) => res.body.points.find((p: { date: string }) => p.date === isoDay(daysAgo)).waiting;
            expect(waiting(6)).toBe(0);
            expect(waiting(5)).toBe(1);   // first request
            expect(waiting(4)).toBe(2);   // + second
            expect(waiting(3)).toBe(3);   // + third
            expect(waiting(2)).toBe(2);   // second finished this day
            expect(waiting(1)).toBe(1);   // third archived this day
            expect(waiting(0)).toBe(1);   // only the first is still open
        });

        test('ignores review-only requests and follows the filters', async () => {
            const nutrition = await createForm(workspaceId, 'check-in', 'nutrition-plan');
            const workout = await createForm(workspaceId, 'check-in', 'workout-plan');
            const reviewOnly = await createForm(workspaceId, 'check-in', 'nothing');
            const client = await createClient(workspaceId);
            await submittedAt(nutrition.id, client.id, 1);
            await submittedAt(workout.id, client.id, 1);
            await submittedAt(reviewOnly.id, client.id, 1);

            const all = await get(ownerCookie);
            expect(all.body.points.at(-1).waiting).toBe(2);
            const onlyWorkout = await get(ownerCookie, '&action=workout');
            expect(onlyWorkout.body.points.at(-1).waiting).toBe(1);
        });

        test('carries how many plans the team finished each day', async () => {
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            for (const daysAgo of [0, 0, 3]) {
                const created = await createRequest(workspaceId, form.id, client.id, { status: 'reviewed' });
                await testPrisma.form_requests.update({
                    where: { id: created.id },
                    data: { submitted_at: new Date(Date.now() - (daysAgo + 2) * 86400000), action_taken_at: new Date(Date.now() - daysAgo * 86400000), action_taken_by: ownerId },
                });
            }
            const res = await get(ownerCookie);
            const finishedOn = (daysAgo: number) => res.body.points.find((p: { date: string }) => p.date === isoDay(daysAgo)).finished;
            expect(finishedOn(0)).toBe(2);
            expect(finishedOn(1)).toBe(0);
            expect(finishedOn(3)).toBe(1);
        });

        test('carries team capacity per day and how full the team was', async () => {
            await addMember(workspaceId, 'trainer', { daily_plan_capacity: 4, joined_at: new Date('2026-01-01T00:00:00Z') });
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await submittedAt(form.id, client.id, 1);
            await submittedAt(form.id, client.id, 1);

            const res = await get(ownerCookie);
            const last = res.body.points.at(-1);
            expect(last).toMatchObject({ waiting: 2, capacity: 4, fullPct: 50 });
        });

        test('tenant isolation, and owner/manager only', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const form = await createForm(otherWs.id);
            const client = await createClient(otherWs.id);
            const created = await createRequest(otherWs.id, form.id, client.id);
            await testPrisma.form_requests.update({ where: { id: created.id }, data: { submitted_at: new Date(Date.now() - 86400000) } });
            expect((await get(ownerCookie)).body.points.at(-1).waiting).toBe(0);

            const trainer = await addMember(workspaceId, 'trainer');
            expect((await get(trainer.cookie)).status).toBe(403);
            expect((await request.get('/api/operations/kpi-trend')).status).toBe(401);
        });
    });

    describe('service level', () => {
        const HOUR = 3600000;
        const get = (cookie: string, query = '') => request.get(`/api/operations/service-level?days=30&timeZone=UTC${query}`).set('Cookie', cookie);

        // A plan the client submitted `waitedHours` before it was finished (finished `finishedHoursAgo` ago).
        async function finishedAfter(formId: string, clientId: string, waitedHours: number, by: string | null, finishedHoursAgo = 1) {
            const created = await createRequest(workspaceId, formId, clientId, { status: 'reviewed' });
            const finishedAt = Date.now() - finishedHoursAgo * HOUR;
            await testPrisma.form_requests.update({
                where: { id: created.id },
                data: { submitted_at: new Date(finishedAt - waitedHours * HOUR), action_taken_at: new Date(finishedAt), action_taken_by: by },
            });
        }

        async function waiting(formId: string, clientId: string, waitedHours: number, extra: { archived?: boolean } = {}) {
            const created = await createRequest(workspaceId, formId, clientId, { status: 'submitted', archived: extra.archived });
            await testPrisma.form_requests.update({ where: { id: created.id }, data: { submitted_at: new Date(Date.now() - waitedHours * HOUR) } });
        }

        test('measures finished plans against the default 2-day goal and credits each person', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await finishedAfter(form.id, client.id, 10, trainer.user.id);
            await finishedAfter(form.id, client.id, 30, trainer.user.id);
            await finishedAfter(form.id, client.id, 100, ownerId);

            const res = await get(ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ targetDays: 2, finished: 3, onTime: 2, onTimePct: 66.7 });
            expect(res.body.averageHours).toBeCloseTo(46.7, 1);
            expect(res.body.medianHours).toBe(30);
            const row = res.body.people.find((p: { userId: string }) => p.userId === trainer.user.id);
            expect(row).toMatchObject({ finished: 2, onTime: 2, onTimePct: 100 });
            expect(res.body.people.find((p: { userId: string }) => p.userId === ownerId)).toMatchObject({ finished: 1, onTime: 0 });
        });

        test('counts plans still waiting and how many are past the goal, ignoring archived and review-only', async () => {
            const form = await createForm(workspaceId);
            const reviewOnlyForm = await createForm(workspaceId, 'check-in', 'nothing');
            const client = await createClient(workspaceId);
            await waiting(form.id, client.id, 10);
            await waiting(form.id, client.id, 60);
            await waiting(form.id, client.id, 200);
            await waiting(form.id, client.id, 500, { archived: true });
            await waiting(reviewOnlyForm.id, client.id, 500);

            const res = await get(ownerCookie);
            expect(res.body.waiting.open).toBe(3);
            expect(res.body.waiting.overdue).toBe(2);
            expect(res.body.waiting.longestHours).toBeCloseTo(200, 0);
        });

        test('the goal can be changed by an owner or manager, and moves the on-time numbers', async () => {
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await finishedAfter(form.id, client.id, 30, ownerId);

            expect((await get(ownerCookie)).body.onTimePct).toBe(100);
            const put = await request.put('/api/operations/service-target').set('Cookie', ownerCookie).send({ targetDays: 1 });
            expect(put.status).toBe(200);
            const after = await get(ownerCookie);
            expect(after.body).toMatchObject({ targetDays: 1, onTimePct: 0 });
        });

        test.each([[0], [31], [1.5], ['2'], [null]])('rejects an invalid goal %p', async (bad) => {
            const res = await request.put('/api/operations/service-target').set('Cookie', ownerCookie).send({ targetDays: bad });
            expect(res.status).toBe(400);
        });

        test('only counts plans finished inside the range, and follows the filters', async () => {
            const nutrition = await createForm(workspaceId, 'check-in', 'nutrition-plan');
            const workout = await createForm(workspaceId, 'check-in', 'workout-plan');
            const client = await createClient(workspaceId);
            await finishedAfter(nutrition.id, client.id, 5, ownerId, 1);
            await finishedAfter(workout.id, client.id, 5, ownerId, 1);
            await finishedAfter(nutrition.id, client.id, 5, ownerId, 24 * 40);   // 40 days ago

            expect((await get(ownerCookie)).body.finished).toBe(2);
            expect((await get(ownerCookie, '&action=workout')).body.finished).toBe(1);
        });

        test('rejects a bad range, is owner/manager only, and is tenant scoped', async () => {
            expect((await request.get('/api/operations/service-level?from=bad&to=worse').set('Cookie', ownerCookie)).status).toBe(400);
            const trainer = await addMember(workspaceId, 'trainer');
            expect((await get(trainer.cookie)).status).toBe(403);
            expect((await request.put('/api/operations/service-target').set('Cookie', trainer.cookie).send({ targetDays: 3 })).status).toBe(403);
            expect((await request.get('/api/operations/service-level')).status).toBe(401);

            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const form = await createForm(otherWs.id);
            const client = await createClient(otherWs.id);
            const created = await createRequest(otherWs.id, form.id, client.id, { status: 'reviewed' });
            await testPrisma.form_requests.update({ where: { id: created.id }, data: { submitted_at: new Date(Date.now() - 5 * HOUR), action_taken_at: new Date() } });
            expect((await get(ownerCookie)).body.finished).toBe(0);
        });
    });

    describe('who finished a plan is recorded', () => {
        test('marking a submission done in the Plans Queue records the finisher, and undo clears it', async () => {
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            const created = await createRequest(workspaceId, form.id, client.id, { status: 'submitted' });
            const manager = await addMember(workspaceId, 'manager');

            await request.patch('/api/forms/queue/review').set('Cookie', manager.cookie).send({ ids: [created.id] });
            let stored = await testPrisma.form_requests.findUnique({ where: { id: created.id } });
            expect(stored).toMatchObject({ status: 'reviewed', action_taken_by: manager.user.id });

            await request.patch('/api/forms/queue/review').set('Cookie', manager.cookie).send({ ids: [created.id], action: 'undo' });
            stored = await testPrisma.form_requests.findUnique({ where: { id: created.id } });
            expect(stored).toMatchObject({ status: 'submitted', action_taken_by: null, action_taken_at: null });
        });
    });

    describe('days off', () => {
        const todayWeekday = new Date().getUTCDay();   // requests below pass timeZone=UTC
        const putCapacity = (cookie: string, memberId: string, body: object) =>
            request.put(`/api/operations/capacity/members/${memberId}`).set('Cookie', cookie).send(body);

        test('stores days off with the capacity, and logs the before/after in history', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const res = await putCapacity(ownerCookie, trainer.member.id, { dailyCapacity: 6, daysOff: [6, 5] });
            expect(res.status).toBe(200);

            const stored = await testPrisma.workspace_members.findUnique({ where: { id: trainer.member.id } });
            expect(stored?.days_off).toEqual([5, 6]);

            const history = await request.get(`/api/operations/capacity/history/${trainer.user.id}`).set('Cookie', ownerCookie);
            expect(history.body[0]).toMatchObject({ previousCapacity: null, newCapacity: 6, previousDaysOff: [], newDaysOff: [5, 6] });
        });

        test('a days-off-only change is logged, and an unchanged save is not', async () => {
            const trainer = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 6 });
            await putCapacity(ownerCookie, trainer.member.id, { dailyCapacity: 6, daysOff: [5] });
            await putCapacity(ownerCookie, trainer.member.id, { dailyCapacity: 6, daysOff: [5] });
            expect(await testPrisma.capacity_history.count({ where: { user_id: trainer.user.id } })).toBe(1);
        });

        test('omitting daysOff leaves the existing days off alone', async () => {
            const trainer = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 6, days_off: [0] });
            await putCapacity(ownerCookie, trainer.member.id, { dailyCapacity: 9 });
            const stored = await testPrisma.workspace_members.findUnique({ where: { id: trainer.member.id } });
            expect(stored).toMatchObject({ daily_plan_capacity: 9, days_off: [0] });
        });

        test.each([[[0, 1, 2, 3, 4, 5, 6]], [[7]], [['5']], ['5'], [null]])('rejects invalid daysOff %p with 400 and changes nothing', async (bad) => {
            const trainer = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 6 });
            const res = await putCapacity(ownerCookie, trainer.member.id, { dailyCapacity: 9, daysOff: bad });
            expect(res.status).toBe(400);
            expect((await testPrisma.workspace_members.findUnique({ where: { id: trainer.member.id } }))?.daily_plan_capacity).toBe(6);
        });

        test('owner days off are saved and returned with the owner capacity', async () => {
            await request.put('/api/operations/capacity/owner').set('Cookie', ownerCookie).send({ dailyCapacity: 4, daysOff: [6] });
            const res = await request.get('/api/operations/capacity').set('Cookie', ownerCookie);
            expect(res.body).toEqual({ ownerDailyCapacity: 4, ownerDaysOff: [6] });
        });

        test('the summary leaves a person out of a 1-day window that falls on their day off', async () => {
            const off = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 10, days_off: [todayWeekday] });
            await addMember(workspaceId, 'trainer', { daily_plan_capacity: 4 });
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            await createRequest(workspaceId, form.id, client.id, { assignedTo: off.user.id });

            const res = await request.get('/api/operations/summary?horizonDays=1&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.capacity).toMatchObject({ total: 14, today: 4, inHorizon: 4 });
            const row = res.body.trainers.find((t: { userId: string }) => t.userId === off.user.id);
            expect(row).toMatchObject({ workingDaysInHorizon: 0, utilizationPct: null, daysOff: [todayWeekday] });
        });

        test('a 7-day window counts six working days for someone off one weekday, and reports days to clear', async () => {
            await addMember(workspaceId, 'trainer', { daily_plan_capacity: 10, days_off: [todayWeekday] });
            const form = await createForm(workspaceId);
            const client = await createClient(workspaceId);
            for (let i = 0; i < 12; i++) await createRequest(workspaceId, form.id, client.id);

            const res = await request.get('/api/operations/summary?horizonDays=7&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.capacity.inHorizon).toBe(60);
            // Off today, so day 1 clears nothing; day 2 clears 10; day 3 clears the rest.
            expect(res.body.utilization.daysToClear).toBe(3);
        });

        test('bulk set can give every newly-set member the same days off', async () => {
            const unset = await addMember(workspaceId, 'trainer');
            const res = await request.post('/api/operations/capacity/bulk').set('Cookie', ownerCookie).send({ dailyCapacity: 5, daysOff: [5, 6] });
            expect(res.status).toBe(200);
            expect(await testPrisma.workspace_members.findUnique({ where: { id: unset.member.id } })).toMatchObject({ daily_plan_capacity: 5, days_off: [5, 6] });
        });

        test('the chart capacity is zero on a person\'s days off', async () => {
            const joined = new Date('2026-01-01T00:00:00Z');
            // 2026-10-10 Sat, 11 Sun, 12 Mon, 13 Tue; off Sat+Sun.
            await addMember(workspaceId, 'trainer', { daily_plan_capacity: 8, days_off: [6, 0], joined_at: joined });
            const res = await request.get('/api/operations/demand-trend?from=2026-10-10&to=2026-10-13&timeZone=UTC').set('Cookie', ownerCookie);
            expect(res.body.points.map((p: { capacity: number }) => p.capacity)).toEqual([0, 0, 8, 8]);
        });
    });

    describe('capacity editing', () => {
        test('owner can set and clear a member\'s capacity', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const set = await request.put(`/api/operations/capacity/members/${trainer.member.id}`)
                .set('Cookie', ownerCookie).send({ dailyCapacity: 7 });
            expect(set.status).toBe(200);
            expect((await testPrisma.workspace_members.findUnique({ where: { id: trainer.member.id } }))?.daily_plan_capacity).toBe(7);

            const cleared = await request.put(`/api/operations/capacity/members/${trainer.member.id}`)
                .set('Cookie', ownerCookie).send({ dailyCapacity: null });
            expect(cleared.status).toBe(200);
            expect((await testPrisma.workspace_members.findUnique({ where: { id: trainer.member.id } }))?.daily_plan_capacity).toBeNull();
        });

        test.each([[-1], [1.5], [501], ['5']])('rejects invalid capacity %p with 400', async (bad) => {
            const trainer = await addMember(workspaceId, 'trainer');
            const res = await request.put(`/api/operations/capacity/members/${trainer.member.id}`)
                .set('Cookie', ownerCookie).send({ dailyCapacity: bad });
            expect(res.status).toBe(400);
        });

        test('a trainer cannot edit capacity', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const res = await request.put(`/api/operations/capacity/members/${trainer.member.id}`)
                .set('Cookie', trainer.cookie).send({ dailyCapacity: 99 });
            expect(res.status).toBe(403);
        });

        test('cannot edit a member belonging to another workspace (404)', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const foreign = await addMember(otherWs.id, 'trainer');
            const res = await request.put(`/api/operations/capacity/members/${foreign.member.id}`)
                .set('Cookie', ownerCookie).send({ dailyCapacity: 3 });
            expect(res.status).toBe(404);
            expect((await testPrisma.workspace_members.findUnique({ where: { id: foreign.member.id } }))?.daily_plan_capacity).toBeNull();
        });

        test('owner capacity can be set, read back and cleared', async () => {
            expect((await request.put('/api/operations/capacity/owner').set('Cookie', ownerCookie).send({ dailyCapacity: 5 })).status).toBe(200);
            expect((await request.get('/api/operations/capacity').set('Cookie', ownerCookie)).body).toEqual({ ownerDailyCapacity: 5, ownerDaysOff: [] });
            await request.put('/api/operations/capacity/owner').set('Cookie', ownerCookie).send({ dailyCapacity: null });
            expect((await request.get('/api/operations/capacity').set('Cookie', ownerCookie)).body).toEqual({ ownerDailyCapacity: null, ownerDaysOff: [] });
        });

        test('each change is logged with previous value, new value, who and when; no-op saves are not', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            const put = (dailyCapacity: number | null) => request
                .put(`/api/operations/capacity/members/${trainer.member.id}`).set('Cookie', ownerCookie).send({ dailyCapacity });

            await put(5);
            await put(5); // unchanged: must not add a row
            await put(8);
            await put(null);

            const res = await request.get(`/api/operations/capacity/history/${trainer.user.id}`).set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.map((e: { previousCapacity: number | null; newCapacity: number | null }) => [e.previousCapacity, e.newCapacity]))
                .toEqual([[8, null], [5, 8], [null, 5]]); // newest first
            expect(res.body[0].changedByName).toBe('Test Coach');
            expect(new Date(res.body[0].changedAt).getTime()).toBeGreaterThan(Date.now() - 60000);
        });

        test('owner capacity changes are logged under the owner\'s user id', async () => {
            await request.put('/api/operations/capacity/owner').set('Cookie', ownerCookie).send({ dailyCapacity: 4 });
            const res = await request.get(`/api/operations/capacity/history/${ownerId}`).set('Cookie', ownerCookie);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toMatchObject({ previousCapacity: null, newCapacity: 4 });
        });

        test('a rejected update (invalid value) writes no history', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            await request.put(`/api/operations/capacity/members/${trainer.member.id}`).set('Cookie', ownerCookie).send({ dailyCapacity: -3 });
            expect(await testPrisma.capacity_history.count({ where: { user_id: trainer.user.id } })).toBe(0);
        });

        test('history is manager/owner only, and tenant-scoped', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            expect((await request.get(`/api/operations/capacity/history/${trainer.user.id}`).set('Cookie', trainer.cookie)).status).toBe(403);

            const manager = await addMember(workspaceId, 'manager');
            expect((await request.get(`/api/operations/capacity/history/${trainer.user.id}`).set('Cookie', manager.cookie)).status).toBe(200);

            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const foreign = await addMember(otherWs.id, 'trainer');
            await testPrisma.capacity_history.create({ data: { id: createId(), workspace_id: otherWs.id, user_id: foreign.user.id, new_capacity: 9 } });
            expect((await request.get(`/api/operations/capacity/history/${foreign.user.id}`).set('Cookie', ownerCookie)).status).toBe(404);
        });

        test('summary rows carry the memberId the dashboard needs to edit capacity', async () => {
            const trainer = await addMember(workspaceId, 'trainer', { daily_plan_capacity: 3 });
            const unset = await addMember(workspaceId, 'nutritionist');
            const res = await request.get('/api/operations/summary').set('Cookie', ownerCookie);
            expect(res.body.trainers[0].memberId).toBe(trainer.member.id);
            expect(res.body.notConfigured[0].memberId).toBe(unset.member.id);
        });

        test('a trainer cannot read or edit owner capacity', async () => {
            const trainer = await addMember(workspaceId, 'trainer');
            expect((await request.get('/api/operations/capacity').set('Cookie', trainer.cookie)).status).toBe(403);
            expect((await request.put('/api/operations/capacity/owner').set('Cookie', trainer.cookie).send({ dailyCapacity: 5 })).status).toBe(403);
        });
    });
});
