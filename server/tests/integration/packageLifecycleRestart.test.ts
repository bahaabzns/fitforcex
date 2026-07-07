import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

// Package Lifecycle Activation Workflow Refinement, item 3: the restart flow
// now reconfigures duration and check-in forms through the same Configure
// Activation modal used at first activation, backed by
// planEngine.reconcileCheckInSchedules. This is written as ONE sequential
// test — see the identical note in formsVersioningLifecycle.test.ts — because
// the suite's global beforeEach truncates the tenant schema before every
// test() block.
describe('Package Lifecycle — restart reconfiguration', () => {
    jest.setTimeout(30000);

    test('restart changes duration, swaps check-in forms, and never duplicates scheduled requests', async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        const workspaceId = ws.id;
        const ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');

        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Restart', lname: 'Client', email: `restart-${createId()}@test.com`,
                workspace_id: workspaceId,
            },
        });
        const clientId = client.id;

        // Two nutrition-compatible check-in forms so the restart can swap one
        // out for the other, proving the diff (not a blind re-add) works.
        const formARes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Weekly Check-in A', formType: 'check-in', postAction: 'nutrition-plan' });
        const formAId = formARes.body.id;
        const formBRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Weekly Check-in B', formType: 'check-in', postAction: 'nutrition-plan' });
        const formBId = formBRes.body.id;

        // ── 1. First activation: 28-day plan, check-in form A ───────────────
        const plan = await testPrisma.nutrition_plans.create({
            data: { id: createId(), name: 'Restart Plan', client_id: clientId, workspace_id: workspaceId, status: 'draft' },
        });
        const planId = plan.id;

        const activateRes = await request.post(`/api/nutrition/plans/${planId}/activate`).set('Cookie', ownerCookie)
            .send({ cycleDays: 28, checkInForms: [{ formId: formAId }] });
        expect(activateRes.status).toBe(200);
        expect(activateRes.body.cycle_days).toBe(28);

        const scheduleA = await testPrisma.check_in_schedules.findFirst({ where: { source_plan_id: planId, form_id: formAId } });
        expect(scheduleA).not.toBeNull();
        expect(scheduleA!.form_request_id).not.toBeNull();
        const firstScheduleId = scheduleA!.id;
        const firstRequestId = scheduleA!.form_request_id!;
        const firstDueAt = scheduleA!.next_due_at!.getTime();

        // ── 2. Restart via save-plan-draft: shorter duration, swap A → B ────
        const restartRes = await request.post('/api/nutrition/plans/save-plan-draft').set('Cookie', ownerCookie)
            .send({
                clientId,
                activePlanId: planId,
                plan: { name: 'Restart Plan', status: 'active', cycles: [] },
                durationChoice: 'restart',
                cycleDays: 14,
                checkInForms: [{ formId: formBId }],
            });
        expect(restartRes.status).toBe(200);
        const restartedPlanId = restartRes.body.newPlanId;
        expect(restartRes.body.savedPlan?.cycle_days).toBe(14);

        // Form A's schedule and its still-scheduled form_request must both be
        // gone — deselecting a check-in form on restart must not leave orphans.
        const scheduleAAfter = await testPrisma.check_in_schedules.findUnique({ where: { id: firstScheduleId } });
        expect(scheduleAAfter).toBeNull();
        const requestAAfter = await testPrisma.form_requests.findUnique({ where: { id: firstRequestId } });
        expect(requestAAfter).toBeNull();

        // Form B is newly scheduled against the NEW plan id, due at the new
        // (shorter) cycle end, with a freshly sealed version pinned.
        const schedulesForClient = await testPrisma.check_in_schedules.findMany({
            where: { client_id: clientId, source_plan_type: 'nutrition', paused_at: null },
        });
        expect(schedulesForClient).toHaveLength(1);
        const scheduleB = schedulesForClient[0];
        expect(scheduleB.form_id).toBe(formBId);
        expect(scheduleB.source_plan_id).toBe(restartedPlanId);
        expect(scheduleB.next_due_at!.getTime()).toBeLessThan(firstDueAt);
        expect(scheduleB.form_request_id).not.toBeNull();

        const requestB = await testPrisma.form_requests.findUnique({ where: { id: scheduleB.form_request_id! } });
        expect(requestB!.status).toBe('scheduled');
        expect(requestB!.form_version_id).not.toBeNull();

        // ── 3. Restart again, keeping the same form B selected ──────────────
        // Must retarget the existing schedule/request in place, not create a
        // second one — this is the "no duplicate scheduled requests" rule.
        const secondRestartRes = await request.post('/api/nutrition/plans/save-plan-draft').set('Cookie', ownerCookie)
            .send({
                clientId,
                activePlanId: restartedPlanId,
                plan: { name: 'Restart Plan', status: 'active', cycles: [] },
                durationChoice: 'restart',
                cycleDays: 7,
                checkInForms: [{ formId: formBId }],
            });
        expect(secondRestartRes.status).toBe(200);

        const schedulesAfterSecondRestart = await testPrisma.check_in_schedules.findMany({
            where: { client_id: clientId, source_plan_type: 'nutrition', paused_at: null },
        });
        expect(schedulesAfterSecondRestart).toHaveLength(1);
        expect(schedulesAfterSecondRestart[0].id).toBe(scheduleB.id);
        expect(schedulesAfterSecondRestart[0].form_request_id).toBe(scheduleB.form_request_id);

        const requestBAfter = await testPrisma.form_requests.findMany({ where: { form_id: formBId, client_id: clientId } });
        expect(requestBAfter).toHaveLength(1);
        expect(requestBAfter[0].id).toBe(requestB!.id);
    });
});
