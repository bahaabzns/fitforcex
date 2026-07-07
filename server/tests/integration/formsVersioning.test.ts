import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { resolveWritableVersion, sealVersionForAssignment } from '../../src/modules/forms/forms.service';

// Forms Versioning — Release-Readiness Review fixes. Covers the three
// automated-test gaps the review called out: cross-workspace write access
// on question CRUD, archived forms remaining assignable, and the
// edit-vs-assignment race being proven only by reasoning, not a test.

async function createForm(workspaceId: string, overrides: Record<string, unknown> = {}) {
    const formId = createId();
    const versionId = createId();
    await testPrisma.forms.create({
        data: { id: formId, workspace_id: workspaceId, title_en: 'Test Form', ...overrides },
    });
    await testPrisma.form_versions.create({ data: { id: versionId, form_id: formId, version_number: 1 } });
    await testPrisma.forms.update({ where: { id: formId }, data: { current_version_id: versionId } });
    return { formId, versionId };
}

async function createClient(workspaceId: string) {
    return testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Test',
            lname:        'Client',
            email:        `client-${createId()}@test.com`,
            workspace_id: workspaceId,
        },
    });
}

describe('Forms Versioning — tenant isolation on question CRUD', () => {
    let wsACookie: string;
    let wsBFormId: string;
    let wsBQuestionId: string;

    beforeEach(async () => {
        const userA = await createTestUser();
        const wsA = await createTestWorkspace(userA.id);
        wsACookie = await makeAuthCookie(userA.id, wsA.id, 'owner');

        const userB = await createTestUser();
        const wsB = await createTestWorkspace(userB.id);
        const { formId, versionId } = await createForm(wsB.id);
        wsBFormId = formId;

        const q = await testPrisma.form_version_questions.create({
            data: { id: createId(), form_version_id: versionId, label_en: 'Original Label', order_index: 0 },
        });
        wsBQuestionId = q.id;
    });

    test('createQuestion on another workspace\'s form returns 404 and creates nothing', async () => {
        const res = await request
            .post(`/api/forms/${wsBFormId}/questions`)
            .set('Cookie', wsACookie)
            .send({ label_en: 'Injected', type: 'text' });

        expect(res.status).toBe(404);
        const questions = await testPrisma.form_version_questions.findMany({ where: { label_en: 'Injected' } });
        expect(questions).toHaveLength(0);
    });

    test('updateQuestion on another workspace\'s form returns 404 and leaves the question untouched', async () => {
        const res = await request
            .put(`/api/forms/${wsBFormId}/questions/${wsBQuestionId}`)
            .set('Cookie', wsACookie)
            .send({ label_en: 'Hacked Label' });

        expect(res.status).toBe(404);
        const question = await testPrisma.form_version_questions.findUnique({ where: { id: wsBQuestionId } });
        expect(question!.label_en).toBe('Original Label');
    });

    test('deleteQuestion on another workspace\'s form returns 404 and leaves the question intact', async () => {
        const res = await request
            .delete(`/api/forms/${wsBFormId}/questions/${wsBQuestionId}`)
            .set('Cookie', wsACookie);

        expect(res.status).toBe(404);
        const question = await testPrisma.form_version_questions.findUnique({ where: { id: wsBQuestionId } });
        expect(question).not.toBeNull();
    });

    test('reorderQuestions on another workspace\'s form returns 404 and leaves order_index untouched', async () => {
        const res = await request
            .put(`/api/forms/${wsBFormId}/questions/reorder`)
            .set('Cookie', wsACookie)
            .send({ order: [{ id: wsBQuestionId, order_index: 99 }] });

        expect(res.status).toBe(404);
        const question = await testPrisma.form_version_questions.findUnique({ where: { id: wsBQuestionId } });
        expect(question!.order_index).toBe(0);
    });

    test('a form_id that does not exist at all also returns 404 (not a 500)', async () => {
        const res = await request
            .post(`/api/forms/${createId()}/questions`)
            .set('Cookie', wsACookie)
            .send({ label_en: 'Whatever', type: 'text' });
        expect(res.status).toBe(404);
    });
});

describe('Forms Versioning — archived forms cannot be assigned', () => {
    let ownerCookie: string;
    let workspaceId: string;
    let clientId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
        const client = await createClient(workspaceId);
        clientId = client.id;
    });

    test('createRequests silently skips an archived form_id and creates no request', async () => {
        const { formId } = await createForm(workspaceId, { status: 'archived' });

        const res = await request
            .post('/api/forms/requests')
            .set('Cookie', ownerCookie)
            .send({ form_ids: [formId], client_id: clientId, mode: 'now' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual([]);
        const count = await testPrisma.form_requests.count({ where: { form_id: formId } });
        expect(count).toBe(0);
    });

    test('createRequests still assigns the non-archived forms in a mixed batch', async () => {
        const { formId: archivedId } = await createForm(workspaceId, { status: 'archived' });
        const { formId: activeId } = await createForm(workspaceId, { status: 'active' });

        const res = await request
            .post('/api/forms/requests')
            .set('Cookie', ownerCookie)
            .send({ form_ids: [archivedId, activeId], client_id: clientId, mode: 'now' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].form_id).toBe(activeId);
    });

    test('sealVersionForAssignment throws FormArchivedError directly for an archived form', async () => {
        const { formId } = await createForm(workspaceId, { status: 'archived' });
        await expect(sealVersionForAssignment(formId, workspaceId, null)).rejects.toMatchObject({
            name: 'FormArchivedError',
            status: 409,
        });
    });
});

describe('Forms Versioning — concurrent edit vs. assignment', () => {
    let workspaceId: string;
    let userId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        userId = user.id;
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
    });

    test('an edit and an assignment firing at the same instant on a fresh (unsealed) form never corrupt state', async () => {
        const { formId, versionId: v1 } = await createForm(workspaceId);
        const q1 = await testPrisma.form_version_questions.create({
            data: { id: createId(), form_version_id: v1, label_en: 'Original', order_index: 0 },
        });

        const [editResult, assignResult] = await Promise.all([
            resolveWritableVersion(formId, workspaceId, userId),
            sealVersionForAssignment(formId, workspaceId, null),
        ]);

        const allVersions = await testPrisma.form_versions.findMany({
            where: { form_id: formId },
            orderBy: { version_number: 'asc' },
        });

        // Exactly one version exists (edit landed first, in place) or exactly
        // two (assignment sealed first, edit forked) — never more, never a
        // gap or duplicate version_number.
        expect([1, 2]).toContain(allVersions.length);
        expect(allVersions.map((v) => v.version_number)).toEqual(allVersions.map((_, i) => i + 1));

        // current_version_id always points at a real, existing version — the
        // latest one — never null and never a phantom id.
        const formRow = await testPrisma.forms.findUnique({ where: { id: formId } });
        expect(formRow!.current_version_id).toBe(allVersions[allVersions.length - 1].id);

        // Both calls resolved to a version that actually exists (no lost
        // updates, no dangling reference to a version that was never created).
        const versionIds = allVersions.map((v) => v.id);
        expect(versionIds).toContain(editResult.versionId);
        expect(versionIds).toContain(assignResult.versionId);

        // Historical integrity: v1's original question is untouched no
        // matter which branch won — either it's still the live draft, or
        // it's the frozen, byte-identical ancestor of a fork.
        const v1Questions = await testPrisma.form_version_questions.findMany({ where: { form_version_id: v1 } });
        expect(v1Questions).toHaveLength(1);
        expect(v1Questions[0].id).toBe(q1.id);
        expect(v1Questions[0].label_en).toBe('Original');
    });

    test('a burst of 5 concurrent edits and 5 concurrent assignments on the same fresh form settles to a consistent, non-corrupted state', async () => {
        const { formId, versionId: v1 } = await createForm(workspaceId);
        await testPrisma.form_version_questions.create({
            data: { id: createId(), form_version_id: v1, label_en: 'Q', order_index: 0 },
        });

        const operations = [
            ...Array.from({ length: 5 }, () => resolveWritableVersion(formId, workspaceId, userId)),
            ...Array.from({ length: 5 }, () => sealVersionForAssignment(formId, workspaceId, null)),
        ];
        const results = await Promise.all(operations);

        const allVersions = await testPrisma.form_versions.findMany({
            where: { form_id: formId },
            orderBy: { version_number: 'asc' },
        });

        // No duplicate forks: version_number is a dense 1..N sequence with
        // no gaps and no repeats, regardless of how the 10 calls interleaved.
        expect(allVersions.map((v) => v.version_number)).toEqual(allVersions.map((_, i) => i + 1));

        // Every single result (all 10 calls) resolved to one of the versions
        // that actually exists in the database — no operation was left
        // pointing at a version that got silently discarded.
        const versionIds = new Set(allVersions.map((v) => v.id));
        for (const r of results) expect(versionIds.has(r.versionId)).toBe(true);

        const formRow = await testPrisma.forms.findUnique({ where: { id: formId } });
        expect(formRow!.current_version_id).toBe(allVersions[allVersions.length - 1].id);
    });
});
