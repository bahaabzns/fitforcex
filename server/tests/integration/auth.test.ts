import { request, createTestUser } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

describe('POST /auth/register — phone required + email/phone uniqueness', () => {
    const base = { fname: 'New', lname: 'Coach', password: 'password123' };

    test('registers a coach with a unique email + phone (201)', async () => {
        const res = await request.post('/api/auth/register')
            .send({ ...base, email: `reg-${createId()}@test.com`, phone: `+2010${Date.now()}` });
        expect(res.status).toBe(201);
    });

    test('rejects registration without a phone number (400)', async () => {
        const res = await request.post('/api/auth/register')
            .send({ ...base, email: `nophone-${createId()}@test.com` });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/phone/i);
    });

    test('rejects a duplicate email (409)', async () => {
        const email = `dupe-${createId()}@test.com`;
        await createTestUser({ email, phone: `+2010${Date.now()}1` });
        const res = await request.post('/api/auth/register')
            .send({ ...base, email, phone: `+2010${Date.now()}2` });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/email/i);
    });

    test('rejects a duplicate phone number (409)', async () => {
        const phone = `+2010${Date.now()}3`;
        await createTestUser({ email: `phone-owner-${createId()}@test.com`, phone });
        const res = await request.post('/api/auth/register')
            .send({ ...base, email: `other-${createId()}@test.com`, phone });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/phone/i);
    });
});

describe('P1-1 — Forgot / Reset Password', () => {
    test('POST /auth/forgot-password returns 200 for known email', async () => {
        await createTestUser({ email: 'known@test.com' });
        const res = await request.post('/api/auth/forgot-password')
            .send({ email: 'known@test.com' });
        expect(res.status).toBe(200);
    });

    test('POST /auth/forgot-password returns 200 for unknown email (no enumeration)', async () => {
        const res = await request.post('/api/auth/forgot-password')
            .send({ email: 'nobody@test.com' });
        expect(res.status).toBe(200);
    });

    test('creates a password_reset_tokens row for known email', async () => {
        await createTestUser({ email: 'tokenuser@test.com' });
        await request.post('/api/auth/forgot-password').send({ email: 'tokenuser@test.com' });
        const user = await testPrisma.users.findFirst({ where: { email: 'tokenuser@test.com' } });
        const row = await testPrisma.password_reset_tokens.findFirst({ where: { user_id: user!.id } });
        expect(row).not.toBeNull();
    });

    test('POST /auth/reset-password succeeds with a valid code', async () => {
        await createTestUser({ email: 'resetme@test.com' });
        await request.post('/api/auth/forgot-password').send({ email: 'resetme@test.com' });
        const user = await testPrisma.users.findFirst({ where: { email: 'resetme@test.com' } });
        const row = await testPrisma.password_reset_tokens.findFirst({
            where: { user_id: user!.id },
        });
        const res = await request.post('/api/auth/reset-password')
            .send({ email: 'resetme@test.com', code: row!.code, newPassword: 'NewPassword123!' });
        expect(res.status).toBe(200);
    });

    test('POST /auth/reset-password rejects an expired code', async () => {
        const user = await createTestUser({ email: 'expired@test.com' });
        await testPrisma.password_reset_tokens.create({
            data: {
                id:         createId(),
                user_id:    user.id,
                code:       'EXPIRED123',
                expires_at: new Date(Date.now() - 1000),
            },
        });
        const res = await request.post('/api/auth/reset-password')
            .send({ email: 'expired@test.com', code: 'EXPIRED123', newPassword: 'newpass123' });
        expect(res.status).toBe(400);
    });
});
