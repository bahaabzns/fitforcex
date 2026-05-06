const request = require('supertest');
const app = require('../server');
const { resetDatabase, createCoach, createClient } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => require('../db').end());

describe('Tenant isolation — clients', () => {
    it('coach A cannot read clients from workspace B', async () => {
        const { token: tokenA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });
        const clientB = await createClient(wsB.id, { email: 'client-b@test.com' });

        const res = await request(app)
            .get(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`);

        // Should be 404 (not found in workspace A), not 200
        expect(res.status).toBe(404);
    });

    it('coach A cannot delete clients from workspace B', async () => {
        const { token: tokenA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });
        const clientB = await createClient(wsB.id, { email: 'client-b@test.com' });

        const res = await request(app)
            .delete(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`);

        expect(res.status).toBe(404);
    });

    it('coach A cannot update clients from workspace B', async () => {
        const { token: tokenA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });
        const clientB = await createClient(wsB.id, { email: 'client-b@test.com' });

        const res = await request(app)
            .put(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`)
            .send({ fname: 'Hacker' });

        expect(res.status).toBe(404);
    });

    it('GET /api/clients only returns clients from the current workspace', async () => {
        const { token: tokenA, workspace: wsA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });

        await createClient(wsA.id, { email: 'client-in-a@test.com' });
        await createClient(wsB.id, { email: 'client-in-b@test.com' });

        const res = await request(app)
            .get('/api/clients')
            .set('Cookie', `token=${tokenA}`);

        expect(res.status).toBe(200);
        const clients = res.body.data || res.body; // handles both paginated and non-paginated
        const emails = clients.map(c => c.email);

        expect(emails).toContain('client-in-a@test.com');
        expect(emails).not.toContain('client-in-b@test.com');
    });
});
