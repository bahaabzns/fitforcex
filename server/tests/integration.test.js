/**
 * Integration Tests for FitForce X
 *
 * Critical paths tested:
 * - User registration and login (auth flow)
 * - Workspace creation and isolation (multi-tenancy)
 * - Subscription status computation (complex business logic)
 * - File upload authentication (security)
 * - Client portal cross-workspace isolation (IDOR vulnerability)
 * - Plan limit enforcement (seat limits)
 */

const request = require('supertest');
const app = require('../server');
const pool = require('../db');
const { resetDatabase, createCoach, createClient } = require('./helpers');
const { computeSubscriptionStatus } = require('../utils/subscriptionStatus');

beforeEach(resetDatabase);
afterAll(() => pool.end());

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: REGISTRATION & LOGIN SECURITY
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register — Input Validation', () => {
    it('rejects empty email', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ fname: 'John', lname: 'Doe', email: '', password: 'password123' });

        expect(res.status).toBe(400);
    });

    it('rejects empty password', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ fname: 'John', lname: 'Doe', email: 'john@test.com', password: '' });

        expect(res.status).toBe(400);
    });

    it('rejects very short password', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ fname: 'John', lname: 'Doe', email: 'john@test.com', password: 'pwd' });

        expect(res.status).toBe(400);
    });

    it('creates workspace with auto-generated slug on register', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                fname: 'Alice',
                lname: 'Smith',
                email: 'alice@test.com',
                password: 'password123',
            });

        expect(res.status).toBe(201);
        expect(res.body.workspace_slug).toBeTruthy();
        // Verify workspace was created in DB
        const { rows } = await pool.query('SELECT id, slug FROM workspaces WHERE slug = $1', [res.body.workspace_slug]);
        expect(rows.length).toBe(1);
    });

    it('does not return plaintext password in response', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                fname: 'Bob',
                lname: 'Jones',
                email: 'bob@test.com',
                password: 'password123',
            });

        expect(res.status).toBe(201);
        expect(res.body.password).toBeUndefined();
        expect(res.body.tempPassword).toBeUndefined();
    });
});

describe('POST /api/auth/login — Token Handling', () => {
    beforeEach(async () => {
        await createCoach({ email: 'user@test.com', password: 'password123' });
    });

    it('returns httpOnly cookie but NOT token in body', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'user@test.com', password: 'password123' });

        expect(res.status).toBe(200);
        // Token should NOT be in response body
        expect(res.body.token).toBeUndefined();
        // But cookie should be set
        expect(res.headers['set-cookie']).toBeDefined();
        const cookies = res.headers['set-cookie'];
        const tokenCookie = cookies.find(c => c.includes('token='));
        expect(tokenCookie).toBeTruthy();
        // Should have httpOnly flag
        expect(tokenCookie).toMatch(/httpOnly/i);
    });

    it('rejects login with wrong password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'user@test.com', password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/Invalid|wrong/i);
    });

    it('rejects login with non-existent email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nonexistent@test.com', password: 'password123' });

        expect(res.status).toBe(401);
    });

    it('prevents credential enumeration (same error for email + wrong password)', async () => {
        const res1 = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nonexistent@test.com', password: 'password123' });

        const res2 = await request(app)
            .post('/api/auth/login')
            .send({ email: 'user@test.com', password: 'wrongpassword' });

        // Both should return same generic 401 message (don't reveal which field was wrong)
        expect(res1.status).toBe(401);
        expect(res2.status).toBe(401);
        expect(res1.body.message).toBe(res2.body.message);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: CROSS-WORKSPACE ISOLATION (MULTI-TENANCY)
// ─────────────────────────────────────────────────────────────────────────────

describe('Workspace Isolation — Clients', () => {
    let tokenA, workspaceA, tokenB, workspaceB, clientB;

    beforeEach(async () => {
        const resA = await createCoach({ email: 'a@test.com' });
        tokenA = resA.token;
        workspaceA = resA.workspace;

        const resB = await createCoach({ email: 'b@test.com' });
        tokenB = resB.token;
        workspaceB = resB.workspace;

        clientB = await createClient(workspaceB.id, { email: 'clientb@test.com' });
    });

    it('coach A cannot read client from workspace B', async () => {
        const res = await request(app)
            .get(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`);

        expect(res.status).toBe(404);
    });

    it('coach A cannot update client from workspace B', async () => {
        const res = await request(app)
            .put(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`)
            .send({ fname: 'Hacked' });

        expect(res.status).toBe(404);
    });

    it('coach A cannot delete client from workspace B', async () => {
        const res = await request(app)
            .delete(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`);

        expect(res.status).toBe(404);
    });

    it('GET /api/clients filters by current workspace only', async () => {
        const clientA = await createClient(workspaceA.id, { email: 'clienta@test.com' });

        const res = await request(app)
            .get('/api/clients')
            .set('Cookie', `token=${tokenA}`);

        expect(res.status).toBe(200);
        const clients = Array.isArray(res.body) ? res.body : res.body.data || [];
        const clientIds = clients.map(c => c.id);

        expect(clientIds).toContain(clientA.id);
        expect(clientIds).not.toContain(clientB.id);
    });
});

describe('Workspace Isolation — Training Plans', () => {
    let tokenA, workspaceA, tokenB, workspaceB;

    beforeEach(async () => {
        const resA = await createCoach({ email: 'a@test.com' });
        tokenA = resA.token;
        workspaceA = resA.workspace;

        const resB = await createCoach({ email: 'b@test.com' });
        tokenB = resB.token;
        workspaceB = resB.workspace;
    });

    it('coach A cannot read training plan from workspace B', async () => {
        const clientA = await createClient(workspaceA.id);
        const clientB = await createClient(workspaceB.id);

        // Create a training plan for clientB
        const { rows: [planB] } = await pool.query(
            `INSERT INTO training_plans (name, client_id, workspace_id, status)
             VALUES ('PlanB', $1, $2, 'active') RETURNING id`,
            [clientB.id, workspaceB.id]
        );

        // Coach A tries to access planB
        const res = await request(app)
            .get(`/api/training/${planB.id}`)
            .set('Cookie', `token=${tokenA}`);

        expect(res.status).toBe(404);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: CLIENT PORTAL CROSS-WORKSPACE ISOLATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Client Portal Login — Cross-Workspace Isolation', () => {
    it('client cannot log in without providing workspace slug', async () => {
        const { workspace: ws1 } = await createCoach({ email: 'coach1@test.com' });
        const { workspace: ws2 } = await createCoach({ email: 'coach2@test.com' });

        const client1 = await createClient(ws1.id, { email: 'shared@test.com', password: 'pwd' });
        const client2 = await createClient(ws2.id, { email: 'shared@test.com' });

        // Set password for client1
        await pool.query(
            'UPDATE clients SET password = $1 WHERE id = $2',
            [require('bcrypt').hashSync('password123', 10), client1.id]
        );

        // Attempt to login WITHOUT workspace slug (currently allows cross-workspace access)
        const res = await request(app)
            .post('/api/client-portal/login')
            .send({ email: 'shared@test.com', password: 'password123' });

        // Should REQUIRE workspace_slug and return 400 if missing
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/workspace|slug/i);
    });

    it('client can log in WITH workspace slug (namespace isolation)', async () => {
        const { workspace: ws } = await createCoach({ email: 'coach@test.com' });
        const client = await createClient(ws.id, { email: 'client@test.com' });

        // Set password
        await pool.query(
            'UPDATE clients SET password = $1 WHERE id = $2',
            [require('bcrypt').hashSync('password123', 10), client.id]
        );

        const res = await request(app)
            .post('/api/client-portal/login')
            .send({
                email: 'client@test.com',
                password: 'password123',
                workspace_slug: ws.slug,
            });

        expect(res.status).toBe(200);
        expect(res.headers['set-cookie']).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: SUBSCRIPTION STATUS COMPUTATION (BUSINESS LOGIC)
// ─────────────────────────────────────────────────────────────────────────────

describe('Subscription Status — State Machine', () => {
    function daysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d.toISOString();
    }

    function daysFromNow(n) {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return d.toISOString();
    }

    function makeTx(overrides = {}) {
        return {
            status: 'completed',
            duration: 30,
            start_mode: 'on_first_plan',
            subscription_start_date: null,
            created_at: new Date().toISOString(),
            ...overrides,
        };
    }

    it('returns "No Subscriptions" with no transactions', () => {
        const status = computeSubscriptionStatus([], [], null);
        expect(status).toBe('No Subscriptions');
    });

    it('returns "Pre-start" for completed but not-yet-activated plan', () => {
        const tx = makeTx({ start_mode: 'on_first_plan' });
        const status = computeSubscriptionStatus([tx], [], null);
        expect(status).toBe('Pre-start');
    });

    it('returns "Active" within subscription window', () => {
        const tx = makeTx({ duration: 30, start_mode: 'on_first_plan' });
        const activated = daysAgo(5); // 5 days ago
        const status = computeSubscriptionStatus([tx], [], activated);
        expect(status).toBe('Active');
    });

    it('returns "Expired" after subscription window passes', () => {
        const tx = makeTx({ duration: 10, start_mode: 'on_first_plan' });
        const activated = daysAgo(15); // 15 days ago (expired 5 days ago)
        const status = computeSubscriptionStatus([tx], [], activated);
        expect(status).toBe('Expired');
    });

    it('handles freeze duration extending subscription', () => {
        // 10-day sub started 12 days ago (would be expired)
        // But 5-day freeze started 8 days ago extends it by 5 days
        const tx = makeTx({ duration: 10, start_mode: 'on_first_plan' });
        const activated = daysAgo(12);
        const freeze = {
            freeze_start_date: daysAgo(8),
            freeze_duration_days: 5,
        };
        const status = computeSubscriptionStatus([tx], [freeze], activated);
        // Should be Active (12 + 10 + 5 = 27 days total, only 12 passed)
        expect(status).toBe('Active');
    });

    it('returns "Frozen" when inside freeze window', () => {
        const tx = makeTx({ duration: 30, start_mode: 'on_first_plan' });
        const activated = daysAgo(5);
        const freeze = {
            freeze_start_date: daysAgo(2), // 2 days ago
            freeze_duration_days: 10, // 10 days = until 8 days from now
        };
        const status = computeSubscriptionStatus([tx], [freeze], activated);
        expect(status).toBe('Frozen');
    });

    it('queues second subscription when first ends', () => {
        // First subscription: 10 days, started 15 days ago = ended 5 days ago
        const tx1 = makeTx({
            duration: 10,
            start_mode: 'on_first_plan',
            created_at: daysAgo(20),
        });
        // Second subscription: queued to start when first ends
        const tx2 = makeTx({
            duration: 30,
            start_mode: 'queued',
            created_at: daysAgo(5),
        });
        const activated = daysAgo(15);

        const status = computeSubscriptionStatus([tx1, tx2], [], activated);
        // tx1 ended 5 days ago, tx2 starts then and runs 30 days = should be Active
        expect(status).toBe('Active');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: PLAN LIMIT ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────

describe('Plan Limits — Workspace Seat Limits', () => {
    it('free plan limits workspace to 1 seat', async () => {
        // Create workspace with free plan (1 seat = owner only)
        const { token, workspace } = await createCoach({ email: 'coach@test.com' });
        
        // Create another user to invite
        const bcrypt = require('bcrypt');
        await pool.query(
            'INSERT INTO users (fname, lname, email, password) VALUES ($1, $2, $3, $4)',
            ['New', 'Member', 'newmember@test.com', await bcrypt.hash('password123', 10)]
        );

        // Try to invite another user (should exceed seat limit)
        const res = await request(app)
            .post('/api/workspaces/' + workspace.id + '/members')
            .set('Cookie', `token=${token}`)
            .send({
                email: 'newmember@test.com',
                role: 'manager',
            });

        // Should reject due to seat limit (403)
        expect([400, 403, 409]).toContain(res.status);
    });

    it('starter plan allows 5 seats', async () => {
        const { workspace, token } = await createCoach({ email: 'coach@test.com' });
        
        // Create a user to invite
        const bcrypt = require('bcrypt');
        await pool.query(
            'INSERT INTO users (fname, lname, email, password) VALUES ($1, $2, $3, $4)',
            ['Member', 'One', 'member1@test.com', await bcrypt.hash('password123', 10)]
        );

        // Upgrade to starter plan (5 seats)
        await pool.query(
            `UPDATE workspace_subscriptions
             SET plan_id = (SELECT id FROM plans WHERE name = 'starter')
             WHERE workspace_id = $1`,
            [workspace.id]
        );

        // Should be able to invite (starter plan allows 5 seats)
        const res = await request(app)
            .post('/api/workspaces/' + workspace.id + '/members')
            .set('Cookie', `token=${token}`)
            .send({
                email: 'member1@test.com',
                role: 'manager',
            });

        // Should succeed (201 Created)
        expect([200, 201]).toContain(res.status);
    });
});

describe('Plan Limits — Workspace Creation', () => {
    it('free plan user limited to 1 workspace', async () => {
        const { token, user } = await createCoach({ email: 'coach@test.com' });

        // Try to create second workspace
        const res = await request(app)
            .post('/api/workspaces')
            .set('Cookie', `token=${token}`)
            .send({ name: 'Second Workspace' });

        // Should reject (already has 1 on free plan)
        expect([400, 403, 409]).toContain(res.status);
    });

    it('starter plan user can create up to 3 workspaces', async () => {
        const { user, workspace } = await createCoach({ email: 'coach@test.com' });

        // Upgrade all user's workspaces to starter (allows 3 workspaces)
        await pool.query(
            `UPDATE workspace_subscriptions
             SET plan_id = (SELECT id FROM plans WHERE name = 'starter')
             WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = $1)`,
            [user.id]
        );

        // Mint fresh token (to reflect workspace changes)
        const token = require('jsonwebtoken').sign(
            { userId: user.id, workspaceId: workspace.id, role: 'owner' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Try to create second workspace
        const res1 = await request(app)
            .post('/api/workspaces')
            .set('Cookie', `token=${token}`)
            .send({ name: 'Second Workspace' });

        // Try to create third workspace
        const res2 = await request(app)
            .post('/api/workspaces')
            .set('Cookie', `token=${token}`)
            .send({ name: 'Third Workspace' });

        // Both should succeed (starter = 3 workspaces total)
        expect([200, 201]).toContain(res1.status);
        expect([200, 201]).toContain(res2.status);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: FILE UPLOAD AUTHENTICATION
// ─────────────────────────────────────────────────────────────────────────────

describe('File Uploads — Authentication Required', () => {
    it('rejects unauthenticated file upload to /api/training/upload', async () => {
        const res = await request(app)
            .post('/api/training/upload')
            .attach('file', Buffer.from('fake image data'), 'test.jpg');

        expect(res.status).toBe(401);
    });

    it('rejects unauthenticated file upload to /api/transactions/proof-image', async () => {
        const res = await request(app)
            .post('/api/transactions/proof-image')
            .attach('file', Buffer.from('fake image data'), 'proof.jpg');

        expect(res.status).toBe(401);
    });

    it('authenticated user can upload file', async () => {
        const { token } = await createCoach({ email: 'coach@test.com' });

        const res = await request(app)
            .post('/api/training/upload')
            .set('Cookie', `token=${token}`)
            .attach('file', Buffer.from('fake image data'), 'test.jpg');

        // Should succeed or fail with file-specific error, not auth error
        expect(res.status).not.toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: CLIENT CODE GENERATION RACE CONDITION
// ─────────────────────────────────────────────────────────────────────────────

describe('Client Creation — Race Condition', () => {
    it('concurrent client creation generates unique codes', async () => {
        const { token, workspace } = await createCoach({ email: 'coach@test.com' });

        // Create two clients in parallel
        const [res1, res2] = await Promise.all([
            request(app)
                .post('/api/clients')
                .set('Cookie', `token=${token}`)
                .send({
                    fname: 'Client1',
                    lname: 'One',
                    email: 'client1@test.com',
                }),
            request(app)
                .post('/api/clients')
                .set('Cookie', `token=${token}`)
                .send({
                    fname: 'Client2',
                    lname: 'Two',
                    email: 'client2@test.com',
                }),
        ]);

        // Both should succeed
        expect(res1.status).toBe(201);
        expect(res2.status).toBe(201);

        // Client codes should be different (mapped as 'code' in response)
        expect(res1.body.code).toBeDefined();
        expect(res2.body.code).toBeDefined();
        expect(res1.body.code).not.toBe(res2.body.code);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: PERMISSION CHECKS
// ─────────────────────────────────────────────────────────────────────────────

describe('Permission Enforcement', () => {
    it('non-owner cannot update workspace settings', async () => {
        const { workspace } = await createCoach({ email: 'owner@test.com' });

        // Create the manager user
        const managerPass = require('bcrypt').hashSync('password123', 10);
        const { rows: [manager] } = await pool.query(
            `INSERT INTO users (fname, lname, email, password) VALUES ('Manager', 'User', 'manager@test.com', $1) RETURNING id`,
            [managerPass]
        );

        // Accept invitation
        await pool.query(
            `INSERT INTO workspace_members (workspace_id, user_id, role)
             VALUES ($1, $2, 'manager')`,
            [workspace.id, manager.id]
        );

        // Manager token
        const managerToken = require('jsonwebtoken').sign(
            { userId: manager.id, workspaceId: workspace.id, role: 'manager' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Try to rename workspace as manager
        const res = await request(app)
            .patch(`/api/workspaces/${workspace.id}/name`)
            .set('Cookie', `token=${managerToken}`)
            .send({ name: 'Hacked Workspace' });

        // Should be denied
        expect(res.status).toBe(403);
    });
});
