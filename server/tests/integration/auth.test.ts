import { request, createTestUser } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

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
