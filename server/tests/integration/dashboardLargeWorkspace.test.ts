import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { seedClients } from '../helpers/statusSeed';

describe('GET /api/dashboard on a larger workspace', () => {
    test('counts, recent clients and growth points stay correct after dropping the second client query', async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        const cookie = await makeAuthCookie(user.id, ws.id, 'owner');
        const clients = await seedClients(ws.id, 28);   // 4 of each scenario

        const res = await request.get('/api/dashboard').set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.stats.totalClients).toBe(clients.length);
        expect(res.body.stats.activeClients).toBe(4 + 4);   // "active" and "planStarted" scenarios; archived clients are not Active
        expect(res.body.stats.expiredClients).toBe(4);
        expect(res.body.recentClients).toHaveLength(5);
        expect(res.body.clientGrowth).toHaveLength(clients.length);
        const dates = (res.body.clientGrowth as Array<{ date: string; value: number }>).map((p) => new Date(p.date).getTime());
        expect([...dates].sort((a, b) => a - b)).toEqual(dates);   // oldest first
        expect(res.body.clientGrowth[clients.length - 1].value).toBe(clients.length);
    });
});
