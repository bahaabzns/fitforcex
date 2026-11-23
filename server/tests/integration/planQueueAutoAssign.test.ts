import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { prisma } from '../../src/lib/prisma';

const NUTRITION = 'nutrition-plan';
const WORKOUT = 'workout-plan';
const FORMS_WRITE = { forms: { read: true, write: true, delete: false } };

describe('Plans Queue — auto-assign this client to the same agent next time', () => {
    let workspaceId: string;
    let ownerId: string;
    let ownerCookie: string;
    let formId: string;
    let clientId: string;

    async function createMember(role: string, isActive = true) {
        const user = await createTestUser({ fname: role, lname: 'Member' });
        await testPrisma.workspace_members.create({
            data: { id: createId(), workspace_id: workspaceId, user_id: user.id, role, is_active: isActive },
        });
        return user;
    }

    async function createClientIn(wsId: string) {
        return testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000, fname: 'Sara', lname: 'Client',
                email: `client-${createId()}@test.com`, workspace_id: wsId,
            },
        });
    }

    async function createRequest(status: 'submitted' | 'pending', planType: string, forClientId = clientId) {
        return testPrisma.form_requests.create({
            data: {
                id: createId(), workspace_id: workspaceId, form_id: formId, client_id: forClientId,
                status, post_action: planType, submitted_at: status === 'submitted' ? new Date() : null,
            },
        });
    }

    const assign = (cookie: string, ids: string[], assignedTo: string, autoAssign?: boolean) =>
        request.patch('/api/forms/queue/assign').set('Cookie', cookie).send({ ids, assignedTo, autoAssign });

    const clientSubmits = (requestId: string, forClientId = clientId) =>
        request.post(`/api/client-portal/form-requests/${requestId}/submit`)
            .set('Cookie', makeClientCookie(forClientId, workspaceId)).send({ answers: [] });

    const activeRules = () => testPrisma.client_auto_assign.findMany({ where: { workspace_id: workspaceId, disabled_at: null } });
    const assigneeOf = async (requestId: string) =>
        (await testPrisma.form_requests.findUnique({ where: { id: requestId } }))!.assigned_to;

    beforeEach(async () => {
        const owner = await createTestUser();
        ownerId = owner.id;
        workspaceId = (await createTestWorkspace(owner.id)).id;
        ownerCookie = await makeAuthCookie(owner.id, workspaceId, 'owner');
        formId = (await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspaceId, title_en: 'Check-in' } })).id;
        clientId = (await createClientIn(workspaceId)).id;
    });

    describe('turning on auto-assign for a queue row', () => {
        // The row is assigned the normal way first; auto-assign is a separate, explicit step.
        async function assignedRow(planType: string, agentId: string, forClientId = clientId) {
            const row = await createRequest('submitted', planType, forClientId);
            await testPrisma.form_requests.update({ where: { id: row.id }, data: { assigned_to: agentId } });
            return row;
        }
        const turnOn = (cookie: string, requestId: string) =>
            request.post('/api/forms/queue/auto-assign').set('Cookie', cookie).send({ requestId });

        test("saves a rule for that client and plan type pointing at the row's assignee, with who set it", async () => {
            const sara = await createMember('nutritionist');
            const row = await assignedRow(NUTRITION, sara.id);

            const res = await turnOn(ownerCookie, row.id);

            expect(res.status).toBe(200);
            expect(res.body.outcome).toBe('enabled');
            const rules = await activeRules();
            expect(rules).toHaveLength(1);
            expect(rules[0]).toMatchObject({
                client_id: clientId, plan_type: NUTRITION, agent_user_id: sara.id, enabled_by: ownerId,
            });
        });

        test('assigning a row never creates a rule by itself', async () => {
            const sara = await createMember('nutritionist');
            const row = await createRequest('submitted', NUTRITION);

            const res = await assign(ownerCookie, [row.id], sara.id);

            expect(res.status).toBe(200);
            expect(await activeRules()).toHaveLength(0);
        });

        test('a nutrition row and a workout row for one client create two separate rules', async () => {
            const sara = await createMember('nutritionist');
            const omar = await createMember('trainer');
            const nutritionRow = await assignedRow(NUTRITION, sara.id);
            const workoutRow = await assignedRow(WORKOUT, omar.id);

            await turnOn(ownerCookie, nutritionRow.id);
            await turnOn(ownerCookie, workoutRow.id);

            const byType = Object.fromEntries((await activeRules()).map((r) => [r.plan_type, r.agent_user_id]));
            expect(byType).toEqual({ [NUTRITION]: sara.id, [WORKOUT]: omar.id });
        });

        test('rows that do not produce a plan cannot be auto-assigned', async () => {
            const sara = await createMember('nutritionist');
            const row = await assignedRow('nothing', sara.id);

            const res = await turnOn(ownerCookie, row.id);

            expect(res.status).toBe(400);
            expect(await activeRules()).toHaveLength(0);
        });

        test('an unassigned row cannot be auto-assigned (400) because there is nobody to point the rule at', async () => {
            const row = await createRequest('submitted', NUTRITION);

            const res = await turnOn(ownerCookie, row.id);

            expect(res.status).toBe(400);
            expect(await activeRules()).toHaveLength(0);
        });

        test('turning it on again for the same agent does not pile up duplicate rules', async () => {
            const sara = await createMember('nutritionist');
            const row = await assignedRow(NUTRITION, sara.id);

            await turnOn(ownerCookie, row.id);
            const again = await turnOn(ownerCookie, row.id);

            expect(again.body.outcome).toBe('already_on');
            expect(await testPrisma.client_auto_assign.count()).toBe(1);
        });

        test('turning it on for a row now assigned to someone else moves the rule and keeps the old one as history', async () => {
            const sara = await createMember('nutritionist');
            const noor = await createMember('nutritionist');
            const first = await assignedRow(NUTRITION, sara.id);
            await turnOn(ownerCookie, first.id);
            const second = await assignedRow(NUTRITION, noor.id);

            await turnOn(ownerCookie, second.id);

            const rules = await activeRules();
            expect(rules).toHaveLength(1);
            expect(rules[0].agent_user_id).toBe(noor.id);
            const history = await testPrisma.client_auto_assign.findMany({ where: { disabled_at: { not: null } } });
            expect(history).toHaveLength(1);
            expect(history[0]).toMatchObject({ agent_user_id: sara.id, disabled_reason: 'moved', disabled_by: ownerId });
        });

        test('an assignee who cannot produce plans (receptionist) is refused and no rule is saved', async () => {
            const receptionist = await createMember('receptionist');
            const row = await assignedRow(NUTRITION, receptionist.id);

            const res = await turnOn(ownerCookie, row.id);

            expect(res.status).toBe(400);
            expect(await activeRules()).toHaveLength(0);
        });

        test('a trainer with forms-write cannot turn it on (403)', async () => {
            const trainer = await createMember('trainer');
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', FORMS_WRITE);
            const row = await assignedRow(NUTRITION, trainer.id);

            const res = await turnOn(trainerCookie, row.id);

            expect(res.status).toBe(403);
            expect(await activeRules()).toHaveLength(0);
        });

        test('a manager can turn it on', async () => {
            const manager = await createMember('manager');
            const sara = await createMember('nutritionist');
            const managerCookie = await makeAuthCookie(manager.id, workspaceId, 'manager', FORMS_WRITE);
            const row = await assignedRow(NUTRITION, sara.id);

            const res = await turnOn(managerCookie, row.id);

            expect(res.status).toBe(200);
        });

        test('a queue item from another workspace returns 404 and creates nothing', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const otherClient = await createClientIn(otherWs.id);
            const otherForm = await testPrisma.forms.create({ data: { id: createId(), workspace_id: otherWs.id, title_en: 'Other' } });
            const foreignRow = await testPrisma.form_requests.create({
                data: {
                    id: createId(), workspace_id: otherWs.id, form_id: otherForm.id, client_id: otherClient.id,
                    status: 'submitted', post_action: NUTRITION, assigned_to: otherOwner.id,
                },
            });

            const res = await turnOn(ownerCookie, foreignRow.id);

            expect(res.status).toBe(404);
            expect(await testPrisma.client_auto_assign.count()).toBe(0);
        });

        test('requires a requestId (400) and a login (401)', async () => {
            expect((await request.post('/api/forms/queue/auto-assign').set('Cookie', ownerCookie).send({})).status).toBe(400);
            expect((await request.post('/api/forms/queue/auto-assign').send({ requestId: 'x' })).status).toBe(401);
        });
    });

    describe('applying a rule when the client submits', () => {
        async function ruleFor(agentId: string, planType: string) {
            await testPrisma.client_auto_assign.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: clientId, plan_type: planType, agent_user_id: agentId, enabled_by: ownerId },
            });
        }
        const notificationsFor = (userId: string) =>
            testPrisma.notifications.findMany({ where: { recipient_id: userId, type: 'checkin.submitted' } });

        test('goes straight to the agent, and only the agent is notified (once)', async () => {
            const sara = await createMember('nutritionist');
            const noor = await createMember('trainer');
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', NUTRITION);

            const res = await clientSubmits(row.id);

            expect(res.status).toBe(200);
            expect(await assigneeOf(row.id)).toBe(sara.id);
            const saraNotes = await notificationsFor(sara.id);
            expect(saraNotes).toHaveLength(1);
            expect(saraNotes[0].body).toBe('Auto-assigned to you');
            expect(await notificationsFor(noor.id)).toHaveLength(0);
            expect(await notificationsFor(ownerId)).toHaveLength(0);
        });

        test('a nutrition rule does not catch the same client\'s workout form', async () => {
            const sara = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', WORKOUT);

            await clientSubmits(row.id);

            expect(await assigneeOf(row.id)).toBeNull();
            expect(await notificationsFor(ownerId)).toHaveLength(1);
        });

        test('a client with no rule behaves exactly as before: unassigned, whole team notified', async () => {
            const row = await createRequest('pending', NUTRITION);

            await clientSubmits(row.id);

            expect(await assigneeOf(row.id)).toBeNull();
            expect(await notificationsFor(ownerId)).toHaveLength(1);
        });

        test('two forms submitted back to back both go to the agent', async () => {
            const sara = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION);
            const first = await createRequest('pending', NUTRITION);
            const second = await createRequest('pending', NUTRITION);

            await Promise.all([clientSubmits(first.id), clientSubmits(second.id)]);

            expect(await assigneeOf(first.id)).toBe(sara.id);
            expect(await assigneeOf(second.id)).toBe(sara.id);
        });

        test('an inactive agent: the form falls back to the team, the rule survives, and it resumes when they return', async () => {
            const sara = await createMember('nutritionist', false);
            await ruleFor(sara.id, NUTRITION);
            const whileAway = await createRequest('pending', NUTRITION);

            await clientSubmits(whileAway.id);

            expect(await assigneeOf(whileAway.id)).toBeNull();
            expect(await notificationsFor(ownerId)).toHaveLength(1);
            const [rule] = await activeRules();
            expect(rule.last_skip_reason).toBe('agent_unavailable');
            expect(rule.last_skipped_at).not.toBeNull();

            await testPrisma.workspace_members.updateMany({ where: { user_id: sara.id }, data: { is_active: true } });
            const afterReturn = await createRequest('pending', NUTRITION);
            await clientSubmits(afterReturn.id);

            expect(await assigneeOf(afterReturn.id)).toBe(sara.id);
        });

        test('an agent moved to a role that does not produce plans is skipped', async () => {
            const sara = await createMember('viewer');
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', NUTRITION);

            await clientSubmits(row.id);

            expect(await assigneeOf(row.id)).toBeNull();
        });

        test('an agent at or over capacity still receives the form', async () => {
            const sara = await createMember('nutritionist');
            await testPrisma.workspace_members.updateMany({ where: { user_id: sara.id }, data: { daily_plan_capacity: 1 } });
            for (let i = 0; i < 3; i++) {
                const busy = await createRequest('submitted', NUTRITION, (await createClientIn(workspaceId)).id);
                await testPrisma.form_requests.update({ where: { id: busy.id }, data: { assigned_to: sara.id } });
            }
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', NUTRITION);

            await clientSubmits(row.id);

            expect(await assigneeOf(row.id)).toBe(sara.id);
        });

        test('a client on an expired subscription is still auto-assigned', async () => {
            const sara = await createMember('nutritionist');
            await testPrisma.clients.update({ where: { id: clientId }, data: { subscription_status: 'Expired' } });
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', NUTRITION);

            await clientSubmits(row.id);

            expect(await assigneeOf(row.id)).toBe(sara.id);
        });

        test('a manual assignment made while the form was pending wins over the rule', async () => {
            const sara = await createMember('nutritionist');
            const noor = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', NUTRITION);
            await testPrisma.form_requests.update({ where: { id: row.id }, data: { assigned_to: noor.id } });

            await clientSubmits(row.id);

            expect(await assigneeOf(row.id)).toBe(noor.id);
        });

        test('if auto-assign blows up, the submission still succeeds and falls back to the team', async () => {
            const sara = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', NUTRITION);
            const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const lookup = jest.spyOn(prisma.client_auto_assign, 'findFirst').mockRejectedValueOnce(new Error('db hiccup'));

            const res = await clientSubmits(row.id);

            lookup.mockRestore();
            errorLog.mockRestore();
            expect(res.status).toBe(200);
            expect((await testPrisma.form_requests.findUnique({ where: { id: row.id } }))!.status).toBe('submitted');
            expect(await assigneeOf(row.id)).toBeNull();
            expect(await notificationsFor(ownerId)).toHaveLength(1);
        });

        test('if auto-assign hangs, the client still gets their answer within the time limit and the team is notified', async () => {
            const { AUTO_ASSIGN_TIMEOUT_MS } = await import('../../src/modules/forms/autoAssign.service');
            const sara = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', NUTRITION);
            const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            // A database call that never answers (stalled connection / exhausted pool).
            const lookup = jest.spyOn(prisma.client_auto_assign, 'findFirst').mockImplementationOnce(
                () => new Promise(() => undefined) as never,
            );

            const startedAt = Date.now();
            const res = await clientSubmits(row.id);
            const elapsedMs = Date.now() - startedAt;

            lookup.mockRestore();
            errorLog.mockRestore();
            expect(res.status).toBe(200);
            expect(elapsedMs).toBeLessThan(AUTO_ASSIGN_TIMEOUT_MS + 2000);
            expect((await testPrisma.form_requests.findUnique({ where: { id: row.id } }))!.status).toBe('submitted');
            expect(await assigneeOf(row.id)).toBeNull();
            expect(await notificationsFor(ownerId)).toHaveLength(1);
        }, 15000);

        test('an agent whose every day is a day off still receives the form (the manager\'s rule wins over the schedule)', async () => {
            const sara = await createMember('nutritionist');
            await testPrisma.workspace_members.updateMany({ where: { user_id: sara.id }, data: { days_off: [0, 1, 2, 3, 4, 5, 6] } });
            await ruleFor(sara.id, NUTRITION);
            const row = await createRequest('pending', NUTRITION);

            await clientSubmits(row.id);

            expect(await assigneeOf(row.id)).toBe(sara.id);
        });

        test('reassigning an auto-assigned form by hand moves only that form; the rule keeps pointing at the agent', async () => {
            const sara = await createMember('nutritionist');
            const noor = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION);
            const first = await createRequest('pending', NUTRITION);
            await clientSubmits(first.id);
            expect(await assigneeOf(first.id)).toBe(sara.id);

            const reassigned = await assign(ownerCookie, [first.id], noor.id);
            const next = await createRequest('pending', NUTRITION);
            await clientSubmits(next.id);

            expect(reassigned.status).toBe(200);
            expect(await assigneeOf(first.id)).toBe(noor.id);
            expect(await assigneeOf(next.id)).toBe(sara.id);
            expect(await activeRules()).toMatchObject([{ agent_user_id: sara.id, plan_type: NUTRITION }]);
        });
    });

    describe('auto-assign while assigning (the "Auto-assign when I assign" switch)', () => {
        test('assigning with the switch on saves the rule in the same request and returns it', async () => {
            const sara = await createMember('nutritionist');
            const row = await createRequest('submitted', NUTRITION);

            const res = await assign(ownerCookie, [row.id], sara.id, true);

            expect(res.status).toBe(200);
            expect(await assigneeOf(row.id)).toBe(sara.id);
            expect(res.body.autoAssign.rulesSet).toBe(1);
            const [rule] = await activeRules();
            expect(rule).toMatchObject({ client_id: clientId, plan_type: NUTRITION, agent_user_id: sara.id, enabled_by: ownerId });
            expect(res.body.autoAssign.rules).toEqual([{ id: rule.id, clientId, planType: NUTRITION }]);
        });

        test('bulk assigning several clients with the switch on creates one rule per client and plan type', async () => {
            const sara = await createMember('nutritionist');
            const other = await createClientIn(workspaceId);
            const rows = [
                await createRequest('submitted', NUTRITION),
                await createRequest('submitted', WORKOUT),
                await createRequest('submitted', NUTRITION, other.id),
                await createRequest('submitted', 'nothing', other.id),
            ];

            const res = await assign(ownerCookie, rows.map((r) => r.id), sara.id, true);

            expect(res.body.autoAssign.rulesSet).toBe(3);
            const keys = (await activeRules()).map((r) => `${r.client_id}:${r.plan_type}`).sort();
            expect(keys).toEqual([`${clientId}:${NUTRITION}`, `${clientId}:${WORKOUT}`, `${other.id}:${NUTRITION}`].sort());
        });

        test('bulk assigning 1,100 clients at once works (more than one internal batch)', async () => {
            const sara = await createMember('nutritionist');
            const clientRows = Array.from({ length: 1100 }, (_, i) => ({
                id: createId(), client_code: 100000 + i, fname: 'Bulk', lname: `Client${i}`,
                email: `bulk-${i}-${createId()}@test.com`, workspace_id: workspaceId,
            }));
            await testPrisma.clients.createMany({ data: clientRows });
            const requestRows = clientRows.map((c) => ({
                id: createId(), workspace_id: workspaceId, form_id: formId, client_id: c.id,
                status: 'submitted', post_action: NUTRITION, submitted_at: new Date(),
            }));
            await testPrisma.form_requests.createMany({ data: requestRows });

            const res = await assign(ownerCookie, requestRows.map((r) => r.id), sara.id, true);

            expect(res.status).toBe(200);
            expect(res.body.autoAssign.rulesSet).toBe(1100);
            expect(res.body.autoAssign.rules).toHaveLength(1100);
            expect(await testPrisma.client_auto_assign.count({ where: { disabled_at: null } })).toBe(1100);
        }, 120000);

        test('assigning without the switch creates no rule', async () => {
            const sara = await createMember('nutritionist');
            const row = await createRequest('submitted', NUTRITION);

            const res = await assign(ownerCookie, [row.id], sara.id);

            expect(res.body.autoAssign).toBeNull();
            expect(await activeRules()).toHaveLength(0);
        });

        test('assigning with the switch on to a different agent moves the rule and keeps history', async () => {
            const sara = await createMember('nutritionist');
            const noor = await createMember('nutritionist');
            const row = await createRequest('submitted', NUTRITION);

            await assign(ownerCookie, [row.id], sara.id, true);
            await assign(ownerCookie, [row.id], noor.id, true);

            const rules = await activeRules();
            expect(rules).toHaveLength(1);
            expect(rules[0].agent_user_id).toBe(noor.id);
            const history = await testPrisma.client_auto_assign.findMany({ where: { disabled_at: { not: null } } });
            expect(history).toHaveLength(1);
            expect(history[0]).toMatchObject({ agent_user_id: sara.id, disabled_reason: 'moved', disabled_by: ownerId });
        });

        test('the same agent twice does not duplicate the rule', async () => {
            const sara = await createMember('nutritionist');
            const row = await createRequest('submitted', NUTRITION);

            await assign(ownerCookie, [row.id], sara.id, true);
            const again = await assign(ownerCookie, [row.id], sara.id, true);

            expect(again.body.autoAssign.rulesSet).toBe(0);
            expect(await testPrisma.client_auto_assign.count()).toBe(1);
        });

        test('an agent who cannot produce plans (receptionist) is assigned but no rule is saved', async () => {
            const receptionist = await createMember('receptionist');
            const row = await createRequest('submitted', NUTRITION);

            const res = await assign(ownerCookie, [row.id], receptionist.id, true);

            expect(res.status).toBe(200);
            expect(res.body.autoAssign).toMatchObject({ rulesSet: 0, skipped: 'agent_not_eligible' });
            expect(await assigneeOf(row.id)).toBe(receptionist.id);
            expect(await activeRules()).toHaveLength(0);
        });

        test('a trainer with forms-write can still assign, but the switch is ignored', async () => {
            const trainer = await createMember('trainer');
            const sara = await createMember('nutritionist');
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', FORMS_WRITE);
            const row = await createRequest('submitted', NUTRITION);

            const res = await assign(trainerCookie, [row.id], sara.id, true);

            expect(res.status).toBe(200);
            expect(await assigneeOf(row.id)).toBe(sara.id);
            expect(res.body.autoAssign).toBeNull();
            expect(await activeRules()).toHaveLength(0);
        });

        test('a manager can use the switch', async () => {
            const manager = await createMember('manager');
            const sara = await createMember('nutritionist');
            const managerCookie = await makeAuthCookie(manager.id, workspaceId, 'manager', FORMS_WRITE);
            const row = await createRequest('submitted', NUTRITION);

            const res = await assign(managerCookie, [row.id], sara.id, true);

            expect(res.body.autoAssign.rulesSet).toBe(1);
        });

        test('unassigning never creates a rule', async () => {
            const row = await createRequest('submitted', NUTRITION);

            const res = await request.patch('/api/forms/queue/assign').set('Cookie', ownerCookie)
                .send({ ids: [row.id], assignedTo: null, autoAssign: true });

            expect(res.status).toBe(200);
            expect(await activeRules()).toHaveLength(0);
        });
    });

    describe('seeing and turning off rules', () => {
        async function ruleFor(agentId: string, planType = NUTRITION, forClientId = clientId) {
            return testPrisma.client_auto_assign.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: forClientId, plan_type: planType, agent_user_id: agentId, enabled_by: ownerId },
            });
        }
        const listRules = (query = '') => request.get(`/api/forms/queue/auto-assign${query}`).set('Cookie', ownerCookie);

        test('lists one row per client with its nutrition and workout agent, availability and who set it', async () => {
            const sara = await createMember('nutritionist');
            const omar = await createMember('trainer', false);
            const nutritionRule = await ruleFor(sara.id, NUTRITION);
            const workoutRule = await ruleFor(omar.id, WORKOUT);

            const res = await listRules();

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ total: 1, totalRules: 2, page: 1, pageSize: 25 });
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0]).toMatchObject({
                clientId, clientName: 'Sara Client',
                nutrition: { id: nutritionRule.id, agentUserId: sara.id, agentName: 'nutritionist Member', agentAvailable: true },
                workout: { id: workoutRule.id, agentUserId: omar.id, agentName: 'trainer Member', agentAvailable: false },
            });
            expect(res.body.items[0].enabledAt).not.toBeNull();
        });

        test('a client with only one rule has an empty cell for the other plan type', async () => {
            const sara = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION);

            const [row] = (await listRules()).body.items;

            expect(row.nutrition).not.toBeNull();
            expect(row.workout).toBeNull();
        });

        test('pages through many rules without returning them all at once', async () => {
            const sara = await createMember('nutritionist');
            const manyClients = Array.from({ length: 30 }, (_, i) => ({
                id: createId(), client_code: 200000 + i, fname: 'Page', lname: `Client${i}`,
                email: `page-${i}-${createId()}@test.com`, workspace_id: workspaceId,
            }));
            await testPrisma.clients.createMany({ data: manyClients });
            await testPrisma.client_auto_assign.createMany({
                data: manyClients.map((c) => ({ id: createId(), workspace_id: workspaceId, client_id: c.id, plan_type: NUTRITION, agent_user_id: sara.id })),
            });

            const first = await listRules('?pageSize=25');
            const second = await listRules('?pageSize=25&page=2');
            const huge = await listRules('?pageSize=100000');

            expect(first.body.total).toBe(30);
            expect(first.body.items).toHaveLength(25);
            expect(second.body.items).toHaveLength(5);
            const ids = [...first.body.items, ...second.body.items].map((r: { clientId: string }) => r.clientId);
            expect(new Set(ids).size).toBe(30);
            expect(huge.body.pageSize).toBe(100);
        });

        test('searches by client name, email or code, ignoring case, and treats % and _ literally', async () => {
            const sara = await createMember('nutritionist');
            const ahmed = await testPrisma.clients.create({
                data: { id: createId(), client_code: 300001, fname: 'Ahmed', lname: 'Zaki', email: 'ahmed.zaki@test.com', workspace_id: workspaceId },
            });
            await ruleFor(sara.id, NUTRITION, ahmed.id);
            await ruleFor(sara.id, NUTRITION, clientId);

            expect((await listRules('?search=ahmed zaki')).body.items.map((r: { clientId: string }) => r.clientId)).toEqual([ahmed.id]);
            expect((await listRules('?search=ZAKI@test')).body.total).toBe(1);
            expect((await listRules('?search=300001')).body.items.map((r: { clientId: string }) => r.clientId)).toEqual([ahmed.id]);
            expect((await listRules('?search=%25')).body.total).toBe(0);
            expect((await listRules('?search=nobody')).body.total).toBe(0);
        });

        test('filters by agent and by agent unavailable; a client is listed when either of its rules matches', async () => {
            const sara = await createMember('nutritionist');
            const omar = await createMember('trainer', false);
            const otherClient = await createClientIn(workspaceId);
            await ruleFor(sara.id, NUTRITION, clientId);
            await ruleFor(omar.id, WORKOUT, clientId);
            await ruleFor(sara.id, NUTRITION, otherClient.id);

            const bySara = await listRules(`?agentUserId=${sara.id}`);
            const byOmar = await listRules(`?agentUserId=${omar.id}`);
            const unavailable = await listRules('?status=unavailable');

            expect(bySara.body).toMatchObject({ total: 2, totalRules: 2 });
            expect(byOmar.body.items.map((r: { clientId: string }) => r.clientId)).toEqual([clientId]);
            // The matched client still shows both of its rules, so the manager sees the whole picture.
            expect(byOmar.body.items[0].nutrition.agentUserId).toBe(sara.id);
            expect(unavailable.body.items.map((r: { clientId: string }) => r.clientId)).toEqual([clientId]);
            expect(unavailable.body.items[0].workout.agentAvailable).toBe(false);
        });

        test('sorts by client name, by agent and by date, in either direction', async () => {
            const sara = await createMember('nutritionist');
            const mona = await createMember('manager');   // "manager Member" sorts before "nutritionist Member"
            const adam = await testPrisma.clients.create({
                data: { id: createId(), client_code: 310001, fname: 'Adam', lname: 'Aaron', email: `adam-${createId()}@test.com`, workspace_id: workspaceId },
            });
            await ruleFor(sara.id, NUTRITION, clientId);   // "Sara Client"
            await ruleFor(mona.id, NUTRITION, adam.id);

            const names = async (query: string) => (await listRules(query)).body.items.map((r: { clientName: string }) => r.clientName);

            expect(await names('?sortBy=client&sortDir=asc')).toEqual(['Adam Aaron', 'Sara Client']);
            expect(await names('?sortBy=client&sortDir=desc')).toEqual(['Sara Client', 'Adam Aaron']);
            expect(await names('?sortBy=nutritionAgent&sortDir=asc')).toEqual(['Adam Aaron', 'Sara Client']);
            expect(await names('?sortBy=enabledAt&sortDir=desc')).toHaveLength(2);
            expect(await names('?sortBy=nonsense')).toHaveLength(2);
        });

        test('the owner counts as an available agent, and SQL availability matches the rule that decides assignment', async () => {
            const roles = ['trainer', 'nutritionist', 'manager', 'receptionist', 'viewer'];
            const agents = await Promise.all(roles.flatMap((role) => [createMember(role, true), createMember(role, false)]));
            for (const agent of [...agents, { id: ownerId }]) await ruleFor(agent.id, NUTRITION, (await createClientIn(workspaceId)).id);

            const shown: Record<string, boolean> = Object.fromEntries(
                (await listRules('?pageSize=100')).body.items.map((r: { nutrition: { agentUserId: string; agentAvailable: boolean } }) => [r.nutrition.agentUserId, r.nutrition.agentAvailable]));

            const { canReceivePlans } = await import('../../src/modules/operations/operations.assign');
            for (const agent of [...agents, { id: ownerId }]) {
                expect(shown[agent.id]).toBe(await canReceivePlans(workspaceId, agent.id));
            }
        });

        test('rejects an unknown filter value instead of ignoring it (400)', async () => {
            expect((await listRules('?planType=bogus')).status).toBe(400);
            expect((await listRules('?status=bogus')).status).toBe(400);
        });

        test('flags a rule whose agent is no longer available instead of hiding it', async () => {
            const sara = await createMember('nutritionist', false);
            await ruleFor(sara.id);

            expect((await listRules()).body.items[0].nutrition.agentAvailable).toBe(false);
        });

        test('does not list turned-off rules or rules of archived clients', async () => {
            const sara = await createMember('nutritionist');
            const turnedOff = await ruleFor(sara.id, WORKOUT);
            await testPrisma.client_auto_assign.update({ where: { id: turnedOff.id }, data: { disabled_at: new Date() } });
            const archivedClient = await createClientIn(workspaceId);
            await testPrisma.clients.update({ where: { id: archivedClient.id }, data: { archived_at: new Date() } });
            await ruleFor(sara.id, NUTRITION, archivedClient.id);

            const res = await listRules();

            expect(res.body.total).toBe(0);
            expect(res.body.items).toHaveLength(0);
        });

        test("never shows another workspace's rules", async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const otherClient = await createClientIn(otherWs.id);
            await testPrisma.client_auto_assign.create({
                data: { id: createId(), workspace_id: otherWs.id, client_id: otherClient.id, plan_type: NUTRITION, agent_user_id: otherOwner.id },
            });

            expect((await listRules()).body.total).toBe(0);
        });

        test('queue rows carry their own rule, so the page never needs the full list', async () => {
            const sara = await createMember('nutritionist');
            const rule = await ruleFor(sara.id, NUTRITION);
            const nutritionRow = await createRequest('submitted', NUTRITION);
            const workoutRow = await createRequest('submitted', WORKOUT);

            const res = await request.get('/api/forms/queue').set('Cookie', ownerCookie);

            const byId = Object.fromEntries(res.body.map((r: { id: string }) => [r.id, r]));
            expect(byId[nutritionRow.id]).toMatchObject({ autoAssignRuleId: rule.id, autoAssignAgentName: 'nutritionist Member' });
            expect(byId[workoutRow.id]).toMatchObject({ autoAssignRuleId: null, autoAssignAgentName: null });
            expect(res.body).toHaveLength(2);
        });

        test('the manager can turn a rule off; it is logged and the next submission goes to the shared queue', async () => {
            const sara = await createMember('nutritionist');
            const rule = await ruleFor(sara.id);

            const res = await request.patch(`/api/forms/queue/auto-assign/${rule.id}/off`).set('Cookie', ownerCookie);

            expect(res.status).toBe(200);
            const stored = await testPrisma.client_auto_assign.findUnique({ where: { id: rule.id } });
            expect(stored).toMatchObject({ disabled_by: ownerId, disabled_reason: 'turned_off' });
            expect(stored!.disabled_at).not.toBeNull();

            const row = await createRequest('pending', NUTRITION);
            await clientSubmits(row.id);
            expect(await assigneeOf(row.id)).toBeNull();
        });

        test('a trainer cannot turn a rule off (403) and the rule stays active', async () => {
            const trainer = await createMember('trainer');
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', FORMS_WRITE);
            const rule = await ruleFor(trainer.id);

            const res = await request.patch(`/api/forms/queue/auto-assign/${rule.id}/off`).set('Cookie', trainerCookie);

            expect(res.status).toBe(403);
            expect(await activeRules()).toHaveLength(1);
        });

        test('turning off a rule that belongs to another workspace returns 404 and changes nothing', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const otherClient = await createClientIn(otherWs.id);
            const foreign = await testPrisma.client_auto_assign.create({
                data: { id: createId(), workspace_id: otherWs.id, client_id: otherClient.id, plan_type: NUTRITION, agent_user_id: otherOwner.id },
            });

            const res = await request.patch(`/api/forms/queue/auto-assign/${foreign.id}/off`).set('Cookie', ownerCookie);

            expect(res.status).toBe(404);
            expect((await testPrisma.client_auto_assign.findUnique({ where: { id: foreign.id } }))!.disabled_at).toBeNull();
        });

        test('turning off the same rule twice returns 404 the second time', async () => {
            const sara = await createMember('nutritionist');
            const rule = await ruleFor(sara.id);

            await request.patch(`/api/forms/queue/auto-assign/${rule.id}/off`).set('Cookie', ownerCookie);
            const again = await request.patch(`/api/forms/queue/auto-assign/${rule.id}/off`).set('Cookie', ownerCookie);

            expect(again.status).toBe(404);
        });

        test('requires login', async () => {
            expect((await request.get('/api/forms/queue/auto-assign')).status).toBe(401);
        });
    });

    describe('editing the agents from the table', () => {
        const putAgent = (cookie: string, forClientId: string, planType: string, agentUserId: string | null) =>
            request.put(`/api/forms/queue/auto-assign/clients/${forClientId}/${planType}`).set('Cookie', cookie).send({ agentUserId });
        const rulesOf = (planType: string) =>
            testPrisma.client_auto_assign.findMany({ where: { workspace_id: workspaceId, client_id: clientId, plan_type: planType } });

        test('offers only the people who can produce each plan type', async () => {
            const nutritionist = await createMember('nutritionist');
            const trainer = await createMember('trainer');
            const manager = await createMember('manager');
            await createMember('receptionist');
            await createMember('trainer', false);

            const res = await request.get('/api/forms/queue/auto-assign/agents').set('Cookie', ownerCookie);

            const ids = (list: { id: string }[]) => list.map((person) => person.id).sort();
            expect(res.status).toBe(200);
            expect(ids(res.body.nutrition)).toEqual([ownerId, manager.id, nutritionist.id].sort());
            expect(ids(res.body.workout)).toEqual([ownerId, manager.id, trainer.id].sort());
        });

        test('picking an agent creates the rule and logs who set it', async () => {
            const sara = await createMember('nutritionist');

            const res = await putAgent(ownerCookie, clientId, NUTRITION, sara.id);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ outcome: 'set', rule: { agentUserId: sara.id, agentName: 'nutritionist Member', agentAvailable: true } });
            expect(await activeRules()).toMatchObject([{ client_id: clientId, plan_type: NUTRITION, agent_user_id: sara.id, enabled_by: ownerId }]);
        });

        test('picking a different agent retires the old rule as moved and keeps it as history', async () => {
            const sara = await createMember('nutritionist');
            const mona = await createMember('nutritionist');
            await putAgent(ownerCookie, clientId, NUTRITION, sara.id);

            await putAgent(ownerCookie, clientId, NUTRITION, mona.id);

            const rules = await rulesOf(NUTRITION);
            expect(rules).toHaveLength(2);
            expect(rules.find((rule) => rule.agent_user_id === sara.id)).toMatchObject({ disabled_reason: 'moved', disabled_by: ownerId });
            expect(rules.find((rule) => rule.agent_user_id === mona.id)!.disabled_at).toBeNull();
        });

        test('picking the same agent again changes nothing', async () => {
            const sara = await createMember('nutritionist');
            await putAgent(ownerCookie, clientId, NUTRITION, sara.id);

            const again = await putAgent(ownerCookie, clientId, NUTRITION, sara.id);

            expect(again.body.outcome).toBe('unchanged');
            expect(await rulesOf(NUTRITION)).toHaveLength(1);
        });

        test('"None" turns the rule off and leaves the client\'s other plan type alone', async () => {
            const sara = await createMember('nutritionist');
            const omar = await createMember('trainer');
            await putAgent(ownerCookie, clientId, NUTRITION, sara.id);
            await putAgent(ownerCookie, clientId, WORKOUT, omar.id);

            const res = await putAgent(ownerCookie, clientId, NUTRITION, null);

            expect(res.body).toMatchObject({ outcome: 'turned_off', rule: null });
            expect((await rulesOf(NUTRITION))[0]).toMatchObject({ disabled_reason: 'turned_off', disabled_by: ownerId });
            expect((await activeRules()).map((rule) => rule.plan_type)).toEqual([WORKOUT]);
        });

        test('a trainer cannot be the nutrition agent and a nutritionist cannot be the workout agent (400)', async () => {
            const trainer = await createMember('trainer');
            const nutritionist = await createMember('nutritionist');

            expect((await putAgent(ownerCookie, clientId, NUTRITION, trainer.id)).status).toBe(400);
            expect((await putAgent(ownerCookie, clientId, WORKOUT, nutritionist.id)).status).toBe(400);
            expect(await activeRules()).toHaveLength(0);
        });

        test('a deactivated member and someone outside the workspace cannot be picked (400)', async () => {
            const inactive = await createMember('nutritionist', false);
            const stranger = await createTestUser();

            expect((await putAgent(ownerCookie, clientId, NUTRITION, inactive.id)).status).toBe(400);
            expect((await putAgent(ownerCookie, clientId, NUTRITION, stranger.id)).status).toBe(400);
        });

        test('the owner and a manager can take either plan type', async () => {
            const manager = await createMember('manager');

            expect((await putAgent(ownerCookie, clientId, NUTRITION, ownerId)).status).toBe(200);
            expect((await putAgent(ownerCookie, clientId, WORKOUT, manager.id)).status).toBe(200);
        });

        test('rejects an unknown plan type or a missing agentUserId (400)', async () => {
            expect((await putAgent(ownerCookie, clientId, 'bogus', ownerId)).status).toBe(400);
            const missing = await request.put(`/api/forms/queue/auto-assign/clients/${clientId}/${NUTRITION}`).set('Cookie', ownerCookie).send({});
            expect(missing.status).toBe(400);
        });

        test('a trainer cannot edit agents (403)', async () => {
            const trainer = await createMember('trainer');
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', FORMS_WRITE);

            expect((await putAgent(trainerCookie, clientId, WORKOUT, trainer.id)).status).toBe(403);
            expect(await activeRules()).toHaveLength(0);
        });

        test("cannot set a rule for another workspace's client (404)", async () => {
            const otherOwner = await createTestUser();
            const otherClient = await createClientIn((await createTestWorkspace(otherOwner.id)).id);

            expect((await putAgent(ownerCookie, otherClient.id, NUTRITION, ownerId)).status).toBe(404);
            expect(await testPrisma.client_auto_assign.count({ where: { client_id: otherClient.id } })).toBe(0);
        });

        test('Turn off switches off both rules of the client at once', async () => {
            const sara = await createMember('nutritionist');
            const omar = await createMember('trainer');
            await putAgent(ownerCookie, clientId, NUTRITION, sara.id);
            await putAgent(ownerCookie, clientId, WORKOUT, omar.id);

            const res = await request.patch(`/api/forms/queue/auto-assign/clients/${clientId}/off`).set('Cookie', ownerCookie);

            expect(res.body).toEqual({ turnedOff: 2 });
            expect(await activeRules()).toHaveLength(0);
            const again = await request.patch(`/api/forms/queue/auto-assign/clients/${clientId}/off`).set('Cookie', ownerCookie);
            expect(again.status).toBe(404);
        });

        test('a trainer cannot turn off a client (403)', async () => {
            const trainer = await createMember('trainer');
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', FORMS_WRITE);
            await putAgent(ownerCookie, clientId, WORKOUT, trainer.id);

            const res = await request.patch(`/api/forms/queue/auto-assign/clients/${clientId}/off`).set('Cookie', trainerCookie);

            expect(res.status).toBe(403);
            expect(await activeRules()).toHaveLength(1);
        });
    });

    describe('turning off many rules at once', () => {
        const turnOffMatching = (cookie: string, body: Record<string, unknown>) =>
            request.post('/api/forms/queue/auto-assign/off-matching').set('Cookie', cookie).send(body);
        async function ruleFor(agentId: string, planType: string, forClientId: string) {
            return testPrisma.client_auto_assign.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: forClientId, plan_type: planType, agent_user_id: agentId },
            });
        }

        test("turns off exactly the matching agent's rules, leaves the rest, and logs who did it", async () => {
            const leaver = await createMember('nutritionist');
            const stayer = await createMember('nutritionist');
            const clientA = await createClientIn(workspaceId);
            const clientB = await createClientIn(workspaceId);
            await ruleFor(leaver.id, NUTRITION, clientA.id);
            await ruleFor(leaver.id, WORKOUT, clientA.id);
            await ruleFor(stayer.id, NUTRITION, clientB.id);

            const res = await turnOffMatching(ownerCookie, { agentUserId: leaver.id });

            expect(res.status).toBe(200);
            expect(res.body.turnedOff).toBe(2);
            const remaining = await activeRules();
            expect(remaining.map((r) => r.agent_user_id)).toEqual([stayer.id]);
            const stamped = await testPrisma.client_auto_assign.findMany({ where: { disabled_at: { not: null } } });
            expect(stamped).toHaveLength(2);
            expect(stamped.every((r) => r.disabled_by === ownerId && r.disabled_reason === 'turned_off')).toBe(true);
        });

        test('combines filters (agent + plan type)', async () => {
            const sara = await createMember('nutritionist');
            const clientA = await createClientIn(workspaceId);
            await ruleFor(sara.id, NUTRITION, clientA.id);
            await ruleFor(sara.id, WORKOUT, clientA.id);

            const res = await turnOffMatching(ownerCookie, { agentUserId: sara.id, planType: WORKOUT });

            expect(res.body.turnedOff).toBe(1);
            expect((await activeRules())[0].plan_type).toBe(NUTRITION);
        });

        test('refuses an empty request, so "turn off everything" can never happen by accident (400)', async () => {
            const sara = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION, clientId);

            const res = await turnOffMatching(ownerCookie, {});

            expect(res.status).toBe(400);
            expect(await activeRules()).toHaveLength(1);
        });

        test('turns off every rule only when all=true is sent explicitly', async () => {
            const sara = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION, clientId);

            const res = await turnOffMatching(ownerCookie, { all: true });

            expect(res.body.turnedOff).toBe(1);
            expect(await activeRules()).toHaveLength(0);
        });

        test('rejects an invalid filter rather than widening the scope (400)', async () => {
            const sara = await createMember('nutritionist');
            await ruleFor(sara.id, NUTRITION, clientId);

            const res = await turnOffMatching(ownerCookie, { planType: 'bogus' });

            expect(res.status).toBe(400);
            expect(await activeRules()).toHaveLength(1);
        });

        test('never touches another workspace\'s rules', async () => {
            const otherOwner = await createTestUser();
            const otherWs = await createTestWorkspace(otherOwner.id);
            const otherClient = await createClientIn(otherWs.id);
            const foreign = await testPrisma.client_auto_assign.create({
                data: { id: createId(), workspace_id: otherWs.id, client_id: otherClient.id, plan_type: NUTRITION, agent_user_id: otherOwner.id },
            });

            await turnOffMatching(ownerCookie, { all: true });

            expect((await testPrisma.client_auto_assign.findUnique({ where: { id: foreign.id } }))!.disabled_at).toBeNull();
        });

        test('a trainer cannot do it (403)', async () => {
            const trainer = await createMember('trainer');
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', FORMS_WRITE);
            await ruleFor(trainer.id, NUTRITION, clientId);

            const res = await turnOffMatching(trainerCookie, { all: true });

            expect(res.status).toBe(403);
            expect(await activeRules()).toHaveLength(1);
        });
    });
});
