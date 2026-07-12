import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

// Covers the two pieces of new machinery added alongside Forms Versioning
// that formsVersioning.test.ts / formsVersioningLifecycle.test.ts don't
// touch: the batched save-draft endpoint the Builder now uses instead of
// per-field calls, and "Track as Metric" (including its dependency on
// origin_question_id lineage surviving a version fork).
describe('Forms — save-draft batch endpoint', () => {
    let ownerCookie: string;
    let workspaceId: string;
    let formId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');

        const formRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Draft Form' });
        formId = formRes.body.id;
    });

    test('creates, updates, and deletes questions in one batch, and updates form metadata', async () => {
        const seedRes = await request.post(`/api/forms/${formId}/questions`).set('Cookie', ownerCookie)
            .send({ label_en: 'To be deleted', type: 'text' });
        const toDeleteId = seedRes.body.id;

        const draftRes = await request.post(`/api/forms/${formId}/save-draft`).set('Cookie', ownerCookie).send({
            form: { title_en: 'Renamed Draft Form', description_en: 'New description' },
            questions: [
                { id: null, label_en: 'Brand new question', type: 'number' },
            ],
            deletedIds: [toDeleteId],
        });

        expect(draftRes.status).toBe(200);
        expect(draftRes.body.form.title_en).toBe('Renamed Draft Form');
        expect(draftRes.body.questions).toHaveLength(1);
        expect(draftRes.body.questions[0].label_en).toBe('Brand new question');
        expect(draftRes.body.questions[0].id).not.toBe(toDeleteId);

        const deleted = await testPrisma.form_version_questions.findUnique({ where: { id: toDeleteId } });
        expect(deleted).toBeNull();
    });

    test('rejects deleting a question that has recorded answers, without losing the rest of the batch', async () => {
        const qRes = await request.post(`/api/forms/${formId}/questions`).set('Cookie', ownerCookie)
            .send({ label_en: 'Has an answer', type: 'text' });
        const questionId = qRes.body.id;

        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'A', lname: 'B', email: `c-${createId()}@test.com`, workspace_id: workspaceId,
            },
        });
        const assignRes = await request.post('/api/forms/requests').set('Cookie', ownerCookie)
            .send({ form_ids: [formId], client_id: client.id, mode: 'now' });
        const requestId = assignRes.body[0].id;
        await request.post(`/api/client-portal/form-requests/${requestId}/submit`)
            .set('Cookie', makeClientCookie(client.id, workspaceId))
            .send({ answers: [{ question_id: questionId, answer: 'hello' }] });

        const draftRes = await request.post(`/api/forms/${formId}/save-draft`).set('Cookie', ownerCookie).send({
            questions: [],
            deletedIds: [questionId],
        });

        expect(draftRes.status).toBe(409);
        expect(draftRes.body.blockedQuestionIds).toContain(questionId);
        // Nothing was touched — the question is still there, untouched.
        const stillThere = await testPrisma.form_version_questions.findFirst({
            where: { id: questionId },
        });
        expect(stillThere).not.toBeNull();
    });

    test('rejects two questions in the same batch tracking the same metric', async () => {
        const metric = await testPrisma.metrics.create({
            data: { id: createId(), workspace_id: workspaceId, name: 'Weight', type: 'number' },
        });

        const draftRes = await request.post(`/api/forms/${formId}/save-draft`).set('Cookie', ownerCookie).send({
            questions: [
                { id: null, label_en: 'Q1', type: 'metric', metric_id: metric.id },
                { id: null, label_en: 'Q2', type: 'metric', metric_id: metric.id },
            ],
        });

        expect(draftRes.status).toBe(409);
    });
});

describe('Forms — Track as Metric', () => {
    let ownerCookie: string;
    let clientCookie: string;
    let workspaceId: string;
    let clientId: string;
    let formId: string;
    let questionId: string;
    let metricId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');

        const client = await testPrisma.clients.create({
            data: {
                id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                fname: 'Track', lname: 'Client', email: `track-${createId()}@test.com`, workspace_id: workspaceId,
            },
        });
        clientId = client.id;
        clientCookie = makeClientCookie(clientId, workspaceId);

        const metric = await testPrisma.metrics.create({
            data: { id: createId(), workspace_id: workspaceId, name: 'Weight', type: 'number', unit: 'kg' },
        });
        metricId = metric.id;

        const formRes = await request.post('/api/forms').set('Cookie', ownerCookie)
            .send({ title_en: 'Check-in' });
        formId = formRes.body.id;
        const qRes = await request.post(`/api/forms/${formId}/questions`).set('Cookie', ownerCookie)
            .send({ label_en: 'Current Weight', type: 'number' });
        questionId = qRes.body.id;
    });

    test('rejects tracking a non-convertible question type', async () => {
        const textQ = await request.post(`/api/forms/${formId}/questions`).set('Cookie', ownerCookie)
            .send({ label_en: 'Notes', type: 'text' });

        const res = await request.post(`/api/forms/${formId}/questions/${textQ.body.id}/track-as-metric`)
            .set('Cookie', ownerCookie)
            .send({ metric_id: metricId });

        expect(res.status).toBe(400);
    });

    test('preview count and backfill span every version the question has survived across a fork', async () => {
        // Submit an answer against version 1.
        const assign1 = await request.post('/api/forms/requests').set('Cookie', ownerCookie)
            .send({ form_ids: [formId], client_id: clientId, mode: 'now' });
        const request1Id = assign1.body[0].id;
        await request.post(`/api/client-portal/form-requests/${request1Id}/submit`)
            .set('Cookie', clientCookie)
            .send({ answers: [{ question_id: questionId, answer: '80' }] });

        // Editing the (now-sealed) question forks a new version — the
        // question the Builder sees next has a different id, but shares the
        // same origin_question_id.
        const editRes = await request.put(`/api/forms/${formId}/questions/${questionId}`)
            .set('Cookie', ownerCookie)
            .send({ label_en: 'Current Weight (kg)' });
        expect(editRes.status).toBe(200);
        expect(editRes.body.versionChanged).toBe(true);
        const questionIdV2 = editRes.body.id;
        expect(questionIdV2).not.toBe(questionId);

        const v1Row = await testPrisma.form_version_questions.findUnique({ where: { id: questionId } });
        const v2Row = await testPrisma.form_version_questions.findUnique({ where: { id: questionIdV2 } });
        expect(v2Row!.origin_question_id).toBe(v1Row!.origin_question_id);

        // Submit a second answer against the new (v2) version.
        const assign2 = await request.post('/api/forms/requests').set('Cookie', ownerCookie)
            .send({ form_ids: [formId], client_id: clientId, mode: 'now' });
        const request2Id = assign2.body[0].id;
        await request.post(`/api/client-portal/form-requests/${request2Id}/submit`)
            .set('Cookie', clientCookie)
            .send({ answers: [{ question_id: questionIdV2, answer: '78' }] });

        // Preview must see BOTH historical answers, not just the current version's.
        const previewRes = await request.get(`/api/forms/${formId}/questions/${questionIdV2}/metric-preview`)
            .set('Cookie', ownerCookie);
        expect(previewRes.status).toBe(200);
        expect(previewRes.body.count).toBe(2);
        expect(previewRes.body.convertible).toBe(true);

        // Track as metric — automatic backfill, no separate opt-in.
        const trackRes = await request.post(`/api/forms/${formId}/questions/${questionIdV2}/track-as-metric`)
            .set('Cookie', ownerCookie)
            .send({ metric_id: metricId });
        expect(trackRes.status).toBe(200);
        expect(trackRes.body.backfilledCount).toBe(2);
        expect(trackRes.body.question.metric_id).toBe(metricId);

        const v1Answer = await testPrisma.form_responses.findFirst({ where: { request_id: request1Id } });
        const v2Answer = await testPrisma.form_responses.findFirst({ where: { request_id: request2Id } });
        expect(v1Answer!.metric_id).toBe(metricId);
        expect(v2Answer!.metric_id).toBe(metricId);

        // Reflected on the client's transformation/progress chart.
        const transformationRes = await request.get(`/api/clients/${clientId}/transformation`).set('Cookie', ownerCookie);
        const weightMetric = transformationRes.body.metrics.find((m: { id: string }) => m.id === metricId);
        expect(weightMetric.history).toHaveLength(2);
    });

    test('rejects tracking to a metric already tracked by another question in the same version', async () => {
        const otherQRes = await request.post(`/api/forms/${formId}/questions`).set('Cookie', ownerCookie)
            .send({ label_en: 'Already tracked', type: 'metric', metric_id: metricId });
        expect(otherQRes.status).toBe(201);

        const res = await request.post(`/api/forms/${formId}/questions/${questionId}/track-as-metric`)
            .set('Cookie', ownerCookie)
            .send({ metric_id: metricId });

        expect(res.status).toBe(409);
    });
});
