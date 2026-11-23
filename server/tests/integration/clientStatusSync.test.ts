import { createTestUser, createTestWorkspace } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { seedClients } from '../helpers/statusSeed';
import { computeClientStatus } from '../../src/modules/subscriptionPolicies/subscriptionPolicies.service';
import { runClientStatusSyncTick } from '../../src/middleware/scheduler';

describe('runClientStatusSyncTick', () => {
    test('writes the snapshot for changed clients, counts them, and is a no-op the second time', async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        const clients = await seedClients(ws.id, 14);

        const changed = await runClientStatusSyncTick();
        const rows = await testPrisma.clients.findMany({ where: { workspace_id: ws.id }, select: { id: true, subscription_status: true } });

        for (const row of rows) {
            expect(row.subscription_status).toBe((await computeClientStatus(row.id, ws.id)).status);
        }
        expect(changed).toBeGreaterThan(0);
        expect(clients).toHaveLength(14);
        await expect(runClientStatusSyncTick()).resolves.toBe(0);
    });

    test('computes archived clients from their subscription, not as "Archived"', async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        const clients = await seedClients(ws.id, 7);
        const archived = clients.find((c) => c.scenario === 'archived')!;

        await runClientStatusSyncTick();

        const row = await testPrisma.clients.findUniqueOrThrow({ where: { id: archived.id }, select: { subscription_status: true } });
        expect(row.subscription_status).toBe('Active');
    });

    test('records an audit row and a notification for a client that just expired', async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        const clients = await seedClients(ws.id, 7);
        const expired = clients.find((c) => c.scenario === 'expired')!;
        await testPrisma.clients.update({ where: { id: expired.id }, data: { subscription_status: 'Active' } });

        await runClientStatusSyncTick();

        const audit = await testPrisma.subscription_status_audit.findFirst({ where: { client_id: expired.id, event_type: 'status.change' } });
        expect(audit?.from_status).toBe('Active');
        expect(audit?.to_status).toBe('Expired');
    });
});
