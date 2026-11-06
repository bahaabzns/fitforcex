import { createId } from '@paralleldrive/cuid2';
import { createTestUser, createTestWorkspace, makeAuthCookie, request } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { ensureDemoClient } from '../../src/modules/demoClient/demoClient.service';

const DAY_MS = 24 * 60 * 60 * 1000;

async function createOwner() {
    const user = await createTestUser();
    const workspace = await createTestWorkspace(user.id);
    const cookie = await makeAuthCookie(user.id, workspace.id);
    return { user, workspace, cookie };
}

const getStatus = (cookie: string) => request.get('/api/getting-started').set('Cookie', cookie);
const stepKeys = (body: { steps: Array<{ key: string }> }) => body.steps.map((step) => step.key);
const doneKeys = (body: { steps: Array<{ key: string; done: boolean }> }) => body.steps.filter((step) => step.done).map((step) => step.key).sort();

describe('Getting-started checklist', () => {
    it('reads as a story: try the demo, set up the package, then the first real client, the first client, the portal and the payment', async () => {
        const { workspace, cookie } = await createOwner();
        await ensureDemoClient(workspace.id);

        const status = await getStatus(cookie);

        expect(status.body.visible).toBe(true);
        expect(stepKeys(status.body)).toEqual(['edit_demo', 'view_app', 'open_queue', 'add_form', 'add_questions', 'create_package', 'add_client', 'share_portal', 'record_payment']);
        expect(status.body.doneCount).toBe(0);
        expect(status.body.demoClientId).not.toBeNull();
    });

    it('does not count the demo client\'s own package or payment as progress', async () => {
        const { workspace, cookie } = await createOwner();
        await ensureDemoClient(workspace.id);

        expect(doneKeys((await getStatus(cookie)).body)).toEqual([]);
    });

    it('ticks steps off from real data and from the first-time events', async () => {
        const { workspace, cookie } = await createOwner();
        await ensureDemoClient(workspace.id);
        const real = await testPrisma.clients.create({ data: { id: createId(), client_code: 2, fname: 'Real', lname: 'One', email: 'r@test.com', workspace_id: workspace.id } });
        await testPrisma.packages.create({ data: { id: createId(), workspace_id: workspace.id, name: 'My package' } });
        await testPrisma.transactions.create({
            data: { id: createId(), transaction_code: 900, workspace_id: workspace.id, client_id: real.id, client_name: 'Real One', payment_method: 'Cash', amount: 100, currency: 'EGP' },
        });
        await testPrisma.demo_client_events.createMany({
            data: ['edited', 'queue_opened', 'real_client_portal_login'].map((eventType) => ({ id: createId(), workspace_id: workspace.id, event_type: eventType })),
        });

        const status = await getStatus(cookie);

        expect(doneKeys(status.body)).toEqual(['add_client', 'create_package', 'edit_demo', 'open_queue', 'record_payment', 'share_portal']);
        expect(status.body.firstRealClientId).toBe(real.id);
    });

    it('records opening the plans queue and a real client signing in to the portal', async () => {
        const { workspace, cookie } = await createOwner();
        await ensureDemoClient(workspace.id);
        await testPrisma.clients.create({
            data: { id: createId(), client_code: 2, fname: 'Real', lname: 'One', email: 'real-login@test.com', workspace_id: workspace.id, password: (await testPrisma.clients.findFirstOrThrow({ where: { workspace_id: workspace.id, is_demo: true } })).password },
        });

        await request.get('/api/forms/queue').set('Cookie', cookie);
        await request.post('/api/client-portal/login').send({ email: 'real-login@test.com', password: 'Demo1234', workspace_slug: workspace.slug });
        await new Promise((resolve) => setTimeout(resolve, 300));

        const status = await getStatus(cookie);
        expect(doneKeys(status.body)).toEqual(expect.arrayContaining(['open_queue', 'share_portal']));
    });

    it('drops the demo steps once the demo client is deleted', async () => {
        const { workspace, cookie } = await createOwner();
        await ensureDemoClient(workspace.id);
        await request.delete('/api/demo-client').set('Cookie', cookie);

        expect(stepKeys((await getStatus(cookie)).body)).toEqual(['add_form', 'add_questions', 'create_package', 'add_client', 'share_portal', 'record_payment']);
    });

    it('creates one starter package linked to the default forms, and does nothing the second time', async () => {
        const { workspace, cookie } = await createOwner();
        const assessment = await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspace.id, title_en: 'Assessment', form_type: 'assessment' } });
        const checkIn = await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspace.id, title_en: 'Check-in', form_type: 'check-in' } });

        const first = await request.post('/api/getting-started/starter-package').set('Cookie', cookie);
        const second = await request.post('/api/getting-started/starter-package').set('Cookie', cookie);

        expect(first.body.created).toBe(true);
        expect(second.body).toMatchObject({ created: false, packageId: first.body.packageId });
        const variation = await testPrisma.package_variations.findFirstOrThrow({ where: { package_id: first.body.packageId }, include: { package_default_forms: true } });
        expect(Number(variation.price)).toBeGreaterThan(0);
        expect(variation.nutrition_cycle_days).toBe(14);
        expect(variation.package_default_forms.map((entry) => `${entry.kind}:${entry.form_id}`).sort())
            .toEqual([`assessment:${assessment.id}`, `checkin-nutrition:${checkIn.id}`, `checkin-training:${checkIn.id}`].sort());
        expect(doneKeys((await getStatus(cookie)).body)).toContain('create_package');
    });

    it('is hidden for old workspaces, for non-owners and after the owner hides it', async () => {
        const old = await createOwner();
        await testPrisma.workspaces.update({ where: { id: old.workspace.id }, data: { created_at: new Date(Date.now() - 45 * DAY_MS) } });
        expect((await getStatus(old.cookie)).body.visible).toBe(false);

        const owner = await createOwner();
        const member = await createTestUser();
        const memberCookie = await makeAuthCookie(member.id, owner.workspace.id, 'trainer');
        expect((await getStatus(memberCookie)).body.visible).toBe(false);
        expect((await request.post('/api/getting-started/dismiss').set('Cookie', memberCookie)).status).toBe(403);
        expect((await request.post('/api/getting-started/starter-package').set('Cookie', memberCookie)).status).toBe(403);

        expect((await getStatus(owner.cookie)).body.visible).toBe(true);
        await request.post('/api/getting-started/dismiss').set('Cookie', owner.cookie);
        expect((await getStatus(owner.cookie)).body.visible).toBe(false);
    });

    it('gives the demo login for the arrow label while the demo exists', async () => {
        const { workspace, cookie } = await createOwner();
        await ensureDemoClient(workspace.id);

        expect((await getStatus(cookie)).body.demoLogin).toEqual({ email: 'demo@fitforce.demo', password: 'Demo1234' });
    });

    it('groups the steps into three chapters and keeps the order of the story', async () => {
        const { workspace, cookie } = await createOwner();
        await ensureDemoClient(workspace.id);

        const groups = (await getStatus(cookie)).body.steps.map((step: { group: string }) => step.group);

        expect(groups).toEqual(['try', 'try', 'try', 'setup', 'setup', 'setup', 'first_client', 'first_client', 'first_client']);
    });

    it('ticks "add a form" when the owner creates one, and not for the default forms', async () => {
        const { workspace, cookie } = await createOwner();
        await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspace.id, title_en: 'Default assessment', form_type: 'assessment' } });
        expect(doneKeys((await getStatus(cookie)).body)).not.toContain('add_form');

        await request.post('/api/forms').set('Cookie', cookie).send({ title_en: 'My intake form' });
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(doneKeys((await getStatus(cookie)).body)).toContain('add_form');
    });

    it('ticks "add questions" only after a form the owner added is saved with questions', async () => {
        const { workspace, cookie } = await createOwner();
        const defaults = await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspace.id, title_en: 'Default', form_type: 'assessment', current_version_id: null } });
        await testPrisma.form_versions.create({ data: { id: createId(), form_id: defaults.id, version_number: 1 } });

        // Saving questions before the owner has added any form of their own does not count.
        const created = await request.post('/api/forms').set('Cookie', cookie).send({ title_en: 'Mine' });
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(doneKeys((await getStatus(cookie)).body)).not.toContain('add_questions');

        await request.post(`/api/forms/${created.body.id}/save-draft`).set('Cookie', cookie).send({ form: {}, questions: [{ id: null, label_en: 'How do you feel?', type: 'text' }], deletedIds: [] });
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(doneKeys((await getStatus(cookie)).body)).toEqual(expect.arrayContaining(['add_form', 'add_questions']));
    });
});
