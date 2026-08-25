import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

// Regression coverage for: PDF export (and other modules the Team settings
// permission editor doesn't expose — pdfExport, insights, databases) getting
// silently wiped out whenever an owner edits any permission for a member.
// The editor only ever sends {clients, training, nutrition, forms, finance,
// team} in its PUT payload, so the endpoint must merge over the member's
// existing permissions rather than replacing the JSONB wholesale.
describe('PUT /api/workspaces/:id/members/:memberId/permissions', () => {
    let ownerId: string;
    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const owner = await createTestUser();
        ownerId = owner.id;
        const ws = await createTestWorkspace(ownerId);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(ownerId, workspaceId, 'owner');
    });

    test('editing a subset of modules preserves modules the payload omits', async () => {
        const trainer = await createTestUser();
        const member = await testPrisma.workspace_members.create({
            data: {
                id: createId(), workspace_id: workspaceId, user_id: trainer.id, role: 'trainer',
                permissions: {
                    clients:   { read: true, write: false, delete: false },
                    pdfExport: { read: true, write: false, delete: false },
                    insights:  { read: true, write: true, delete: false },
                },
            },
        });

        // Mirrors the Team settings permission editor: it only ever sends the
        // modules it renders a toggle for, never pdfExport/insights/databases.
        const res = await request
            .put(`/api/workspaces/${workspaceId}/members/${member.id}/permissions`)
            .set('Cookie', ownerCookie)
            .send({ permissions: { clients: { read: true, write: true, delete: false } } });

        expect(res.status).toBe(200);
        expect(res.body.permissions.clients).toEqual({ read: true, write: true, delete: false });
        expect(res.body.permissions.pdfExport).toEqual({ read: true, write: false, delete: false });
        expect(res.body.permissions.insights).toEqual({ read: true, write: true, delete: false });

        const stored = await testPrisma.workspace_members.findUnique({ where: { id: member.id } });
        expect((stored!.permissions as any).pdfExport).toEqual({ read: true, write: false, delete: false });
    });

    test('a submitted module still fully replaces its prior value (not a deep per-action merge)', async () => {
        const trainer = await createTestUser();
        const member = await testPrisma.workspace_members.create({
            data: {
                id: createId(), workspace_id: workspaceId, user_id: trainer.id, role: 'trainer',
                permissions: { clients: { read: true, write: true, delete: true } },
            },
        });

        const res = await request
            .put(`/api/workspaces/${workspaceId}/members/${member.id}/permissions`)
            .set('Cookie', ownerCookie)
            .send({ permissions: { clients: { read: true, write: false, delete: false } } });

        expect(res.status).toBe(200);
        expect(res.body.permissions.clients).toEqual({ read: true, write: false, delete: false });
    });

    test('returns 403 when a non-owner attempts to edit permissions', async () => {
        const manager = await createTestUser();
        await testPrisma.workspace_members.create({
            data: { id: createId(), workspace_id: workspaceId, user_id: manager.id, role: 'manager' },
        });
        const managerCookie = await makeAuthCookie(manager.id, workspaceId, 'manager');

        const trainer = await createTestUser();
        const member = await testPrisma.workspace_members.create({
            data: { id: createId(), workspace_id: workspaceId, user_id: trainer.id, role: 'trainer' },
        });

        const res = await request
            .put(`/api/workspaces/${workspaceId}/members/${member.id}/permissions`)
            .set('Cookie', managerCookie)
            .send({ permissions: { clients: { read: true, write: false, delete: false } } });

        expect(res.status).toBe(403);
    });
});
