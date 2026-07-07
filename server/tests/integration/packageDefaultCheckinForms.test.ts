import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

// Package Variation → Default Check-in Forms refinement: the single mixed
// 'checkin' kind (migration 030) is split into 'checkin-nutrition' and
// 'checkin-training' (migration 042) so a package's defaults can differ by
// plan type, and the Configure Activation modal's package-defaults lookup
// only ever returns the forms relevant to the plan type being activated.
describe('Package Variation — default check-in forms split by plan type', () => {
    jest.setTimeout(30000);

    test('create/read round-trip keeps nutrition and training defaults separate, and client defaults are plan-type scoped', async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        const workspaceId = ws.id;
        const ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');

        const nutritionFormRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Nutrition Check-in', formType: 'check-in', postAction: 'nutrition-plan' });
        const nutritionFormId = nutritionFormRes.body.id;
        const trainingFormRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Training Check-in', formType: 'check-in', postAction: 'workout-plan' });
        const trainingFormId = trainingFormRes.body.id;
        const assessmentFormRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Intake Assessment', formType: 'assessment' });
        const assessmentFormId = assessmentFormRes.body.id;

        // ── 1. Create a package whose variation defaults span all three kinds ──
        const createRes = await request.post('/api/packages').set('Cookie', ownerCookie).send({
            name: 'Gold',
            variations: [{
                name: 'Standard', duration: 30, price: 100, currency: 'USD',
                defaultForms: [
                    { formId: assessmentFormId, kind: 'assessment' },
                    { formId: nutritionFormId, kind: 'checkin-nutrition' },
                    { formId: trainingFormId, kind: 'checkin-training' },
                ],
            }],
        });
        expect(createRes.status).toBe(201);
        const variation = createRes.body.variations[0];
        const defaultForms = variation.defaultForms as Array<{ formId: string; kind: string }>;
        expect(defaultForms.find(f => f.formId === nutritionFormId)?.kind).toBe('checkin-nutrition');
        expect(defaultForms.find(f => f.formId === trainingFormId)?.kind).toBe('checkin-training');
        expect(defaultForms.find(f => f.formId === assessmentFormId)?.kind).toBe('assessment');

        // The old mixed kind is rejected outright — proves the two new kinds
        // are the only accepted check-in classification going forward.
        // (validateDefaultForms throws a plain Error with no .status, which
        // the global handler treats as 500 — pre-existing behavior for every
        // validation failure in this controller, not specific to this check.)
        const rejectRes = await request.post('/api/packages').set('Cookie', ownerCookie).send({
            name: 'Rejected',
            variations: [{
                name: 'Standard', duration: 30, price: 100, currency: 'USD',
                defaultForms: [{ formId: nutritionFormId, kind: 'checkin' }],
            }],
        });
        expect(rejectRes.status).toBe(500);
        expect(await testPrisma.packages.findFirst({ where: { name: 'Rejected', workspace_id: workspaceId } })).toBeNull();

        // ── 2. A client on this variation resolves plan-type-scoped defaults ──
        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Defaults', lname: 'Client', email: `defaults-${createId()}@test.com`,
                workspace_id: workspaceId, current_package_variation_id: variation.id,
            },
        });

        const nutritionDefaultsRes = await request.get(`/api/clients/${client.id}/package-defaults`)
            .query({ planType: 'nutrition' }).set('Cookie', ownerCookie);
        expect(nutritionDefaultsRes.status).toBe(200);
        expect(nutritionDefaultsRes.body.checkInForms).toHaveLength(1);
        expect(nutritionDefaultsRes.body.checkInForms[0].formId).toBe(nutritionFormId);

        const trainingDefaultsRes = await request.get(`/api/clients/${client.id}/package-defaults`)
            .query({ planType: 'training' }).set('Cookie', ownerCookie);
        expect(trainingDefaultsRes.status).toBe(200);
        expect(trainingDefaultsRes.body.checkInForms).toHaveLength(1);
        expect(trainingDefaultsRes.body.checkInForms[0].formId).toBe(trainingFormId);

        // Omitting planType must never silently leak the other plan type's
        // forms — it resolves to nutrition, the same default the frontend's
        // isCompatibleCheckInForm uses.
        const noPlanTypeRes = await request.get(`/api/clients/${client.id}/package-defaults`).set('Cookie', ownerCookie);
        expect(noPlanTypeRes.body.checkInForms).toHaveLength(1);
        expect(noPlanTypeRes.body.checkInForms[0].formId).toBe(nutritionFormId);

        // ── 3. Updating the variation replaces defaults cleanly, no leftovers ──
        const updateRes = await request.put('/api/packages').set('Cookie', ownerCookie).send({
            id: createRes.body.id,
            variations: [{
                id: variation.id,
                name: 'Standard', duration: 30, price: 100, currency: 'USD',
                defaultForms: [{ formId: trainingFormId, kind: 'checkin-training' }],
            }],
        });
        expect(updateRes.status).toBe(200);
        const updatedForms = updateRes.body.variations[0].defaultForms as Array<{ formId: string; kind: string }>;
        expect(updatedForms).toHaveLength(1);
        expect(updatedForms[0]).toMatchObject({ formId: trainingFormId, kind: 'checkin-training' });

        const afterUpdateNutritionRes = await request.get(`/api/clients/${client.id}/package-defaults`)
            .query({ planType: 'nutrition' }).set('Cookie', ownerCookie);
        expect(afterUpdateNutritionRes.body.checkInForms).toHaveLength(0);
    });
});
