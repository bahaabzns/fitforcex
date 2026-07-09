import bcrypt from 'bcrypt';
import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

/**
 * Coverage for the email-first mobile login flow: POST /client-portal/discover-workspace
 * resolves the workspace(s) for an email so the client never enters a slug, while
 * POST /client-portal/login stays exactly as before (still requires a workspace slug).
 */
async function createClientWithPassword(workspaceId: string, email: string, password: string) {
    return testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Test',
            lname:        'Client',
            email,
            password:     await bcrypt.hash(password, 10),
            workspace_id: workspaceId,
        },
    });
}

describe('Client portal workspace discovery — POST /client-portal/discover-workspace', () => {
    test('resolves a single workspace for a unique email', async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        await createClientWithPassword(workspace.id, 'client@test.com', 'pass123');

        const res = await request.post('/api/client-portal/discover-workspace').send({ email: 'client@test.com' });

        expect(res.status).toBe(200);
        expect(res.body.workspaces).toHaveLength(1);
        expect(res.body.workspaces[0].slug).toBe(workspace.slug);
        expect(res.body.workspaces[0].name).toBe(workspace.name);
    });

    test('resolves the workspace regardless of the email\'s case, with surrounding whitespace', async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        await createClientWithPassword(workspace.id, 'john@example.com', 'pass123');

        for (const variant of ['JOHN@EXAMPLE.COM', '  JoHn@Example.Com  ']) {
            const res = await request.post('/api/client-portal/discover-workspace').send({ email: variant });
            expect(res.status).toBe(200);
            expect(res.body.workspaces).toHaveLength(1);
            expect(res.body.workspaces[0].slug).toBe(workspace.slug);
        }
    });

    test('returns every workspace when the same email belongs to multiple workspaces', async () => {
        const userA = await createTestUser({ email: `a-${createId()}@test.com` });
        const userB = await createTestUser({ email: `b-${createId()}@test.com` });
        const wsA   = await createTestWorkspace(userA.id);
        const wsB   = await createTestWorkspace(userB.id);
        await createClientWithPassword(wsA.id, 'shared@test.com', 'pass123');
        await createClientWithPassword(wsB.id, 'shared@test.com', 'pass456');

        const res = await request.post('/api/client-portal/discover-workspace').send({ email: 'shared@test.com' });

        expect(res.status).toBe(200);
        const slugs = res.body.workspaces.map((w: { slug: string }) => w.slug).sort();
        expect(slugs).toEqual([wsA.slug, wsB.slug].sort());
    });

    test('returns a friendly 404 for an unknown email without leaking details', async () => {
        const res = await request.post('/api/client-portal/discover-workspace').send({ email: 'nobody@test.com' });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/couldn't find an account/i);
    });

    test('rejects an invalid email with 400', async () => {
        const res = await request.post('/api/client-portal/discover-workspace').send({ email: 'not-an-email' });

        expect(res.status).toBe(400);
    });

    test('rejects a missing email with 400', async () => {
        const res = await request.post('/api/client-portal/discover-workspace').send({});

        expect(res.status).toBe(400);
    });

    test('excludes clients belonging to an archived workspace', async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        await createClientWithPassword(workspace.id, 'archived@test.com', 'pass123');
        await testPrisma.workspaces.update({ where: { id: workspace.id }, data: { archived_at: new Date() } });

        const res = await request.post('/api/client-portal/discover-workspace').send({ email: 'archived@test.com' });

        expect(res.status).toBe(404);
    });

    test('excludes an archived client even if the workspace is active', async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        const client     = await createClientWithPassword(workspace.id, 'gone@test.com', 'pass123');
        await testPrisma.clients.update({ where: { id: client.id }, data: { archived_at: new Date() } });

        const res = await request.post('/api/client-portal/discover-workspace').send({ email: 'gone@test.com' });

        expect(res.status).toBe(404);
    });

    test('the workspace slug returned by discovery is accepted by the unchanged login endpoint', async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        await createClientWithPassword(workspace.id, 'client@test.com', 'pass123');

        const discover = await request.post('/api/client-portal/discover-workspace').send({ email: 'client@test.com' });
        const { slug: workspaceSlug } = discover.body.workspaces[0];

        const login = await request
            .post('/api/client-portal/login')
            .send({ email: 'client@test.com', password: 'pass123', workspace_slug: workspaceSlug });

        expect(login.status).toBe(200);
        expect(login.body.token).toBeDefined();
    });
});

describe('Client portal login — unaffected by the discovery endpoint', () => {
    test('still rejects login without a workspace slug', async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        await createClientWithPassword(workspace.id, 'client@test.com', 'pass123');

        const res = await request.post('/api/client-portal/login').send({ email: 'client@test.com', password: 'pass123' });

        expect(res.status).toBe(400);
    });

    test('still rejects cross-workspace credentials', async () => {
        const userA = await createTestUser({ email: `a-${createId()}@test.com` });
        const userB = await createTestUser({ email: `b-${createId()}@test.com` });
        const wsA   = await createTestWorkspace(userA.id);
        const wsB   = await createTestWorkspace(userB.id);
        await createClientWithPassword(wsA.id, 'client@test.com', 'pass123');

        const res = await request
            .post('/api/client-portal/login')
            .send({ email: 'client@test.com', password: 'pass123', workspace_slug: wsB.slug });

        expect(res.status).toBe(401);
    });

    test('logs in regardless of the email\'s case', async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        await createClientWithPassword(workspace.id, 'john@example.com', 'pass123');

        const res = await request
            .post('/api/client-portal/login')
            .send({ email: 'JoHn@Example.Com', password: 'pass123', workspace_slug: workspace.slug });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });
});
