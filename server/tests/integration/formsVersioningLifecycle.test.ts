import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { runCheckInDispatchTick } from '../../src/middleware/scheduler';

// Forms Versioning — Release-Readiness Review, item 6: full business-workflow
// walkthrough through the REAL HTTP endpoints wherever the flow has one, with
// historical integrity asserted at every downstream surface after the form
// is edited partway through. Package/plan/client setup that has no direct
// bearing on Forms Versioning is created directly via Prisma to keep the
// test focused, rather than re-testing unrelated package/plan business rules
// already covered elsewhere.
//
// This is written as ONE sequential test, not fifteen — the suite's global
// beforeEach (tests/helpers/setup.ts) truncates the whole tenant schema
// before every `test()` block, which would wipe a beforeAll's fixtures
// between narrative steps. A single test has exactly one reset, at the
// start, and every step below shares state naturally as local variables.
describe('Forms Versioning — full lifecycle', () => {
    jest.setTimeout(30000);

    test('package -> assessment -> plan -> check-in -> edit -> verify history everywhere', async () => {
        // ── Setup: workspace, coach, client, metric ─────────────────────────
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        const workspaceId = ws.id;
        const ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');

        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Lifecycle', lname: 'Client', email: `lifecycle-${createId()}@test.com`,
                workspace_id: workspaceId,
            },
        });
        const clientId = client.id;
        const clientCookie = makeClientCookie(clientId, workspaceId);

        // The scheduler's dispatch tick gates on getEffectiveAccessForClient,
        // which requires a real subscription period — a client with zero
        // transactions computes as not-Active and would get silently skipped
        // at step 7 below. Not itself a Forms Versioning concern; a minimal
        // paid transaction just gets this client into the "Active" state
        // that dispatch requires, same as it would for a real client.
        await testPrisma.transactions.create({
            data: {
                id: createId(), transaction_code: Math.floor(Math.random() * 900000) + 100000,
                workspace_id: workspaceId, client_id: clientId, client_name: 'Lifecycle Client',
                payment_method: 'cash', amount: 100, status: 'completed', duration: 365,
            },
        });

        const metric = await testPrisma.metrics.create({
            data: { id: createId(), workspace_id: workspaceId, name: 'Weight', type: 'number', unit: 'kg' },
        });
        const metricId = metric.id;

        // ── 1. Coach creates an Assessment form with a metric-linked question ──
        const formRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Initial Assessment', formType: 'assessment' });
        expect(formRes.status).toBe(201);
        const assessmentFormId = formRes.body.id;

        const qRes = await request.post(`/api/forms/${assessmentFormId}/questions`).set('Cookie', ownerCookie)
            .send({ label_en: 'Current Weight (kg)', type: 'metric', metric_id: metricId });
        expect(qRes.status).toBe(201);
        const assessmentQuestionId = qRes.body.id;

        const checkinRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Weekly Check-in', formType: 'check-in' });
        const checkinFormId = checkinRes.body.id;
        const checkinQRes = await request.post(`/api/forms/${checkinFormId}/questions`).set('Cookie', ownerCookie)
            .send({ label_en: 'How did this week go?', type: 'text' });
        const checkinQuestionId = checkinQRes.body.id;

        // ── 2. Coach assigns the assessment (assignment moment seals version 1) ──
        const assignRes = await request.post('/api/forms/requests').set('Cookie', ownerCookie)
            .send({ form_ids: [assessmentFormId], client_id: clientId, mode: 'now' });
        expect(assignRes.status).toBe(201);
        expect(assignRes.body).toHaveLength(1);
        const assessmentRequestId = assignRes.body[0].id;
        const assessmentPinnedVersionId = assignRes.body[0].form_version_id;
        expect(assessmentPinnedVersionId).toBeTruthy();

        const pinnedVersion = await testPrisma.form_versions.findUnique({ where: { id: assessmentPinnedVersionId } });
        expect(pinnedVersion!.sealed_at).not.toBeNull();

        // ── 3. Client submits the assessment ────────────────────────────────
        const submitRes = await request.post(`/api/client-portal/form-requests/${assessmentRequestId}/submit`)
            .set('Cookie', clientCookie)
            .send({ answers: [{ question_id: assessmentQuestionId, answer: '82' }] });
        expect(submitRes.status).toBe(200);
        expect((await testPrisma.form_requests.findUnique({ where: { id: assessmentRequestId } }))!.status).toBe('submitted');

        // ── 4. Coach reviews the submitted assessment ───────────────────────
        const reviewAssessmentRes = await request.patch('/api/forms/queue/review').set('Cookie', ownerCookie)
            .send({ ids: [assessmentRequestId] });
        expect(reviewAssessmentRes.status).toBe(200);
        expect((await testPrisma.form_requests.findUnique({ where: { id: assessmentRequestId } }))!.status).toBe('reviewed');

        // ── 5. Coach builds and activates a nutrition plan with the check-in ──
        const plan = await testPrisma.nutrition_plans.create({
            data: { id: createId(), name: 'Lifecycle Plan', client_id: clientId, workspace_id: workspaceId, status: 'draft' },
        });
        const planId = plan.id;

        const activateRes = await request.post(`/api/nutrition/plans/${planId}/activate`).set('Cookie', ownerCookie)
            .send({ cycleDays: 28, checkInForms: [{ formId: checkinFormId }] });
        expect(activateRes.status).toBe(200);
        expect(activateRes.body.status).toBe('active');

        // check_in_schedules row created, linked to an already-visible
        // 'scheduled' form_requests row (Package Lifecycle bug-fix behavior).
        const schedule = await testPrisma.check_in_schedules.findFirst({ where: { source_plan_id: planId } });
        expect(schedule).not.toBeNull();
        expect(schedule!.form_request_id).not.toBeNull();

        const scheduledRequest = await testPrisma.form_requests.findUnique({ where: { id: schedule!.form_request_id! } });
        expect(scheduledRequest!.status).toBe('scheduled');
        expect(scheduledRequest!.form_version_id).not.toBeNull(); // version sealed at activation time

        // ── 6. The scheduled check-in is visible in Plans Queue ─────────────
        const queueBeforeRes = await request.get('/api/forms/queue').set('Cookie', ownerCookie);
        expect(queueBeforeRes.status).toBe(200);
        const queueItemBefore = queueBeforeRes.body.find(
            (r: { formId: string; clientId: string }) => r.formId === checkinFormId && r.clientId === clientId
        );
        expect(queueItemBefore).toBeDefined();
        expect(queueItemBefore.status).toBe('scheduled');

        // ── 7. Scheduler dispatch tick fires the check-in and notifies the client ──
        await testPrisma.check_in_schedules.updateMany({
            where: { source_plan_id: planId },
            data:  { next_due_at: new Date(Date.now() - 1000) },
        });
        const dispatched = await runCheckInDispatchTick();
        expect(dispatched).toBeGreaterThanOrEqual(1);
        expect(await testPrisma.check_in_schedules.findFirst({ where: { source_plan_id: planId } })).toBeNull(); // one-shot: deleted after dispatch

        const dispatchNotification = await testPrisma.notifications.findFirst({
            where: { workspace_id: workspaceId, type: 'checkin.requested', recipient_id: clientId },
        });
        expect(dispatchNotification).not.toBeNull();

        // ── 8. Client sees and submits the check-in via the portal ──────────
        const listRes = await request.get('/api/client-portal/form-requests').set('Cookie', clientCookie);
        const pendingCheckin = listRes.body.find(
            (r: { form_id: string; status: string }) => r.form_id === checkinFormId && r.status === 'pending'
        );
        expect(pendingCheckin).toBeDefined();
        const checkinRequestId = pendingCheckin.id;

        const checkinSubmitRes = await request.post(`/api/client-portal/form-requests/${checkinRequestId}/submit`)
            .set('Cookie', clientCookie)
            .send({ answers: [{ question_id: checkinQuestionId, answer: 'Went great!' }] });
        expect(checkinSubmitRes.status).toBe(200);

        // ── 9. Coach reviews the check-in ────────────────────────────────────
        const reviewCheckinRes = await request.patch('/api/forms/queue/review').set('Cookie', ownerCookie)
            .send({ ids: [checkinRequestId] });
        expect(reviewCheckinRes.status).toBe(200);

        // ── 10. Coach edits the assessment question — forks a new version ────
        const editRes = await request.put(`/api/forms/${assessmentFormId}/questions/${assessmentQuestionId}`)
            .set('Cookie', ownerCookie)
            .send({ label_en: 'Current Weight (lbs) — CHANGED' });
        expect(editRes.status).toBe(200);
        expect(editRes.body.versionChanged).toBe(true);
        expect((await testPrisma.forms.findUnique({ where: { id: assessmentFormId } }))!.current_version_id)
            .not.toBe(assessmentPinnedVersionId);

        // ── 11. Historical submission still renders the ORIGINAL label ───────
        const historyRes = await request.get(`/api/forms/requests/client/${clientId}`).set('Cookie', ownerCookie);
        const historicalAssessment = historyRes.body.find((r: { id: string }) => r.id === assessmentRequestId);
        expect(historicalAssessment).toBeDefined();
        expect(historicalAssessment.responses[0].label_en).toBe('Current Weight (kg)'); // NOT "CHANGED"
        expect(historicalAssessment.responses[0].answer).toBe('82');

        // ── 12. Metrics / progress chart still show the correct historical point ──
        const transformationRes = await request.get(`/api/clients/${clientId}/transformation`).set('Cookie', ownerCookie);
        expect(transformationRes.status).toBe(200);
        const weightMetric = transformationRes.body.metrics.find((m: { id: string }) => m.id === metricId);
        expect(weightMetric).toBeDefined();
        expect(weightMetric.history).toHaveLength(1);
        expect(weightMetric.history[0].value).toBe('82');
        const timelineEntry = transformationRes.body.timeline.find((t: { submissionId: string }) => t.submissionId === assessmentRequestId);
        expect(timelineEntry.answers[0].label).toBe('Current Weight (kg)'); // original, not edited

        // ── 13. Plans Queue still renders the original check-in answer correctly ──
        const queueAfterRes = await request.get('/api/forms/queue').set('Cookie', ownerCookie);
        const reviewedCheckin = queueAfterRes.body.find((r: { id: string }) => r.id === checkinRequestId);
        expect(reviewedCheckin).toBeDefined();
        expect(reviewedCheckin.status).toBe('action-done');
        expect(reviewedCheckin.responses[0].answer).toBe('Went great!');

        // ── 14. The live form/draft are unaffected by the version fork ──────
        const questionsRes = await request.get(`/api/forms/${assessmentFormId}/questions`).set('Cookie', ownerCookie);
        expect(questionsRes.body[0].label_en).toBe('Current Weight (lbs) — CHANGED');
        const formsListRes = await request.get('/api/forms').set('Cookie', ownerCookie);
        const formRow = formsListRes.body.find((f: { id: string }) => f.id === assessmentFormId);
        expect(formRow.question_count).toBe(1); // still exactly one question, on the live version

        // ── 15. Archiving the form doesn't touch history, but blocks new assignment ──
        const archiveRes = await request.put(`/api/forms/${assessmentFormId}`).set('Cookie', ownerCookie)
            .send({ status: 'archived' });
        expect(archiveRes.status).toBe(200);

        const historyAfterArchiveRes = await request.get(`/api/forms/requests/client/${clientId}`).set('Cookie', ownerCookie);
        const stillIntact = historyAfterArchiveRes.body.find((r: { id: string }) => r.id === assessmentRequestId);
        expect(stillIntact.responses[0].label_en).toBe('Current Weight (kg)');

        const otherClient = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Other', lname: 'Client', email: `other-${createId()}@test.com`, workspace_id: workspaceId,
            },
        });
        const blockedAssignRes = await request.post('/api/forms/requests').set('Cookie', ownerCookie)
            .send({ form_ids: [assessmentFormId], client_id: otherClient.id, mode: 'now' });
        expect(blockedAssignRes.body).toEqual([]); // archived — silently not assignable
    });
});
