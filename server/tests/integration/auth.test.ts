import { request, createTestUser, createTestWorkspace } from '../helpers/testServer';
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

    test('rejects a duplicate email that only differs by case (409)', async () => {
        const localPart = `dupecase-${createId()}`;
        await createTestUser({ email: `${localPart}@test.com`, phone: `+2010${Date.now()}4` });
        const res = await request.post('/api/auth/register')
            .send({ ...base, email: `${localPart.toUpperCase()}@TEST.COM`, phone: `+2010${Date.now()}5` });
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

describe('POST /auth/login — case-insensitive email', () => {
    test('logs in with the exact stored casing', async () => {
        const user = await createTestUser({ email: 'CaseUser@Test.com' });
        await createTestWorkspace(user.id);
        const res = await request.post('/api/auth/login').send({ email: 'CaseUser@Test.com', password: 'password123' });
        expect(res.status).toBe(200);
    });

    test('logs in with a different case than what was stored', async () => {
        const user = await createTestUser({ email: 'CaseUser2@Test.com' });
        await createTestWorkspace(user.id);
        const res = await request.post('/api/auth/login').send({ email: 'caseuser2@test.com', password: 'password123' });
        expect(res.status).toBe(200);
    });

    test('a fresh registration normalizes the stored email to lowercase', async () => {
        const localPart = `newcoach-${createId()}`;
        const res = await request.post('/api/auth/register').send({
            fname: 'New', lname: 'Coach', password: 'password123',
            phone: `+2010${Date.now()}`, email: `${localPart.toUpperCase()}@TEST.COM`,
        });
        expect(res.status).toBe(201);
        expect(res.body.email).toBe(`${localPart}@test.com`);
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

    test('creates a password_reset_tokens row when requested with a different case', async () => {
        const user = await createTestUser({ email: 'CaseReset@Test.com' });
        await request.post('/api/auth/forgot-password').send({ email: 'casereset@test.com' });
        const row = await testPrisma.password_reset_tokens.findFirst({ where: { user_id: user.id } });
        expect(row).not.toBeNull();
    });

    test('resets the password when the request email differs in case from the stored one', async () => {
        await createTestUser({ email: 'CaseFlow@Test.com' });
        await request.post('/api/auth/forgot-password').send({ email: 'caseflow@test.com' });
        const user = await testPrisma.users.findFirst({ where: { email: 'CaseFlow@Test.com' } });
        const row  = await testPrisma.password_reset_tokens.findFirst({ where: { user_id: user!.id } });

        const res = await request.post('/api/auth/reset-password')
            .send({ email: 'CASEFLOW@TEST.COM', code: row!.code, newPassword: 'NewPassword123!' });
        expect(res.status).toBe(200);
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

describe('POST /auth/register — inert-orphan takeover', () => {
    const base = { fname: 'Real', lname: 'Person', password: 'password123' };

    // An unverified users row with no workspace and no activity — the shape left
    // behind by a fitforce.io migration import for someone who never onboarded,
    // or by an abandoned paid checkout (register writes the row before payment).
    // Its email is globally unique, so without takeover it blocks signup forever.
    const createInertOrphan = (email: string, extra: Record<string, unknown> = {}) =>
        createTestUser({ email, email_verified: false, ...extra });

    test('reclaims the orphan row instead of 409 (201, same id, workspace attached)', async () => {
        const email  = `orphan-${createId()}@test.com`;
        const orphan = await createInertOrphan(email);

        const res = await request.post('/api/auth/register')
            .send({ ...base, email, phone: `+2010${Date.now()}` });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe(email);
        expect(res.body.id).toBe(orphan.id);            // row reused, not duplicated
        expect(res.body.workspace_slug).toBeTruthy();

        const rows = await testPrisma.users.findMany({ where: { email } });
        expect(rows).toHaveLength(1);
        expect(rows[0].default_workspace_id).toBe(res.body.workspace_id);
        expect(rows[0].email_verified).toBe(false);
        expect(rows[0].fname).toBe('Real');             // overwritten with the new signup's name
    });

    test('reclaims even when the submitted phone already sits on that same orphan (abandoned-checkout retry)', async () => {
        const email = `resume-${createId()}@test.com`;
        const phone = `+2010${Date.now()}`;
        await createInertOrphan(email, { phone });

        const res = await request.post('/api/auth/register').send({ ...base, email, phone });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe(email);
    });

    test('clears stale password-reset codes from the reclaimed row', async () => {
        const email  = `resettoken-${createId()}@test.com`;
        const orphan = await createInertOrphan(email);
        await testPrisma.password_reset_tokens.create({
            data: { id: createId(), user_id: orphan.id, code: 'OLD123', expires_at: new Date(Date.now() + 60_000) },
        });

        await request.post('/api/auth/register').send({ ...base, email, phone: `+2010${Date.now()}` });

        const tokens = await testPrisma.password_reset_tokens.findMany({ where: { user_id: orphan.id } });
        expect(tokens).toHaveLength(0);
    });

    test('does NOT reclaim a row with a live session (409)', async () => {
        const email  = `hassession-${createId()}@test.com`;
        const orphan = await createInertOrphan(email);
        await testPrisma.user_sessions.create({
            data: {
                id: createId(), user_id: orphan.id,
                token_hash: `hash-${createId()}`,
                expires_at: new Date(Date.now() + 3_600_000),
            },
        });

        const res = await request.post('/api/auth/register')
            .send({ ...base, email, phone: `+2010${Date.now()}` });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/email/i);
    });

    test('does NOT reclaim a row that owns a workspace (409)', async () => {
        const email  = `hasworkspace-${createId()}@test.com`;
        const orphan = await createInertOrphan(email);
        await createTestWorkspace(orphan.id);

        const res = await request.post('/api/auth/register')
            .send({ ...base, email, phone: `+2010${Date.now()}` });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/email/i);
    });

    test('does NOT reclaim a verified account (409)', async () => {
        const email = `verified-${createId()}@test.com`;
        await createTestUser({ email });                 // email_verified defaults to true

        const res = await request.post('/api/auth/register')
            .send({ ...base, email, phone: `+2010${Date.now()}` });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/email/i);
    });
});
