import { prisma } from './prisma';
import { computeSubscriptionStatus } from '../utils/subscriptionStatus';
import { clientStatusCache, clientStatusKey } from './clientStatusCache';

type PlanActRow = { client_id: string; first_activation: Date | null };
type TxLike = { status: string; created_at: string | Date; duration?: number | string | null; start_mode?: string | null; subscription_start_date?: string | Date | null };
type FreezeLike = { freeze_start_date: string | Date; freeze_duration_days: number | string; client_id?: string };
type TxRow = TxLike & { client_id: string | null };
type FreezeRow = FreezeLike & { client_id: string };

// From this many clients on, fetching the whole workspace in three set-based queries is cheaper than
// building a client_id IN (...) list of that size (Prisma spends about a second on a 10,000-id list
// over 30,000 transactions; plain SQL on the workspace filter takes about a third of that).
const LARGE_SET_THRESHOLD = 1000;

async function loadInputsForFewClients(workspaceId: string, clientIds: string[]) {
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
                WHERE workspace_id = ${workspaceId} AND client_id = ANY(${clientIds}) AND activated_at IS NOT NULL
                UNION ALL
                SELECT client_id, activated_at FROM nutrition_plans
                WHERE workspace_id = ${workspaceId} AND client_id = ANY(${clientIds}) AND activated_at IS NOT NULL
            ) combined GROUP BY client_id
        `,
    ]);
    return { txRows: txRows as TxRow[], freezeRows: freezeRows as FreezeRow[], planActRows };
}

async function loadInputsForWholeWorkspace(workspaceId: string) {
    const [txRows, freezeRows, planActRows] = await Promise.all([
        prisma.$queryRaw<TxRow[]>`
            SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
            FROM transactions
            WHERE workspace_id = ${workspaceId} AND client_id IS NOT NULL
        `,
        prisma.$queryRaw<FreezeRow[]>`
            SELECT f.client_id, f.freeze_start_date, f.freeze_duration_days
            FROM subscription_freezes f
            JOIN clients c ON c.id = f.client_id
            WHERE c.workspace_id = ${workspaceId}
        `,
        prisma.$queryRaw<PlanActRow[]>`
            SELECT client_id, MIN(activated_at) AS first_activation FROM (
                SELECT client_id, activated_at FROM training_plans
                WHERE workspace_id = ${workspaceId} AND activated_at IS NOT NULL
                UNION ALL
                SELECT client_id, activated_at FROM nutrition_plans
                WHERE workspace_id = ${workspaceId} AND activated_at IS NOT NULL
            ) combined GROUP BY client_id
        `,
    ]);
    return { txRows, freezeRows, planActRows };
}

/** Status of each client as if it were not archived, computed from live data (no cache). */
async function computeBaseStatuses(workspaceId: string, clientIds: string[]): Promise<Record<string, string>> {
    const { txRows, freezeRows, planActRows } = clientIds.length >= LARGE_SET_THRESHOLD
        ? await loadInputsForWholeWorkspace(workspaceId)
        : await loadInputsForFewClients(workspaceId, clientIds);

    const txByClient: Record<string, TxLike[]> = {};
    for (const tx of txRows) {
        if (!tx.client_id) continue;
        (txByClient[tx.client_id] ??= []).push(tx);
    }

    const freezesByClient: Record<string, FreezeLike[]> = {};
    for (const f of freezeRows) {
        (freezesByClient[f.client_id] ??= []).push(f);
    }

    const planActivationByClient: Record<string, string | null> = {};
    for (const row of planActRows) {
        planActivationByClient[row.client_id] = row.first_activation ? new Date(row.first_activation).toISOString() : null;
    }

    const statuses: Record<string, string> = {};
    for (const clientId of clientIds) {
        statuses[clientId] = computeSubscriptionStatus(
            txByClient[clientId] || [],
            freezesByClient[clientId] || [],
            planActivationByClient[clientId] ?? null,
        );
    }
    return statuses;
}

/**
 * Live-computed subscription status for a set of clients, keyed by client id.
 * clients.subscription_status is only a once-daily snapshot column written by the
 * scheduler for change-detection/audit purposes (see middleware/scheduler.ts) — the
 * read path must always compute status from transactions/freezes/plan-activation,
 * never read that column directly, or callers silently drift out of sync with it
 * (this is what made the dashboard and messenger undercount "Active" clients against
 * the clients page, which already computed live).
 *
 * Results are kept briefly per client (see clientStatusCache.ts) so repeated refetches and polls of
 * big lists do not recompute everything; every write that can change a status clears them.
 * Pass `fresh: true` to bypass the cache entirely (the nightly snapshot sync does).
 */
export async function computeStatusesForClients(
    workspaceId: string,
    clients: { id: string; archived_at: Date | null }[],
    { fresh = false }: { fresh?: boolean } = {},
): Promise<Record<string, string>> {
    if (clients.length === 0) return {};

    const baseStatuses: Record<string, string> = {};
    const missingIds: string[] = [];
    const epochAtStart = clientStatusCache.epoch;

    for (const client of clients) {
        const cached = fresh ? undefined : clientStatusCache.get(clientStatusKey(workspaceId, client.id));
        if (cached !== undefined) baseStatuses[client.id] = cached;
        else missingIds.push(client.id);
    }

    if (missingIds.length > 0) {
        const computed = await computeBaseStatuses(workspaceId, missingIds);
        for (const clientId of missingIds) {
            baseStatuses[clientId] = computed[clientId];
            if (!fresh) clientStatusCache.set(clientStatusKey(workspaceId, clientId), computed[clientId], epochAtStart);
        }
    }

    const statuses: Record<string, string> = {};
    for (const client of clients) {
        statuses[client.id] = client.archived_at ? 'Archived' : baseStatuses[client.id];
    }
    return statuses;
}
