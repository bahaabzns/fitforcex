import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

async function createClient(workspaceId: string) {
    return testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Sara',
            lname:        'Client',
            email:        `client-${createId()}@test.com`,
            workspace_id: workspaceId,
        },
    });
}

async function createForm(workspaceId: string, postAction: string) {
    return testPrisma.forms.create({
        data: { id: createId(), workspace_id: workspaceId, title_en: 'Assessment', post_action: postAction },
    });
}

async function createRequest(workspaceId: string, formId: string, clientId: string, status: string, postAction: string) {
    return testPrisma.form_requests.create({
        data: {
            id:           createId(),
            workspace_id: workspaceId,
            form_id:      formId,
            client_id:    clientId,
            status,
            post_action:  postAction,
            submitted_at: status === 'submitted' || status === 'reviewed' ? new Date() : null,
        },
    });
}

async function createNutritionPlan(workspaceId: string, clientId: string, status = 'draft') {
    return testPrisma.nutrition_plans.create({
        data: { id: createId(), workspace_id: workspaceId, client_id: clientId, name: 'Test Nutrition Plan', status },
    });
}

async function createTrainingPlan(workspaceId: string, clientId: string, status = 'inactive') {
    return testPrisma.training_plans.create({
        data: { id: createId(), workspace_id: workspaceId, client_id: clientId, name: 'Test Training Plan', status },
    });
}

describe('Plan activation auto-reviews matching submissions — Plans Queue fix', () => {
    jest.setTimeout(30000);

    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('activating a nutrition plan directly (no submissionId) marks every pending nutrition submission reviewed', async () => {
        const client = await createClient(workspaceId);
        const form = await createForm(workspaceId, 'nutrition-plan');
        const reqA = await createRequest(workspaceId, form.id, client.id, 'submitted', 'nutrition-plan');
        const reqB = await createRequest(workspaceId, form.id, client.id, 'submitted', 'nutrition-plan');
        // Mismatched type — must NOT be touched.
        const workoutReq = await createRequest(workspaceId, form.id, client.id, 'submitted', 'workout-plan');
        // Already reviewed — must NOT be re-stamped.
        const alreadyReviewed = await createRequest(workspaceId, form.id, client.id, 'reviewed', 'nutrition-plan');
        const alreadyReviewedRow = await testPrisma.form_requests.findUnique({ where: { id: alreadyReviewed.id } });

        const plan = await createNutritionPlan(workspaceId, client.id);

        const res = await request.post(`/api/nutrition/plans/${plan.id}/activate`).set('Cookie', ownerCookie).send({});
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('active');
        expect(res.body.autoReviewedSubmissionIds).toEqual(expect.arrayContaining([reqA.id, reqB.id]));
        expect(res.body.autoReviewedSubmissionIds).not.toContain(workoutReq.id);
        expect(res.body.autoReviewedSubmissionIds).not.toContain(alreadyReviewed.id);

        const [rowA, rowB, rowWorkout, rowAlready] = await Promise.all([
            testPrisma.form_requests.findUnique({ where: { id: reqA.id } }),
            testPrisma.form_requests.findUnique({ where: { id: reqB.id } }),
            testPrisma.form_requests.findUnique({ where: { id: workoutReq.id } }),
            testPrisma.form_requests.findUnique({ where: { id: alreadyReviewed.id } }),
        ]);
        expect(rowA!.status).toBe('reviewed');
        expect(rowA!.action_taken_at).not.toBeNull();
        expect(rowB!.status).toBe('reviewed');
        expect(rowWorkout!.status).toBe('submitted'); // mismatched post_action — untouched
        expect(rowAlready!.action_taken_at).toEqual(alreadyReviewedRow!.action_taken_at); // untouched, not re-stamped
    });

    test('activating a training plan directly (no submissionId) marks every pending workout submission reviewed', async () => {
        const client = await createClient(workspaceId);
        const form = await createForm(workspaceId, 'workout-plan');
        const reqA = await createRequest(workspaceId, form.id, client.id, 'submitted', 'workout-plan');
        const nutritionReq = await createRequest(workspaceId, form.id, client.id, 'submitted', 'nutrition-plan');

        const plan = await createTrainingPlan(workspaceId, client.id);

        const res = await request.post(`/api/training/plans/${plan.id}/activate`).set('Cookie', ownerCookie).send({});
        expect(res.status).toBe(200);
        expect(res.body.autoReviewedSubmissionIds).toEqual([reqA.id]);

        const [rowA, rowNutrition] = await Promise.all([
            testPrisma.form_requests.findUnique({ where: { id: reqA.id } }),
            testPrisma.form_requests.findUnique({ where: { id: nutritionReq.id } }),
        ]);
        expect(rowA!.status).toBe('reviewed');
        expect(rowNutrition!.status).toBe('submitted');
    });

    test('a plan with no pending matching submissions activates cleanly with an empty auto-reviewed list', async () => {
        const client = await createClient(workspaceId);
        const plan = await createNutritionPlan(workspaceId, client.id);

        const res = await request.post(`/api/nutrition/plans/${plan.id}/activate`).set('Cookie', ownerCookie).send({});
        expect(res.status).toBe(200);
        expect(res.body.autoReviewedSubmissionIds).toEqual([]);
    });

    test('tenant isolation: does not touch a same-type pending submission belonging to a different client', async () => {
        const client = await createClient(workspaceId);
        const otherClient = await createClient(workspaceId);
        const form = await createForm(workspaceId, 'nutrition-plan');
        const otherClientReq = await createRequest(workspaceId, form.id, otherClient.id, 'submitted', 'nutrition-plan');

        const plan = await createNutritionPlan(workspaceId, client.id);

        const res = await request.post(`/api/nutrition/plans/${plan.id}/activate`).set('Cookie', ownerCookie).send({});
        expect(res.status).toBe(200);
        expect(res.body.autoReviewedSubmissionIds).not.toContain(otherClientReq.id);

        const row = await testPrisma.form_requests.findUnique({ where: { id: otherClientReq.id } });
        expect(row!.status).toBe('submitted');
    });
});
