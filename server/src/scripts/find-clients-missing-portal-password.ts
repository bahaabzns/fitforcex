/**
 * Read-only diagnostic. Lists clients platform-wide who have an Active or Frozen
 * subscription (per the same computeSubscriptionDetails logic the app uses) but
 * clients.password IS NULL — meaning they can never pass client-portal login
 * ("Account not activated. Contact your coach.", clientPortal.controller.ts) even
 * though their subscription is fully paid and running. Password is only ever set
 * manually by the coach (at client creation or via the set-password endpoint) —
 * it has no automatic link to subscription/transaction state, so this gap is
 * silent until a client actually tries to log in.
 *
 * Makes no writes. Safe to run against production with a read replica or the
 * primary — it only SELECTs.
 *
 * Usage (from server/, picks up DATABASE_URL from the local .env automatically):
 *   npx tsx src/scripts/find-clients-missing-portal-password.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

type SubscriptionStatus = 'No Subscriptions' | 'Pre-start' | 'Active' | 'Expired' | 'Frozen';

type TxRow = {
    client_id:                string;
    status:                   string;
    duration:                 number | string | null;
    start_mode:                string | null;
    subscription_start_date:  string | Date | null;
    created_at:               string | Date;
};

type FreezeRow = {
    client_id:            string;
    freeze_start_date:    string | Date;
    freeze_duration_days: number | string;
};

// Mirrors computeSubscriptionDetails in ../utils/subscriptionStatus.ts exactly —
// duplicated instead of imported so this script has zero dependency on
// config/env.ts (which requireEnv()'s JWT_SECRET/DB_*/etc. this script has no use
// for and shouldn't need just to run a SELECT against production).
function computeStatus(
    allTransactions:         TxRow[],
    freezes:                 FreezeRow[],
    firstPlanActivationDate: Date | string | null
): SubscriptionStatus {
    if (allTransactions.length === 0) return 'No Subscriptions';

    const completed = allTransactions
        .filter(t => t.status === 'completed' && t.duration && Number(t.duration) > 0)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (completed.length === 0) return 'Pre-start';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let prevEnd: Date | null = null;
    const periods: Array<{ start: Date; end: Date }> = [];

    for (const tx of completed) {
        let start: Date;
        const mode = tx.start_mode || 'on_first_plan';

        if (mode === 'custom' && tx.subscription_start_date) {
            start = new Date(tx.subscription_start_date);
        } else if (prevEnd !== null) {
            start = new Date(prevEnd);
        } else if (firstPlanActivationDate) {
            start = new Date(firstPlanActivationDate);
        } else {
            return 'Pre-start';
        }

        start.setHours(0, 0, 0, 0);
        let endMs = start.getTime() + Number(tx.duration) * 86400000;

        for (const freeze of freezes) {
            const fs = new Date(freeze.freeze_start_date);
            fs.setHours(0, 0, 0, 0);
            if (fs >= start && fs.getTime() < endMs) {
                endMs += Number(freeze.freeze_duration_days) * 86400000;
            }
        }

        periods.push({ start, end: new Date(endMs) });
        prevEnd = new Date(endMs);
    }

    if (periods.length === 0) return 'Pre-start';

    for (const { start, end } of periods) {
        if (today < start) return 'Pre-start';
        if (today >= start && today < end) {
            for (const freeze of freezes) {
                const fs = new Date(freeze.freeze_start_date);
                fs.setHours(0, 0, 0, 0);
                const fe = new Date(fs.getTime() + Number(freeze.freeze_duration_days) * 86400000);
                if (today >= fs && today < fe) return 'Frozen';
            }
            return 'Active';
        }
    }

    return 'Expired';
}

async function main() {
    const { rows: candidates } = await pool.query<{
        id: string; client_code: number; fname: string; lname: string; email: string;
        workspace_slug: string; workspace_name: string;
    }>(`
        SELECT c.id, c.client_code, c.fname, c.lname, c.email,
               w.slug AS workspace_slug, w.name AS workspace_name
        FROM clients c
        JOIN workspaces w ON w.id = c.workspace_id
        WHERE c.password IS NULL AND c.archived_at IS NULL AND w.archived_at IS NULL
    `);

    if (candidates.length === 0) {
        console.log('No clients without a portal password found.');
        await pool.end();
        return;
    }

    const clientIds = candidates.map(c => c.id);

    const [txRes, freezeRes, planRes] = await Promise.all([
        pool.query<TxRow>(
            `SELECT client_id, status, duration, start_mode, subscription_start_date, created_at
             FROM transactions WHERE client_id = ANY($1)`,
            [clientIds]
        ),
        pool.query<FreezeRow>(
            `SELECT client_id, freeze_start_date, freeze_duration_days
             FROM subscription_freezes WHERE client_id = ANY($1)`,
            [clientIds]
        ),
        pool.query<{ client_id: string; first_activation: Date | null }>(
            `SELECT client_id, MIN(activated_at) AS first_activation FROM (
                 SELECT client_id, activated_at FROM training_plans
                 WHERE client_id = ANY($1) AND activated_at IS NOT NULL
                 UNION ALL
                 SELECT client_id, activated_at FROM nutrition_plans
                 WHERE client_id = ANY($1) AND activated_at IS NOT NULL
             ) x GROUP BY client_id`,
            [clientIds]
        ),
    ]);

    const txByClient: Record<string, TxRow[]> = {};
    for (const tx of txRes.rows) (txByClient[tx.client_id] ??= []).push(tx);

    const freezesByClient: Record<string, FreezeRow[]> = {};
    for (const f of freezeRes.rows) (freezesByClient[f.client_id] ??= []).push(f);

    const planActivationByClient: Record<string, string | null> = {};
    for (const row of planRes.rows) {
        planActivationByClient[row.client_id] = row.first_activation
            ? new Date(row.first_activation).toISOString()
            : null;
    }

    const affected = candidates
        .map(c => ({
            ...c,
            status: computeStatus(
                txByClient[c.id] || [],
                freezesByClient[c.id] || [],
                planActivationByClient[c.id] ?? null
            ),
        }))
        .filter(c => c.status === 'Active' || c.status === 'Frozen')
        .sort((a, b) => a.workspace_slug.localeCompare(b.workspace_slug) || a.client_code - b.client_code);

    console.log(`Checked ${candidates.length} client(s) without a portal password across all workspaces.`);
    console.log(`${affected.length} have an Active/Frozen subscription and cannot log in:\n`);

    for (const c of affected) {
        console.log(
            `[${c.workspace_slug}] #${c.client_code} ${c.fname} ${c.lname} <${c.email || 'no email'}> — ${c.status}`
        );
    }

    await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
