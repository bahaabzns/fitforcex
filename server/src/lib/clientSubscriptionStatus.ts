import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { computeSubscriptionStatus } from '../utils/subscriptionStatus';

type PlanActRow = { client_id: string; first_activation: Date | null };
type TxLike = { status: string; created_at: string | Date; duration?: number | string | null; start_mode?: string | null; subscription_start_date?: string | Date | null };
type FreezeLike = { freeze_start_date: string | Date; freeze_duration_days: number | string; client_id?: string };

/**
 * Live-computed subscription status for a set of clients, keyed by client id.
 * clients.subscription_status is only a once-daily snapshot column written by the
 * scheduler for change-detection/audit purposes (see middleware/scheduler.ts) — the
 * read path must always compute status from transactions/freezes/plan-activation,
 * never read that column directly, or callers silently drift out of sync with it
 * (this is what made the dashboard and messenger undercount "Active" clients against
 * the clients page, which already computed live).
 */
export async function computeStatusesForClients(
    workspaceId: string,
    clients: { id: string; archived_at: Date | null }[],
): Promise<Record<string, string>> {
    const clientIds = clients.map(c => c.id);
    if (clientIds.length === 0) return {};

    const [txRows, freezeRows, planActRows] = await Promise.all([
        prisma.transactions.findMany({
            where:  { workspace_id: workspaceId, client_id: { in: clientIds } },
            select: { client_id: true, status: true, duration: true, subscription_start_date: true, start_mode: true, created_at: true },
        }),
        prisma.subscription_freezes.findMany({
            where: { client_id: { in: clientIds } },
        }),
        prisma.$queryRaw<PlanActRow[]>`
            SELECT client_id, MIN(activated_at) AS first_activation FROM (
                SELECT client_id, activated_at FROM training_plans
                WHERE workspace_id = ${workspaceId} AND client_id = ANY(${Prisma.raw(`ARRAY[${clientIds.map(id => `'${id}'`).join(',')}]`)}) AND activated_at IS NOT NULL
                UNION ALL
                SELECT client_id, activated_at FROM nutrition_plans
                WHERE workspace_id = ${workspaceId} AND client_id = ANY(${Prisma.raw(`ARRAY[${clientIds.map(id => `'${id}'`).join(',')}]`)}) AND activated_at IS NOT NULL
            ) combined GROUP BY client_id
        `,
    ]);

    const txByClient: Record<string, TxLike[]> = {};
    for (const tx of txRows) {
        if (!tx.client_id) continue;
        (txByClient[tx.client_id] ??= []).push(tx as TxLike);
    }

    const freezesByClient: Record<string, FreezeLike[]> = {};
    for (const f of freezeRows as FreezeLike[]) {
        const key = f.client_id as string;
        (freezesByClient[key] ??= []).push(f);
    }

    const planActivationByClient: Record<string, string | null> = {};
    for (const row of planActRows) {
        planActivationByClient[row.client_id] = row.first_activation ? new Date(row.first_activation).toISOString() : null;
    }

    const statuses: Record<string, string> = {};
    for (const client of clients) {
        statuses[client.id] = client.archived_at
            ? 'Archived'
            : computeSubscriptionStatus(
                txByClient[client.id] || [],
                freezesByClient[client.id] || [],
                planActivationByClient[client.id] ?? null,
            );
    }
    return statuses;
}
