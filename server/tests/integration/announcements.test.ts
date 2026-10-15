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
