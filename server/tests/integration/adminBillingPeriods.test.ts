import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';
import { request } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

function adminCookie(): string {
    const token = jwt.sign({ isAdmin: true, id: 'test-admin' }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' });
    return `admin_token=${token}`;
}

const uniqueKey = () => `test_${createId().slice(0, 10).toLowerCase()}`;

describe('Admin billing periods', () => {
    it('creates a billing period and lists it with the rest', async () => {
        const key = uniqueKey();

        const created = await request.post('/api/admin/billing-discounts').set('Cookie', adminCookie())
            .send({ period_key: key, label: 'Two years', label_ar: 'سنتان', discount_percent: 30, months: 24, save_label: 'Save 30%' });

        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({ period_key: key, label: 'Two years', discount_percent: 30, months: 24, is_active: true });
        const listed = await request.get('/api/admin/billing-discounts').set('Cookie', adminCookie());
        expect(listed.body.some((row: { period_key: string }) => row.period_key === key)).toBe(true);
    });

    it('puts a new period after the existing ones', async () => {
        const first = await request.post('/api/admin/billing-discounts').set('Cookie', adminCookie()).send({ period_key: uniqueKey(), label: 'A' });
        const second = await request.post('/api/admin/billing-discounts').set('Cookie', adminCookie()).send({ period_key: uniqueKey(), label: 'B' });

        expect(second.body.sort_order).toBeGreaterThan(first.body.sort_order);
    });

    it('rejects a duplicate key with a clear message', async () => {
        const key = uniqueKey();
        await request.post('/api/admin/billing-discounts').set('Cookie', adminCookie()).send({ period_key: key, label: 'First' });

        const duplicate = await request.post('/api/admin/billing-discounts').set('Cookie', adminCookie()).send({ period_key: key, label: 'Second' });

        expect(duplicate.status).toBe(409);
        expect(duplicate.body.message).toContain(key);
    });

    it('rejects a bad key, a missing label, a discount over 100 and zero months', async () => {
        const post = (body: Record<string, unknown>) => request.post('/api/admin/billing-discounts').set('Cookie', adminCookie()).send(body);

        expect((await post({ period_key: 'Has Spaces!', label: 'X' })).status).toBe(400);
        expect((await post({ period_key: uniqueKey(), label: '  ' })).status).toBe(400);
        expect((await post({ period_key: uniqueKey(), label: 'X', discount_percent: 101 })).status).toBe(400);
        expect((await post({ period_key: uniqueKey(), label: 'X', months: 0 })).status).toBe(400);
    });

    it('refuses callers who are not admins', async () => {
        const res = await request.post('/api/admin/billing-discounts').send({ period_key: uniqueKey(), label: 'X' });

        expect([401, 403]).toContain(res.status);
        expect(await testPrisma.billing_discounts.count({ where: { label: 'X', period_key: { startsWith: 'test_' } } })).toBe(0);
    });
});
