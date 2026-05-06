const request = require('supertest');
const app = require('../server');
const { resetDatabase, createCoach } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => require('../db').end());

describe('POST /api/auth/register', () => {
    it('creates a user, workspace, and free subscription', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ fname: 'Alice', lname: 'Smith', email: 'alice@test.com', password: 'password123' });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe('alice@test.com');
        expect(res.body.workspace_slug).toBeTruthy();
        // Password should NOT be in the response
        expect(res.body.password).toBeUndefined();
    });

    it('rejects duplicate email', async () => {
        await createCoach({ email: 'dupe@test.com' });
        const res = await request(app)
            .post('/api/auth/register')
            .send({ fname: 'Bob', lname: 'Jones', email: 'dupe@test.com', password: 'password123' });

        expect(res.status).toBe(500); // currently returns 500; ideally 409
    });
});

describe('POST /api/auth/login', () => {
    it('returns a cookie and workspace data on success', async () => {
        await createCoach({ email: 'coach@test.com', password: 'password123' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'coach@test.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.selectedWorkspace).toBeDefined();
        // Token should NOT be in the response body
        expect(res.body.token).toBeUndefined();
        // Cookie should be set
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.headers['set-cookie'][0]).toMatch(/token=/);
    });

    it('rejects wrong password', async () => {
        await createCoach({ email: 'coach@test.com', password: 'correct' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'coach@test.com', password: 'wrong' });

        expect(res.status).toBe(401);
    });
});

describe('GET /api/auth/me', () => {
    it('returns user info when authenticated', async () => {
        const { token } = await createCoach();

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', `token=${token}`);

        expect(res.status).toBe(200);
        expect(res.body.userId).toBeDefined();
        expect(res.body.currentWorkspace).toBeDefined();
    });

    it('returns 401 when not authenticated', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });
});
