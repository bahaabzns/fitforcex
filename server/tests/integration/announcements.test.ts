import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

function adminCookie(): string {
    const token = jwt.sign({ isAdmin: true, id: 'test-admin' }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' });
    return `admin_token=${token}`;
}

async function coachCookie() {
    const user = await createTestUser();
    const workspace = await createTestWorkspace(user.id);
    return { user, cookie: await makeAuthCookie(user.id, workspace.id, 'owner') };
}

async function createAnnouncement(overrides: Record<string, unknown> = {}) {
    return testPrisma.product_announcements.create({
        data: { id: createId(), title: 'New thing', body: 'It does a thing.', ...overrides },
    });
}

describe('Product announcements', () => {
    beforeEach(async () => {
        // the seeded Custom Branding row would otherwise compete with each test's own announcements
        await testPrisma.product_announcements.deleteMany({});
    });

    describe('coach dashboard card', () => {
        test('requires authentication', async () => {
            const res = await request.get('/api/announcements/active');
            expect(res.status).toBe(401);
        });

        test('returns null when there is nothing to show', async () => {
            const { cookie } = await coachCookie();
            const res = await request.get('/api/announcements/active').set('Cookie', cookie);
            expect(res.status).toBe(200);
            expect(res.body.announcement).toBeNull();
        });

        test('returns exactly one announcement, lowest sort_order first', async () => {
            await createAnnouncement({ title: 'Second', sort_order: 5 });
            await createAnnouncement({ title: 'First', sort_order: 1 });
            const { cookie } = await coachCookie();

            const res = await request.get('/api/announcements/active').set('Cookie', cookie);
            expect(res.body.announcement.title).toBe('First');
        });

        test('returns up to three announcements for the dashboard row, in order, never more', async () => {
            for (const [title, sort_order] of [['Fourth', 4], ['First', 1], ['Third', 3], ['Second', 2]] as const) {
                await createAnnouncement({ title, sort_order });
            }
            const { cookie } = await coachCookie();

            const res = await request.get('/api/announcements/active').set('Cookie', cookie);
            expect(res.body.announcements.map((a: { title: string }) => a.title)).toEqual(['First', 'Second', 'Third']);
            expect(res.body.announcement.title).toBe('First');   // the single-card field is the top one
        });

        test('returns an empty list when nothing is live, and fewer than three when fewer exist', async () => {
            const { cookie } = await coachCookie();
            expect((await request.get('/api/announcements/active').set('Cookie', cookie)).body.announcements).toEqual([]);

            await createAnnouncement({ title: 'Only' });
            const res = await request.get('/api/announcements/active').set('Cookie', cookie);
            expect(res.body.announcements).toHaveLength(1);
        });

        test('a dismissed announcement leaves the list and the next one fills its place on the next visit', async () => {
            for (const [title, sort_order] of [['A', 1], ['B', 2], ['C', 3], ['D', 4]] as const) {
                await createAnnouncement({ title, sort_order });
            }
            const { cookie } = await coachCookie();
            const first = await request.get('/api/announcements/active').set('Cookie', cookie);
            await request.post(`/api/announcements/${first.body.announcements[1].id}/dismiss`).set('Cookie', cookie).send({});

            const again = await request.get('/api/announcements/active').set('Cookie', cookie);
            expect(again.body.announcements.map((a: { title: string }) => a.title)).toEqual(['A', 'C', 'D']);
        });

        test('skips inactive, not-yet-started and expired announcements', async () => {
            await createAnnouncement({ title: 'Inactive', is_active: false });
            await createAnnouncement({ title: 'Future', starts_at: new Date(Date.now() + 86_400_000) });
            await createAnnouncement({ title: 'Expired', ends_at: new Date(Date.now() - 86_400_000) });
            await createAnnouncement({ title: 'Live', sort_order: 9 });
            const { cookie } = await coachCookie();

            const res = await request.get('/api/announcements/active').set('Cookie', cookie);
            expect(res.body.announcement.title).toBe('Live');
        });

        test('rotates to the next announcement after a dismissal and is per coach', async () => {
            const first = await createAnnouncement({ title: 'First', sort_order: 1 });
            await createAnnouncement({ title: 'Second', sort_order: 2 });
            const a = await coachCookie();
            const b = await coachCookie();

            const dismissed = await request.post(`/api/announcements/${first.id}/dismiss`).set('Cookie', a.cookie).send({});
            expect(dismissed.status).toBe(200);

            const forA = await request.get('/api/announcements/active').set('Cookie', a.cookie);
            const forB = await request.get('/api/announcements/active').set('Cookie', b.cookie);
            expect(forA.body.announcement.title).toBe('Second');
            expect(forB.body.announcement.title).toBe('First');
        });

        test('records a CTA click and returns 404 for an unknown announcement', async () => {
            const item = await createAnnouncement();
            const { user, cookie } = await coachCookie();

            const clicked = await request.post(`/api/announcements/${item.id}/dismiss`).set('Cookie', cookie).send({ action: 'clicked' });
            expect(clicked.status).toBe(200);
            const row = await testPrisma.announcement_dismissals.findFirst({ where: { user_id: user.id } });
            expect(row?.action).toBe('clicked');

            const missing = await request.post('/api/announcements/nope/dismiss').set('Cookie', cookie).send({});
            expect(missing.status).toBe(404);
        });
    });

    describe('targeting by subscription plan', () => {
        async function createPlan(label: string) {
            return testPrisma.plans.create({ data: { id: createId(), name: `${label}-${createId()}`, display_name: label } });
        }
        async function coachOnPlan(planId: string | null) {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            if (planId) {
                await testPrisma.workspace_subscriptions.create({ data: { id: createId(), workspace_id: workspace.id, plan_id: planId } });
            }
            return makeAuthCookie(user.id, workspace.id, 'owner');
        }
        const titles = async (cookie: string) =>
            (await request.get('/api/announcements/active').set('Cookie', cookie)).body.announcements.map((a: { title: string }) => a.title);

        test('an announcement with no target plans is shown to every workspace, on any plan or none', async () => {
            const pro = await createPlan('Pro');
            await createAnnouncement({ title: 'For everyone' });
            expect(await titles(await coachOnPlan(pro.id))).toEqual(['For everyone']);
            expect(await titles(await coachOnPlan(null))).toEqual(['For everyone']);
        });

        test('a targeted announcement is shown only to workspaces on one of its plans', async () => {
            const free = await createPlan('Free');
            const pro = await createPlan('Pro');
            const team = await createPlan('Team');
            await createAnnouncement({ title: 'Upgrade to Team', target_plan_ids: [free.id, pro.id] });

            expect(await titles(await coachOnPlan(free.id))).toEqual(['Upgrade to Team']);
            expect(await titles(await coachOnPlan(pro.id))).toEqual(['Upgrade to Team']);
            expect(await titles(await coachOnPlan(team.id))).toEqual([]);
        });

        test('a workspace with no subscription never sees a targeted announcement, only untargeted ones', async () => {
            const pro = await createPlan('Pro');
            await createAnnouncement({ title: 'Pro only', target_plan_ids: [pro.id] });
            await createAnnouncement({ title: 'Everyone', sort_order: 5 });
            expect(await titles(await coachOnPlan(null))).toEqual(['Everyone']);
        });

        test('targeting is applied before the three-announcement limit', async () => {
            const pro = await createPlan('Pro');
            const free = await createPlan('Free');
            for (const sort_order of [1, 2, 3]) await createAnnouncement({ title: `Pro ${sort_order}`, sort_order, target_plan_ids: [pro.id] });
            await createAnnouncement({ title: 'Free one', sort_order: 4, target_plan_ids: [free.id] });

            // The free workspace must still get its announcement, not an empty row after three pro-only ones.
            expect(await titles(await coachOnPlan(free.id))).toEqual(['Free one']);
            expect(await titles(await coachOnPlan(pro.id))).toEqual(['Pro 1', 'Pro 2', 'Pro 3']);
        });

        test('the plan comes from the coach current workspace, not their other workspaces', async () => {
            const pro = await createPlan('Pro');
            const free = await createPlan('Free');
            await createAnnouncement({ title: 'Pro only', target_plan_ids: [pro.id] });
            const user = await createTestUser();
            const proWorkspace = await createTestWorkspace(user.id);
            const freeWorkspace = await createTestWorkspace(user.id);
            await testPrisma.workspace_subscriptions.create({ data: { id: createId(), workspace_id: proWorkspace.id, plan_id: pro.id } });
            await testPrisma.workspace_subscriptions.create({ data: { id: createId(), workspace_id: freeWorkspace.id, plan_id: free.id } });

            expect(await titles(await makeAuthCookie(user.id, proWorkspace.id, 'owner'))).toEqual(['Pro only']);
            expect(await titles(await makeAuthCookie(user.id, freeWorkspace.id, 'owner'))).toEqual([]);
        });

        test('admin can create and update an announcement with target plans, and it is listed', async () => {
            const pro = await createPlan('Pro');
            const free = await createPlan('Free');
            const created = await request.post('/api/admin/announcements').set('Cookie', adminCookie())
                .send({ title: 'Targeted', body: 'Only some.', target_plan_ids: [pro.id, pro.id] });   // duplicates are collapsed
            expect(created.status).toBe(201);
            expect(created.body.target_plan_ids).toEqual([pro.id]);

            const updated = await request.put(`/api/admin/announcements/${created.body.id}`).set('Cookie', adminCookie())
                .send({ title: 'Targeted', body: 'Only some.', target_plan_ids: [free.id] });
            expect(updated.status).toBe(200);

            const list = await request.get('/api/admin/announcements').set('Cookie', adminCookie());
            expect(list.body[0].target_plan_ids).toEqual([free.id]);

            const cleared = await request.put(`/api/admin/announcements/${created.body.id}`).set('Cookie', adminCookie())
                .send({ title: 'Targeted', body: 'Only some.', target_plan_ids: [] });
            expect(cleared.status).toBe(200);
            expect((await request.get('/api/admin/announcements').set('Cookie', adminCookie())).body[0].target_plan_ids).toEqual([]);
        });

        test('admin cannot target a plan that does not exist', async () => {
            const res = await request.post('/api/admin/announcements').set('Cookie', adminCookie())
                .send({ title: 'Bad', body: 'Nope.', target_plan_ids: ['no-such-plan'] });
            expect(res.status).toBe(400);
            expect(await testPrisma.product_announcements.count()).toBe(0);
        });
    });

    describe('admin management', () => {
        test('requires an admin token', async () => {
            const { cookie } = await coachCookie();
            const res = await request.get('/api/admin/announcements').set('Cookie', cookie);
            expect(res.status).toBe(401);
        });

        test('creates, updates, lists with counts and deletes an announcement', async () => {
            const admin = adminCookie();

            const created = await request.post('/api/admin/announcements').set('Cookie', admin).send({
                title: 'Branding', body: 'Add your logo.', cta_label: 'Set up', cta_href: '/{slug}/settings/branding',
            });
            expect(created.status).toBe(201);
            const id = created.body.id as string;

            const updated = await request.put(`/api/admin/announcements/${id}`).set('Cookie', admin).send({
                title: 'Branding v2', body: 'Add your logo.', cta_label: 'Set up', cta_href: 'https://example.com/x', is_active: false,
            });
            expect(updated.status).toBe(200);

            const { cookie } = await coachCookie();
            await request.post(`/api/announcements/${id}/dismiss`).set('Cookie', cookie).send({});

            const listed = await request.get('/api/admin/announcements').set('Cookie', admin);
            const row = listed.body.find((a: { id: string }) => a.id === id);
            expect(row.title).toBe('Branding v2');
            expect(row.is_active).toBe(false);
            expect(row.dismissed_count).toBe(1);

            const removed = await request.delete(`/api/admin/announcements/${id}`).set('Cookie', admin);
            expect(removed.status).toBe(200);
            expect(await testPrisma.product_announcements.findUnique({ where: { id } })).toBeNull();
        });

        test('rejects unsafe links, a CTA link without a label, and an inverted schedule', async () => {
            const admin = adminCookie();
            const base = { title: 'T', body: 'B', cta_label: 'Go' };

            const js = await request.post('/api/admin/announcements').set('Cookie', admin).send({ ...base, cta_href: 'javascript:alert(1)' });
            expect(js.status).toBe(400);

            const http = await request.post('/api/admin/announcements').set('Cookie', admin).send({ ...base, cta_href: 'http://example.com' });
            expect(http.status).toBe(400);

            const noLabel = await request.post('/api/admin/announcements').set('Cookie', admin).send({ title: 'T', body: 'B', cta_href: '/{slug}/team' });
            expect(noLabel.status).toBe(400);

            const schedule = await request.post('/api/admin/announcements').set('Cookie', admin).send({
                ...base, starts_at: '2030-02-01T00:00:00.000Z', ends_at: '2030-01-01T00:00:00.000Z',
            });
            expect(schedule.status).toBe(400);
        });

        test('republishes: clears dismissals and makes an inactive, expired announcement live again', async () => {
            const admin = adminCookie();
            const item = await createAnnouncement({
                title: 'Old news',
                is_active: false,
                starts_at: new Date(Date.now() + 86_400_000),
                ends_at: new Date(Date.now() - 3_600_000),
            });
            const { cookie } = await coachCookie();
            await request.post(`/api/announcements/${item.id}/dismiss`).set('Cookie', cookie).send({});

            const res = await request.post(`/api/admin/announcements/${item.id}/republish`).set('Cookie', admin);
            expect(res.status).toBe(200);
            expect(res.body.reset).toBe(1);

            const row = await testPrisma.product_announcements.findUnique({ where: { id: item.id } });
            expect(row?.is_active).toBe(true);
            expect(row?.starts_at).toBeNull();
            expect(row?.ends_at).toBeNull();

            const active = await request.get('/api/announcements/active').set('Cookie', cookie);
            expect(active.body.announcement.id).toBe(item.id);
        });

        test('republish keeps a still-valid schedule and returns 404 for an unknown announcement', async () => {
            const admin = adminCookie();
            const endsAt = new Date(Date.now() + 7 * 86_400_000);
            const item = await createAnnouncement({ ends_at: endsAt });

            const ok = await request.post(`/api/admin/announcements/${item.id}/republish`).set('Cookie', admin);
            expect(ok.status).toBe(200);
            const row = await testPrisma.product_announcements.findUnique({ where: { id: item.id } });
            expect(row?.ends_at?.getTime()).toBe(endsAt.getTime());

            const missing = await request.post('/api/admin/announcements/nope/republish').set('Cookie', admin);
            expect(missing.status).toBe(404);

            const noAuth = await request.post(`/api/admin/announcements/${item.id}/republish`);
            expect(noAuth.status).toBe(401);
        });

        test('uploads and removes an image, rejecting SVG and tiny images', async () => {
            const admin = adminCookie();
            const item = await createAnnouncement();
            const png = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#159bff' } }).png().toBuffer();
            const tiny = await sharp({ create: { width: 100, height: 50, channels: 3, background: '#159bff' } }).png().toBuffer();

            const ok = await request.post(`/api/admin/announcements/${item.id}/image`).set('Cookie', admin).attach('file', png, 'a.png');
            expect(ok.status).toBe(200);
            const withImage = await testPrisma.product_announcements.findUnique({ where: { id: item.id } });
            expect(withImage?.image_key).toMatch(/^announcements\//);

            const small = await request.post(`/api/admin/announcements/${item.id}/image`).set('Cookie', admin).attach('file', tiny, 't.png');
            expect(small.status).toBe(400);

            const svg = await request.post(`/api/admin/announcements/${item.id}/image`).set('Cookie', admin)
                .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'x.svg');
            expect(svg.status).toBe(400);

            const removed = await request.delete(`/api/admin/announcements/${item.id}/image`).set('Cookie', admin);
            expect(removed.status).toBe(200);
            const cleared = await testPrisma.product_announcements.findUnique({ where: { id: item.id } });
            expect(cleared?.image_key).toBeNull();
        });
    });
});
