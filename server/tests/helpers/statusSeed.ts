import { testPrisma } from './testDb';
import { createId } from '@paralleldrive/cuid2';

// Seeds clients covering every subscription state the status logic distinguishes, round-robin.
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

// One scenario per kind of subscription state the status logic distinguishes.
export type Scenario = 'none' | 'active' | 'expired' | 'frozen' | 'preStart' | 'planStarted' | 'archived';
export const SCENARIOS: Scenario[] = ['none', 'active', 'expired', 'frozen', 'preStart', 'planStarted', 'archived'];

export async function seedClients(workspaceId: string, count: number) {
    const clients = Array.from({ length: count }, (_, i) => ({
        id: createId(), client_code: 20000 + i, fname: 'Status', lname: `Client${i}`,
        email: `status-${i}-${createId()}@test.com`, workspace_id: workspaceId,
        scenario: SCENARIOS[i % SCENARIOS.length],
    }));
    await testPrisma.clients.createMany({
        data: clients.map(({ scenario, ...row }) => ({ ...row, archived_at: scenario === 'archived' ? new Date() : null })),
    });

    let code = 1;
    const tx = (clientId: string, over: Record<string, unknown>) => ({
        id: createId(), transaction_code: 5000 * 0 + code++, workspace_id: workspaceId, client_id: clientId, client_name: 'x',
        payment_method: 'cash', amount: 100, status: 'completed', duration: 30, start_mode: 'custom', ...over,
    });
    const transactions: ReturnType<typeof tx>[] = [];
    const freezes: Array<Record<string, unknown>> = [];
    const plans: Array<Record<string, unknown>> = [];
    for (const c of clients) {
        if (c.scenario === 'active' || c.scenario === 'archived') transactions.push(tx(c.id, { subscription_start_date: daysAgo(5) }));
        if (c.scenario === 'expired')   transactions.push(tx(c.id, { subscription_start_date: daysAgo(100) }));
        if (c.scenario === 'frozen') {
            transactions.push(tx(c.id, { subscription_start_date: daysAgo(5) }));
            freezes.push({ id: createId(), client_id: c.id, freeze_start_date: daysAgo(1), freeze_duration_days: 10 });
        }
        if (c.scenario === 'preStart')    transactions.push(tx(c.id, { start_mode: 'on_first_plan', subscription_start_date: null }));
        if (c.scenario === 'planStarted') {
            transactions.push(tx(c.id, { start_mode: 'on_first_plan', subscription_start_date: null }));
            plans.push({ id: createId(), name: 'Plan', client_id: c.id, workspace_id: workspaceId, activated_at: daysAgo(3) });
        }
    }
    if (transactions.length) await testPrisma.transactions.createMany({ data: transactions as never });
    if (freezes.length)      await testPrisma.subscription_freezes.createMany({ data: freezes as never });
    if (plans.length)        await testPrisma.training_plans.createMany({ data: plans as never });
    return clients;
}
