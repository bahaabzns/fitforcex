import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { DEFAULT_PERMISSIONS } from '../../src/lib/defaultPermissions';

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

async function createForm(workspaceId: string) {
    return testPrisma.forms.create({
        data: { id: createId(), workspace_id: workspaceId, title_en: 'Weekly Check-in' },
    });
}

async function createRequest(workspaceId: string, formId: string, clientId: string, status: string) {
    return testPrisma.form_requests.create({
        data: { id: createId(), workspace_id: workspaceId, form_id: formId, client_id: clientId, status, submitted_at: status === 'submitted' ? new Date() : null },
    });
}

async function createLabel(workspaceId: string, name = 'Urgent', color = 'pink') {
    return testPrisma.plans_queue_labels.create({
        data: { id: createId(), workspace_id: workspaceId, name, color },
    });
}

describe('Plans Queue Labels API', () => {
    let workspaceId: string;
    let ownerId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        ownerId = user.id;
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    describe('GET /api/forms/queue/labels', () => {
        test('lists the workspace\'s labels ordered by name', async () => {
            await createLabel(workspaceId, 'Zeta', 'sky');
            await createLabel(workspaceId, 'Alpha', 'pink');

            const res = await request.get('/api/forms/queue/labels').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.map((l: { name: string }) => l.name)).toEqual(['Alpha', 'Zeta']);
        });

        test('tenant isolation: does not list another workspace\'s labels', async () => {
            const otherUser = await createTestUser();
            const otherWs = await createTestWorkspace(otherUser.id);
            await createLabel(otherWs.id, 'Foreign Label');
            await createLabel(workspaceId, 'My Label');

            const res = await request.get('/api/forms/queue/labels').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            expect(res.body.map((l: { name: string }) => l.name)).toEqual(['My Label']);
        });

        test('no auth cookie is rejected with 401', async () => {
            const res = await request.get('/api/forms/queue/labels');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/forms/queue/labels', () => {
        test('owner can create a label', async () => {
            const res = await request.post('/api/forms/queue/labels').set('Cookie', ownerCookie)
                .send({ name: 'Urgent', color: 'pink' });
            expect(res.status).toBe(201);
            expect(res.body.name).toBe('Urgent');
            expect(res.body.color).toBe('pink');
            expect(res.body.workspace_id).toBe(workspaceId);
        });

        test('manager (non-owner) can create a label', async () => {
            const manager = await createTestUser();
            await testPrisma.workspace_members.create({
                data: { id: createId(), workspace_id: workspaceId, user_id: manager.id, role: 'manager' },
            });
            const managerCookie = await makeAuthCookie(manager.id, workspaceId, 'manager', DEFAULT_PERMISSIONS.manager);

            const res = await request.post('/api/forms/queue/labels').set('Cookie', managerCookie)
                .send({ name: 'Follow Up', color: 'cyan' });
            expect(res.status).toBe(201);
        });

        test('a trainer with forms.write still cannot create a label — restricted to owner/manager', async () => {
            const trainer = await createTestUser();
            await testPrisma.workspace_members.create({
                data: { id: createId(), workspace_id: workspaceId, user_id: trainer.id, role: 'trainer' },
            });
            // DEFAULT_PERMISSIONS.trainer.forms.write is true — this cookie clears the
            // router's blanket 'forms' write gate, isolating the isManagerOrOwner check.
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', DEFAULT_PERMISSIONS.trainer);

            const res = await request.post('/api/forms/queue/labels').set('Cookie', trainerCookie)
                .send({ name: 'Should Fail', color: 'cyan' });
            expect(res.status).toBe(403);

            const labels = await testPrisma.plans_queue_labels.findMany({ where: { workspace_id: workspaceId } });
            expect(labels).toHaveLength(0);
        });

        test('missing name returns 400', async () => {
            const res = await request.post('/api/forms/queue/labels').set('Cookie', ownerCookie)
                .send({ color: 'pink' });
            expect(res.status).toBe(400);
        });

        test('invalid color returns 400', async () => {
            const res = await request.post('/api/forms/queue/labels').set('Cookie', ownerCookie)
                .send({ name: 'Urgent', color: 'not-a-real-color' });
            expect(res.status).toBe(400);
        });

        test('duplicate name within the same workspace returns 409', async () => {
            await createLabel(workspaceId, 'Urgent', 'pink');
            const res = await request.post('/api/forms/queue/labels').set('Cookie', ownerCookie)
                .send({ name: 'Urgent', color: 'cyan' });
            expect(res.status).toBe(409);
        });

        test('the same name is allowed in a different workspace', async () => {
            const otherUser = await createTestUser();
            const otherWs = await createTestWorkspace(otherUser.id);
            await createLabel(otherWs.id, 'Urgent', 'pink');

            const res = await request.post('/api/forms/queue/labels').set('Cookie', ownerCookie)
                .send({ name: 'Urgent', color: 'cyan' });
            expect(res.status).toBe(201);
        });
    });

    describe('PATCH /api/forms/queue/labels/:id', () => {
        test('owner can rename and recolor a label', async () => {
            const label = await createLabel(workspaceId, 'Old Name', 'pink');
            const res = await request.patch(`/api/forms/queue/labels/${label.id}`).set('Cookie', ownerCookie)
                .send({ name: 'New Name', color: 'teal' });
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('New Name');
            expect(res.body.color).toBe('teal');
        });

        test('trainer cannot rename a label', async () => {
            const trainer = await createTestUser();
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', DEFAULT_PERMISSIONS.trainer);
            const label = await createLabel(workspaceId);

            const res = await request.patch(`/api/forms/queue/labels/${label.id}`).set('Cookie', trainerCookie)
                .send({ name: 'Hacked' });
            expect(res.status).toBe(403);
        });

        test('renaming to another existing label\'s name returns 409', async () => {
            const a = await createLabel(workspaceId, 'Alpha');
            await createLabel(workspaceId, 'Beta');
            const res = await request.patch(`/api/forms/queue/labels/${a.id}`).set('Cookie', ownerCookie)
                .send({ name: 'Beta' });
            expect(res.status).toBe(409);
        });

        test('unknown label id returns 404', async () => {
            const res = await request.patch(`/api/forms/queue/labels/${createId()}`).set('Cookie', ownerCookie)
                .send({ name: 'Whatever' });
            expect(res.status).toBe(404);
        });

        test('tenant isolation: cannot update another workspace\'s label', async () => {
            const otherUser = await createTestUser();
            const otherWs = await createTestWorkspace(otherUser.id);
            const foreignLabel = await createLabel(otherWs.id, 'Foreign');

            const res = await request.patch(`/api/forms/queue/labels/${foreignLabel.id}`).set('Cookie', ownerCookie)
                .send({ name: 'Hijacked' });
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/forms/queue/labels/:id', () => {
        test('owner can delete a label, and affected queue items are un-labelled (SET NULL), not blocked', async () => {
            const label = await createLabel(workspaceId);
            const client = await createClient(workspaceId);
            const form = await createForm(workspaceId);
            const req = await createRequest(workspaceId, form.id, client.id, 'submitted');
            await testPrisma.form_requests.update({ where: { id: req.id }, data: { label_id: label.id } });

            const res = await request.delete(`/api/forms/queue/labels/${label.id}`).set('Cookie', ownerCookie);
            expect(res.status).toBe(200);

            const row = await testPrisma.form_requests.findUnique({ where: { id: req.id } });
            expect(row!.label_id).toBeNull();
            const deletedLabel = await testPrisma.plans_queue_labels.findUnique({ where: { id: label.id } });
            expect(deletedLabel).toBeNull();
        });

        test('trainer cannot delete a label', async () => {
            const trainer = await createTestUser();
            const trainerCookie = await makeAuthCookie(trainer.id, workspaceId, 'trainer', DEFAULT_PERMISSIONS.trainer);
            const label = await createLabel(workspaceId);

            const res = await request.delete(`/api/forms/queue/labels/${label.id}`).set('Cookie', trainerCookie);
            expect(res.status).toBe(403);

            const stillThere = await testPrisma.plans_queue_labels.findUnique({ where: { id: label.id } });
            expect(stillThere).not.toBeNull();
        });
    });

    describe('PATCH /api/forms/queue/label (apply/clear on a queue item)', () => {
        test('any caller with forms write access can apply an existing label to a queue item', async () => {
            const label = await createLabel(workspaceId);
            const client = await createClient(workspaceId);
            const form = await createForm(workspaceId);
            const req = await createRequest(workspaceId, form.id, client.id, 'submitted');

            const res = await request.patch('/api/forms/queue/label').set('Cookie', ownerCookie)
                .send({ formRequestId: req.id, labelId: label.id });
            expect(res.status).toBe(200);
            expect(res.body.labelId).toBe(label.id);

            const row = await testPrisma.form_requests.findUnique({ where: { id: req.id } });
            expect(row!.label_id).toBe(label.id);
        });

        test('a nutritionist (forms.write, not manager) can apply a label — this is a normal queue action', async () => {
            const nutritionist = await createTestUser();
            const nutritionistCookie = await makeAuthCookie(nutritionist.id, workspaceId, 'nutritionist', DEFAULT_PERMISSIONS.nutritionist);
            const label = await createLabel(workspaceId);
            const client = await createClient(workspaceId);
            const form = await createForm(workspaceId);
            const req = await createRequest(workspaceId, form.id, client.id, 'submitted');

            const res = await request.patch('/api/forms/queue/label').set('Cookie', nutritionistCookie)
                .send({ formRequestId: req.id, labelId: label.id });
            expect(res.status).toBe(200);
        });

        test('clearing a label sets labelId to null', async () => {
            const label = await createLabel(workspaceId);
            const client = await createClient(workspaceId);
            const form = await createForm(workspaceId);
            const req = await createRequest(workspaceId, form.id, client.id, 'submitted');
            await testPrisma.form_requests.update({ where: { id: req.id }, data: { label_id: label.id } });

            const res = await request.patch('/api/forms/queue/label').set('Cookie', ownerCookie)
                .send({ formRequestId: req.id, labelId: null });
            expect(res.status).toBe(200);
            expect(res.body.labelId).toBeNull();

            const row = await testPrisma.form_requests.findUnique({ where: { id: req.id } });
            expect(row!.label_id).toBeNull();
        });

        test('applying a label belonging to another workspace returns 400', async () => {
            const otherUser = await createTestUser();
            const otherWs = await createTestWorkspace(otherUser.id);
            const foreignLabel = await createLabel(otherWs.id);
            const client = await createClient(workspaceId);
            const form = await createForm(workspaceId);
            const req = await createRequest(workspaceId, form.id, client.id, 'submitted');

            const res = await request.patch('/api/forms/queue/label').set('Cookie', ownerCookie)
                .send({ formRequestId: req.id, labelId: foreignLabel.id });
            expect(res.status).toBe(400);
        });

        test('applying to a queue item in another workspace returns 404', async () => {
            const otherUser = await createTestUser();
            const otherWs = await createTestWorkspace(otherUser.id);
            const otherClient = await createClient(otherWs.id);
            const otherForm = await createForm(otherWs.id);
            const foreignReq = await createRequest(otherWs.id, otherForm.id, otherClient.id, 'submitted');
            const label = await createLabel(workspaceId);

            const res = await request.patch('/api/forms/queue/label').set('Cookie', ownerCookie)
                .send({ formRequestId: foreignReq.id, labelId: label.id });
            expect(res.status).toBe(404);
        });

        test('missing formRequestId returns 400', async () => {
            const res = await request.patch('/api/forms/queue/label').set('Cookie', ownerCookie).send({ labelId: null });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/forms/queue includes label info', () => {
        test('queue rows carry labelId/labelName/labelColor', async () => {
            const label = await createLabel(workspaceId, 'Needs Follow-up', 'violet');
            const client = await createClient(workspaceId);
            const form = await createForm(workspaceId);
            const req = await createRequest(workspaceId, form.id, client.id, 'submitted');
            await testPrisma.form_requests.update({ where: { id: req.id }, data: { label_id: label.id } });

            const res = await request.get('/api/forms/queue').set('Cookie', ownerCookie);
            expect(res.status).toBe(200);
            const row = res.body.find((r: { id: string }) => r.id === req.id);
            expect(row.labelId).toBe(label.id);
            expect(row.labelName).toBe('Needs Follow-up');
            expect(row.labelColor).toBe('violet');
        });

        test('an unlabelled row carries null label fields', async () => {
            const client = await createClient(workspaceId);
            const form = await createForm(workspaceId);
            const req = await createRequest(workspaceId, form.id, client.id, 'submitted');

            const res = await request.get('/api/forms/queue').set('Cookie', ownerCookie);
            const row = res.body.find((r: { id: string }) => r.id === req.id);
            expect(row.labelId).toBeNull();
            expect(row.labelName).toBeNull();
            expect(row.labelColor).toBeNull();
        });
    });
});
