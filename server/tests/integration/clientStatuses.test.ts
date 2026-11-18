import { createTestUser, createTestWorkspace } from '../helpers/testServer';
import { seedClients } from '../helpers/statusSeed';
import { computeStatusesForClients } from '../../src/lib/clientSubscriptionStatus';
import { computeClientStatus } from '../../src/modules/subscriptionPolicies/subscriptionPolicies.service';

describe('computeStatusesForClients', () => {
    let workspaceId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        workspaceId = (await createTestWorkspace(user.id)).id;
    });

    async function expectedStatus(clientId: string, archived: boolean): Promise<string> {
        return archived ? 'Archived' : (await computeClientStatus(clientId, workspaceId)).status;
    }

    test('small sets match the per-client computation for every kind of client', async () => {
        const clients = await seedClients(workspaceId, 21);
        const input = clients.map((c) => ({ id: c.id, archived_at: c.scenario === 'archived' ? new Date() : null }));

        const statuses = await computeStatusesForClients(workspaceId, input);

        for (const c of clients) expect(statuses[c.id]).toBe(await expectedStatus(c.id, c.scenario === 'archived'));
        expect(new Set(Object.values(statuses)).size).toBeGreaterThanOrEqual(5); // the seed really covers several states
    });

    test('large sets (whole-workspace path) match the per-client computation too', async () => {
        const clients = await seedClients(workspaceId, 1050);
        const input = clients.map((c) => ({ id: c.id, archived_at: c.scenario === 'archived' ? new Date() : null }));

        const statuses = await computeStatusesForClients(workspaceId, input);

        const sample = clients.filter((_, i) => i % 7 === 0 || i < 14);   // every scenario, without 1,050 round trips
        for (const c of sample) expect(statuses[c.id]).toBe(await expectedStatus(c.id, c.scenario === 'archived'));
        expect(Object.keys(statuses)).toHaveLength(1050);
    });

    test('ignores another workspace’s data on the large path', async () => {
        const otherOwner = await createTestUser();
        const otherWs    = await createTestWorkspace(otherOwner.id);
        await seedClients(otherWs.id, 30);
        const mine = await seedClients(workspaceId, 1001);

        const statuses = await computeStatusesForClients(workspaceId, mine.map((c) => ({ id: c.id, archived_at: null })));

        expect(Object.keys(statuses)).toHaveLength(1001);
        expect(statuses[mine[0].id]).toBe('No Subscriptions'); // scenario "none", whatever the other workspace holds
    });

    test('returns an empty object for no clients', async () => {
        await expect(computeStatusesForClients(workspaceId, [])).resolves.toEqual({});
    });
});
