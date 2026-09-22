import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { DEFAULT_PERMISSIONS } from '../../src/lib/defaultPermissions';

// Bug: GET /api/packages was gated on `finance.read` alone, so every default
// Team Member role except `receptionist` got a 403 and the package catalog
// silently disappeared — even though it's read broadly (Clients page package
// picker, client transactions), not just from the Finance area. Mutating a
// package (create/update/delete) must stay finance-gated.
describe('Packages — permission scoping for Team Member roles', () => {
    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request.get('/api/packages');
        expect(res.status).toBe(401);
    });

    test('returns 403 for a member with no clients or finance permission', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'member', null);
        const res = await request.get('/api/packages').set('Cookie', cookie);
        expect(res.status).toBe(403);
    });

    test.each(['manager', 'trainer', 'nutritionist', 'receptionist', 'viewer'])(
        'a %s can read the package catalog even without finance permission',
        async (role) => {
            const member = await createTestUser();
            const cookie = await makeAuthCookie(member.id, workspaceId, role, DEFAULT_PERMISSIONS[role]);

            const res = await request.get('/api/packages').set('Cookie', cookie);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        }
    );

    test('a trainer (finance: false) still cannot create a package', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'trainer', DEFAULT_PERMISSIONS.trainer);

        const res = await request.post('/api/packages').set('Cookie', cookie).send({
            name: 'Trainer Attempt',
            variations: [{ name: 'Standard', duration: 30, price: 100, currency: 'USD' }],
        });

        expect(res.status).toBe(403);
    });

    test('a receptionist (finance: true) can still create a package', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'receptionist', DEFAULT_PERMISSIONS.receptionist);

        const res = await request.post('/api/packages').set('Cookie', cookie).send({
            name: 'Receptionist Package',
            variations: [{ name: 'Standard', duration: 30, price: 100, currency: 'USD' }],
        });

        expect(res.status).toBe(201);
    });

    test('owner happy path: create then read the package back', async () => {
        const createRes = await request.post('/api/packages').set('Cookie', ownerCookie).send({
            name: 'Owner Package',
            variations: [{ name: 'Standard', duration: 30, price: 100, currency: 'USD' }],
        });
        expect(createRes.status).toBe(201);

        const listRes = await request.get('/api/packages').set('Cookie', ownerCookie);
        expect(listRes.status).toBe(200);
        expect(listRes.body.some((p: { id: string }) => p.id === createRes.body.id)).toBe(true);
    });
});
