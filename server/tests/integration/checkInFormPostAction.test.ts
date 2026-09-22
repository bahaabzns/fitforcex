import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

// Regression coverage for a bug where check-in forms attached to a
// training/nutrition plan's recurring schedule were queued with
// post_action stuck at the column default 'nothing' ("No Action" in Plans
// Queue) even though the form itself was configured with a real
// after-submission action. The manual "assign form to client" flow
// (forms.controller.ts createRequests) always copied forms.post_action
// onto the new form_requests row; the plan-activation and
// reconcileCheckInSchedules insert paths did not. Covers both:
//   1. First activation's own insert loop (training/nutrition controller).
//   2. A restart that adds a newly-selected check-in form, which goes
//      through planEngine.reconcileCheckInSchedules's `toAdd` path.
describe('Check-in form post_action is preserved when a plan schedules it', () => {
    jest.setTimeout(30000);

    test('training plan activation copies the check-in form\'s post_action onto its form_request', async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        const workspaceId = ws.id;
        const ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');

        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Training', lname: 'PostAction', email: `training-postaction-${createId()}@test.com`,
                workspace_id: workspaceId,
            },
        });

        const checkInFormRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Check-in Training', formType: 'check-in', postAction: 'workout-plan' });
        const checkInFormId = checkInFormRes.body.id;

        const plan = await testPrisma.training_plans.create({
            data: { id: createId(), name: 'Post-Action Plan', client_id: client.id, workspace_id: workspaceId, status: 'draft' },
        });

        const activateRes = await request.post(`/api/training/plans/${plan.id}/activate`).set('Cookie', ownerCookie)
            .send({ cycleDays: 28, checkInForms: [{ formId: checkInFormId }] });
        expect(activateRes.status).toBe(200);

        const schedule = await testPrisma.check_in_schedules.findFirst({ where: { source_plan_id: plan.id, form_id: checkInFormId } });
        expect(schedule).not.toBeNull();
        expect(schedule!.form_request_id).not.toBeNull();

        const formRequest = await testPrisma.form_requests.findUnique({ where: { id: schedule!.form_request_id! } });
        expect(formRequest!.post_action).toBe('workout-plan');
    });

    test('restarting a plan and adding a new check-in form copies its post_action via reconcileCheckInSchedules', async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        const workspaceId = ws.id;
        const ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');

        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Restart', lname: 'PostAction', email: `restart-postaction-${createId()}@test.com`,
                workspace_id: workspaceId,
            },
        });

        const newCheckInFormRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Nutrition Check-in', formType: 'check-in', postAction: 'nutrition-plan' });
        const newCheckInFormId = newCheckInFormRes.body.id;

        const plan = await testPrisma.nutrition_plans.create({
            data: { id: createId(), name: 'Restart Post-Action Plan', client_id: client.id, workspace_id: workspaceId, status: 'draft' },
        });

        // First activation with no check-in forms selected.
        const activateRes = await request.post(`/api/nutrition/plans/${plan.id}/activate`).set('Cookie', ownerCookie)
            .send({ cycleDays: 28, checkInForms: [] });
        expect(activateRes.status).toBe(200);

        // Restart and newly select the check-in form -- this is
        // reconcileCheckInSchedules's `toAdd` path (a form not present in
        // the prior schedule set).
        const restartRes = await request.post('/api/nutrition/plans/save-plan-draft').set('Cookie', ownerCookie)
            .send({
                clientId: client.id,
                activePlanId: plan.id,
                plan: { name: 'Restart Post-Action Plan', status: 'active', cycles: [] },
                durationChoice: 'restart',
                cycleDays: 14,
                checkInForms: [{ formId: newCheckInFormId }],
            });
        expect(restartRes.status).toBe(200);

        const schedule = await testPrisma.check_in_schedules.findFirst({
            where: { client_id: client.id, source_plan_type: 'nutrition', form_id: newCheckInFormId, paused_at: null },
        });
        expect(schedule).not.toBeNull();
        expect(schedule!.form_request_id).not.toBeNull();

        const formRequest = await testPrisma.form_requests.findUnique({ where: { id: schedule!.form_request_id! } });
        expect(formRequest!.post_action).toBe('nutrition-plan');
    });
});
