import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { DEFAULT_PERMISSIONS } from '../../src/lib/defaultPermissions';

async function pngBuffer(width: number, height: number): Promise<Buffer> {
    return sharp({ create: { width, height, channels: 3, background: '#159bff' } }).png().toBuffer();
}

async function createPlan(capabilities: Record<string, boolean>) {
    return testPrisma.plans.create({
        data: {
            id: createId(), name: `plan-${createId()}`, display_name: 'Branded Plan',
            capabilities, is_active: true,
        },
    });
}

async function createWorkspaceOnPlan(planId: string) {
    const owner     = await createTestUser();
    const workspace = await createTestWorkspace(owner.id);
    await testPrisma.workspace_subscriptions.create({
        data: { id: createId(), workspace_id: workspace.id, plan_id: planId, status: 'active', expires_at: null },
    });
    const cookie = await makeAuthCookie(owner.id, workspace.id, 'owner');
    return { owner, workspace, cookie };
}

async function createClientCookie(workspaceId: string) {
    const client = await testPrisma.clients.create({
        data: {
            id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
            fname: 'T', lname: 'C', email: `c-${createId()}@test.com`, workspace_id: workspaceId,
        },
    });
    return makeClientCookie(client.id, workspaceId);
}

describe('Custom branding', () => {
    let brandedPlanId: string;
    let plainPlanId: string;

    beforeEach(async () => {
        // plans are not truncated by the shared reset — clear leftovers from any aborted run
        await testPrisma.workspace_subscriptions.deleteMany({ where: { plans: { display_name: 'Branded Plan' } } });
        await testPrisma.plans.deleteMany({ where: { display_name: 'Branded Plan' } });
        brandedPlanId = (await createPlan({ custom_branding: true })).id;
        plainPlanId   = (await createPlan({})).id;
    });

    afterEach(async () => {
        await testPrisma.workspace_subscriptions.deleteMany({ where: { plan_id: { in: [brandedPlanId, plainPlanId] } } });
        await testPrisma.plans.deleteMany({ where: { id: { in: [brandedPlanId, plainPlanId] } } });
    });

    describe('plan gating', () => {
        test('reports not eligible and returns 403 CAPABILITY_LOCKED on writes for a plan without the capability', async () => {
            const { cookie } = await createWorkspaceOnPlan(plainPlanId);

            const view = await request.get('/api/branding').set('Cookie', cookie);
            expect(view.status).toBe(200);
            expect(view.body.eligibility.eligible).toBe(false);

            const put = await request.put('/api/branding').set('Cookie', cookie).send({ primary_color: '#ff0000' });
            expect(put.status).toBe(403);
            expect(put.body.code).toBe('CAPABILITY_LOCKED');
        });

        test('allows saving colors on an eligible plan and rejects malformed colors', async () => {
            const { cookie } = await createWorkspaceOnPlan(brandedPlanId);

            const ok = await request.put('/api/branding').set('Cookie', cookie).send({ primary_color: '#ff5500', accent_color: '#00aa88' });
            expect(ok.status).toBe(200);
            expect(ok.body.branding.primaryColor).toBe('#ff5500');
            expect(ok.body.eligibility.eligible).toBe(true);

            const bad = await request.put('/api/branding').set('Cookie', cookie).send({ primary_color: 'red; x:y' });
            expect(bad.status).toBe(400);
        });

        test('denies a team member without team.write permission', async () => {
            const { workspace } = await createWorkspaceOnPlan(brandedPlanId);
            const member = await createTestUser();
            const cookie = await makeAuthCookie(member.id, workspace.id, 'viewer', DEFAULT_PERMISSIONS.viewer);

            const res = await request.get('/api/branding').set('Cookie', cookie);
            expect(res.status).toBe(403);
        });

        test('requires authentication', async () => {
            const res = await request.get('/api/branding');
            expect(res.status).toBe(401);
        });
    });

    describe('what trainees see', () => {
        test('shows saved colors to the own coach client and defaults to another coach client', async () => {
            const a = await createWorkspaceOnPlan(brandedPlanId);
            const b = await createWorkspaceOnPlan(brandedPlanId);
            await request.put('/api/branding').set('Cookie', a.cookie).send({ primary_color: '#ff5500' });

            const clientOfA = await createClientCookie(a.workspace.id);
            const clientOfB = await createClientCookie(b.workspace.id);

            const forA = await request.get('/api/client-portal/branding').set('Cookie', clientOfA);
            const forB = await request.get('/api/client-portal/branding').set('Cookie', clientOfB);

            expect(forA.status).toBe(200);
            expect(forA.body.brandColor).toBe('#ff5500');
            expect(forA.body.primaryForeground).toBe('#000000');
            expect(forB.status).toBe(200);
            expect(forB.body.brandColor).toBeNull();
        });

        test('hides branding immediately when the subscription has expired and restores it on renewal', async () => {
            const { workspace, cookie } = await createWorkspaceOnPlan(brandedPlanId);
            await request.put('/api/branding').set('Cookie', cookie).send({ primary_color: '#ff5500' });
            const clientCookie = await createClientCookie(workspace.id);

            await testPrisma.workspace_subscriptions.update({
                where: { workspace_id: workspace.id }, data: { expires_at: new Date(Date.now() - 60_000) },
            });
            const expired = await request.get('/api/client-portal/branding').set('Cookie', clientCookie);
            expect(expired.body.brandColor).toBeNull();

            await testPrisma.workspace_subscriptions.update({
                where: { workspace_id: workspace.id }, data: { expires_at: new Date(Date.now() + 86_400_000) },
            });
            const renewed = await request.get('/api/client-portal/branding').set('Cookie', clientCookie);
            expect(renewed.body.brandColor).toBe('#ff5500');
        });

        test('hides branding when the plan loses the capability but keeps the saved values', async () => {
            const { workspace, cookie } = await createWorkspaceOnPlan(brandedPlanId);
            await request.put('/api/branding').set('Cookie', cookie).send({ primary_color: '#ff5500' });
            const clientCookie = await createClientCookie(workspace.id);

            await testPrisma.workspace_subscriptions.update({ where: { workspace_id: workspace.id }, data: { plan_id: plainPlanId } });

            const trainee = await request.get('/api/client-portal/branding').set('Cookie', clientCookie);
            expect(trainee.body.brandColor).toBeNull();

            const coach = await request.get('/api/branding').set('Cookie', cookie);
            expect(coach.body.eligibility.eligible).toBe(false);
            expect(coach.body.branding.primaryColor).toBe('#ff5500');
        });

        test('public workspace lookup exposes theme fields only, never banners', async () => {
            const { workspace, cookie } = await createWorkspaceOnPlan(brandedPlanId);
            await request.put('/api/branding').set('Cookie', cookie).send({ primary_color: '#ff5500' });

            const res = await request.get('/api/client-portal/workspace').query({ slug: workspace.slug });
            expect(res.status).toBe(200);
            expect(res.body.brandColor).toBe('#ff5500');
            expect(res.body.banners).toBeUndefined();
        });
    });

    describe('banners and logo', () => {
        test('uploads, reorders and deletes banners scoped to the workspace', async () => {
            const { cookie } = await createWorkspaceOnPlan(brandedPlanId);
            const other = await createWorkspaceOnPlan(brandedPlanId);
            const png = await pngBuffer(1200, 400);

            const first = await request.post('/api/branding/banners').set('Cookie', cookie)
                .field('title', 'Summer sale').field('link_url', 'https://example.com')
                .attach('file', png, 'a.png');
            expect(first.status).toBe(201);
            expect(first.body.banners).toHaveLength(1);

            const second = await request.post('/api/branding/banners').set('Cookie', cookie).attach('file', png, 'b.png');
            const ids = second.body.banners.map((b: { id: string }) => b.id);

            const reversed = [...ids].reverse();
            const reordered = await request.put('/api/branding/banners/order').set('Cookie', cookie).send({ ids: reversed });
            expect(reordered.status).toBe(200);
            expect(reordered.body.banners.map((b: { id: string }) => b.id)).toEqual(reversed);

            const foreign = await request.delete(`/api/branding/banners/${ids[0]}`).set('Cookie', other.cookie);
            expect(foreign.status).toBe(404);

            const removed = await request.delete(`/api/branding/banners/${ids[0]}`).set('Cookie', cookie);
            expect(removed.status).toBe(200);
            expect(removed.body.banners).toHaveLength(1);
        });

        test('rejects the 6th banner, bad links, tiny images and non-raster files', async () => {
            const { cookie } = await createWorkspaceOnPlan(brandedPlanId);
            const png = await pngBuffer(1200, 400);

            for (let i = 0; i < 5; i++) {
                const res = await request.post('/api/branding/banners').set('Cookie', cookie).attach('file', png, `b${i}.png`);
                expect(res.status).toBe(201);
            }
            const sixth = await request.post('/api/branding/banners').set('Cookie', cookie).attach('file', png, 'x.png');
            expect(sixth.status).toBe(409);

            const other = await createWorkspaceOnPlan(brandedPlanId);
            const badLink = await request.post('/api/branding/banners').set('Cookie', other.cookie)
                .field('link_url', 'javascript:alert(1)').attach('file', png, 'x.png');
            expect(badLink.status).toBe(400);

            const tiny = await request.post('/api/branding/banners').set('Cookie', other.cookie)
                .attach('file', await pngBuffer(200, 80), 'tiny.png');
            expect(tiny.status).toBe(400);

            const svg = await request.post('/api/branding/banners').set('Cookie', other.cookie)
                .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg');
            expect(svg.status).toBe(400);
        });

        test('uploads a logo and clears it', async () => {
            const { cookie } = await createWorkspaceOnPlan(brandedPlanId);
            const res = await request.post('/api/branding/logo').set('Cookie', cookie).attach('file', await pngBuffer(400, 400), 'logo.png');
            expect(res.status).toBe(200);
            expect(res.body.branding.logoUrl).toMatch(/branding\//);

            const removed = await request.delete('/api/branding/logo').set('Cookie', cookie);
            expect(removed.body.branding.logoUrl).toBeNull();
        });
    });
});
