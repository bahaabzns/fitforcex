import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

async function createClient(workspaceId: string, overrides: Record<string, unknown> = {}) {
    return testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Ahmed',
            lname:        'Ali',
            email:        `client-${createId()}@test.com`,
            workspace_id: workspaceId,
            ...overrides,
        },
    });
}

// A cookie for a non-owner member that DOES carry clients permissions — proves
// the owner guard (not the permission guard) is what blocks permanent delete.
async function makeMemberWithClientsPerm(userId: string, workspaceId: string): Promise<string> {
    const token = jwt.sign(
        { userId, workspaceId, role: 'manager', permissions: { clients: { read: true, write: true, delete: true } } },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' },
    );
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await testPrisma.user_sessions.create({
        data: { id: createId(), user_id: userId, token_hash: tokenHash, expires_at: new Date(Date.now() + 3600_000) },
    });
    return `token=${token}`;
}

describe('Client archiving — coach API', () => {
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

    test('DELETE /clients/:id archives instead of deleting and writes an audit row', async () => {
        const client = await createClient(workspaceId);

        const res = await request.delete(`/api/clients/${client.id}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        expect(res.body.is_archived).toBe(true);

        const row = await testPrisma.clients.findUnique({ where: { id: client.id } });
        expect(row).not.toBeNull();              // data preserved, not destroyed
        expect(row!.archived_at).not.toBeNull();
        expect(row!.archived_by).toBe(ownerId);

        const audit = await testPrisma.subscription_status_audit.findMany({
            where: { client_id: client.id, event_type: 'client.archive' },
        });
        expect(audit.length).toBe(1);
    });

    test('archiving an already-archived client returns 409', async () => {
        const client = await createClient(workspaceId, { archived_at: new Date(), archived_by: ownerId });
        const res = await request.delete(`/api/clients/${client.id}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(409);
    });

    test('list returns active + archived together; archived rows report status "Archived" and is_archived', async () => {
        const active   = await createClient(workspaceId);
        const archived = await createClient(workspaceId, { archived_at: new Date(), archived_by: ownerId });

        const list = await request.get('/api/clients?page=1&limit=100').set('Cookie', ownerCookie);
        const byId = Object.fromEntries(list.body.data.map((c: { id: string }) => [c.id, c]));

        expect(byId[active.id]).toBeDefined();
        expect(byId[archived.id]).toBeDefined();
        expect(byId[active.id].is_archived).toBe(false);
        expect(byId[archived.id].is_archived).toBe(true);
        expect(byId[archived.id].subscription_status).toBe('Archived');
    });

    test('POST /clients/:id/restore reactivates an archived client', async () => {
        const client = await createClient(workspaceId, { archived_at: new Date(), archived_by: ownerId });

        const res = await request.post(`/api/clients/${client.id}/restore`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        expect(res.body.is_archived).toBe(false);

        const row = await testPrisma.clients.findUnique({ where: { id: client.id } });
        expect(row!.archived_at).toBeNull();
        expect(row!.restored_by).toBe(ownerId);
    });

    test('restoring a non-archived client returns 409', async () => {
        const client = await createClient(workspaceId);
        const res = await request.post(`/api/clients/${client.id}/restore`).set('Cookie', ownerCookie);
        expect(res.status).toBe(409);
    });

    test('tenant isolation: cannot archive a client in another workspace', async () => {
        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        const foreign   = await createClient(otherWs.id);

        const res = await request.delete(`/api/clients/${foreign.id}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(404);
    });

    test('GET /clients/:id/audit returns the event timeline', async () => {
        const client = await createClient(workspaceId);
        await request.delete(`/api/clients/${client.id}`).set('Cookie', ownerCookie);
        await request.post(`/api/clients/${client.id}/restore`).set('Cookie', ownerCookie);

        const res = await request.get(`/api/clients/${client.id}/audit`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        const types = res.body.map((e: { eventType: string }) => e.eventType);
        expect(types).toContain('client.archive');
        expect(types).toContain('client.restore');
    });
});

describe('Client permanent delete — danger zone', () => {
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

    test('non-owner (even with clients.delete) is blocked with 403', async () => {
        const member = await createTestUser();
        const memberCookie = await makeMemberWithClientsPerm(member.id, workspaceId);
        const client = await createClient(workspaceId, { archived_at: new Date(), archived_by: ownerId });

        const res = await request.delete(`/api/clients/${client.id}/permanent`).set('Cookie', memberCookie).send({ confirmName: 'Ahmed Ali' });
        expect(res.status).toBe(403);
    });

    test('cannot permanently delete a non-archived client (409)', async () => {
        const client = await createClient(workspaceId);
        const res = await request.delete(`/api/clients/${client.id}/permanent`).set('Cookie', ownerCookie).send({ confirmName: 'Ahmed Ali' });
        expect(res.status).toBe(409);
    });

    test('name mismatch is rejected with 400', async () => {
        const client = await createClient(workspaceId, { archived_at: new Date(), archived_by: ownerId });
        const res = await request.delete(`/api/clients/${client.id}/permanent`).set('Cookie', ownerCookie).send({ confirmName: 'Wrong Name' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('name_mismatch');
    });

    test('default strategy (anonymize): scrubs PII, keeps the row + analytics', async () => {
        const client = await createClient(workspaceId, { archived_at: new Date(), archived_by: ownerId, phone: '+20 100' });

        const res = await request.delete(`/api/clients/${client.id}/permanent`).set('Cookie', ownerCookie).send({ confirmName: 'Ahmed Ali' });
        expect(res.status).toBe(200);
        expect(res.body.strategy).toBe('anonymize');

        const row = await testPrisma.clients.findUnique({ where: { id: client.id } });
        expect(row).not.toBeNull();
        expect(row!.fname).toBe('Deleted');
        expect(row!.email).not.toContain('@test.com');
        expect(row!.phone).toBeNull();
        expect(row!.deleted_at).not.toBeNull();
    });

    test('hard strategy: removes the client but detaches and preserves revenue rows', async () => {
        const client = await createClient(workspaceId, { archived_at: new Date(), archived_by: ownerId });
        const tx = await testPrisma.transactions.create({
            data: {
                id: createId(), transaction_code: Math.floor(Math.random() * 90000) + 10000,
                workspace_id: workspaceId, client_id: client.id, client_name: 'Ahmed Ali',
                payment_method: 'cash', amount: 100, status: 'completed', duration: 30,
            },
        });

        const res = await request.delete(`/api/clients/${client.id}/permanent`).set('Cookie', ownerCookie).send({ confirmName: 'Ahmed Ali', strategy: 'hard' });
        expect(res.status).toBe(200);
        expect(res.body.strategy).toBe('hard');

        expect(await testPrisma.clients.findUnique({ where: { id: client.id } })).toBeNull();
        const keptTx = await testPrisma.transactions.findUnique({ where: { id: tx.id } });
        expect(keptTx).not.toBeNull();          // revenue preserved
        expect(keptTx!.client_id).toBeNull();   // detached from the deleted client
    });
});

describe('Client archiving — portal enforcement', () => {
    let workspaceId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
    });

    test('archived client has portal access fully denied', async () => {
        const client = await createClient(workspaceId, { archived_at: new Date() });
        const cookie = makeClientCookie(client.id, workspaceId);

        const access = await request.get('/api/client-portal/access').set('Cookie', cookie);
        expect(access.status).toBe(200);
        expect(access.body.status).toBe('Archived');
        expect(access.body.access.keep_portal_access).toBe(false);

        const plan = await request.get('/api/client-portal/active-plan').set('Cookie', cookie);
        expect(plan.status).toBe(403);
        expect(plan.body.code).toBe('PORTAL_RESTRICTED');
    });
});
