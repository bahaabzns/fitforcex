/**
 * Reconstructs workspace_subscription_events rows for paid workspace_payments that
 * predate migration 075 — i.e. every payment the admin payments page currently falls
 * back to a nominal paid_at + duration_days estimate for, because no event row exists
 * to say what period it actually produced (see admin.controller.ts's getPayments).
 *
 * This is a BEST-EFFORT APPROXIMATION, not a recovered historical record — the real
 * per-payment period was never stored before now, which is exactly the gap this whole
 * feature closes going forward. What this script does:
 *
 *   For each workspace, walks its paid, non-add-on payments in chronological order
 *   (paid_at ASC) and replays the OLD "always extend forward" logic that was actually
 *   live for all of this historical data (GREATEST(payment's own paid_at, previous
 *   reconstructed end) + duration_days) — deliberately NOT the new tier-change-resets
 *   logic, since that didn't exist yet when these payments were really processed, and
 *   the goal is reconstructing what happened, not what should have happened under
 *   today's corrected rules.
 *
 * What it can't reconstruct, and doesn't try to:
 *   - Admin overrides (updateWorkspaceSubscription, resyncSubscriptionPrice, or a
 *     resyncSubscription edit) that happened between two payments — these leave no
 *     trace in workspace_payments, so the chain can only assume nothing intervened.
 *     Where a workspace's reconstructed final date doesn't match its CURRENT
 *     workspace_subscriptions.expires_at, that's exactly this kind of gap — logged
 *     as a warning, not corrected (this script never writes to workspace_subscriptions,
 *     only inserts into workspace_subscription_events).
 *   - Add-on purchases (payment.addon_id set) — skipped entirely. Their real math
 *     (applyAddonPurchase's prepaid-balance rebasing) depends on the subscription's
 *     exact price/expiry at the moment each one was applied, which is the same
 *     missing-history problem one level deeper; approximating it as a flat extension
 *     would be a different, less honest kind of guess than the fallback the payments
 *     page already shows for these rows. They keep the nominal fallback.
 *   - Admin manual payments with a backdated/scheduled `startDate` different from the
 *     payment's own `paid_at` — indistinguishable from a normal payment in
 *     workspace_payments alone, so replayed the same as everything else.
 *
 * Every inserted row is marked is_backfilled = true so it's never confused with a
 * real, live-recorded event.
 *
 * Idempotent — skips any payment that already has an event row (real or backfilled),
 * so safe to re-run.
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" npx tsx src/scripts/backfill-workspace-subscription-events.ts
 *   DATABASE_URL="$DATABASE_URL" npx tsx src/scripts/backfill-workspace-subscription-events.ts
 */

import { createId } from '@paralleldrive/cuid2';
import { Pool } from 'pg';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const db = new Pool({ connectionString: DB_URL });

function log(msg: string) { console.log(`[backfill-subscription-events] ${msg}`); }

type Payment = {
    id: string;
    workspace_id: string;
    plan_id: string;
    variation_id: string | null;
    amount: string;
    currency: string;
    duration_days: number;
    paid_at: Date;
};

async function main() {
    console.time('backfill-subscription-events');
    log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

    try {
        const { rows: payments } = await db.query<Payment>(`
            SELECT wp.id, wp.workspace_id, wp.plan_id, wp.variation_id, wp.amount, wp.currency, wp.duration_days, wp.paid_at
            FROM workspace_payments wp
            WHERE wp.fawaterak_status = 'paid' AND wp.paid_at IS NOT NULL AND wp.addon_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM workspace_subscription_events e WHERE e.payment_id = wp.id)
            ORDER BY wp.workspace_id, wp.paid_at ASC
        `);

        const { rows: currentSubs } = await db.query<{ workspace_id: string; expires_at: Date | null }>(`
            SELECT workspace_id, expires_at FROM workspace_subscriptions
        `);
        const currentExpiryByWorkspace = new Map(currentSubs.map(s => [s.workspace_id, s.expires_at]));

        const paymentsByWorkspace = new Map<string, Payment[]>();
        for (const p of payments) {
            const list = paymentsByWorkspace.get(p.workspace_id) ?? [];
            list.push(p);
            paymentsByWorkspace.set(p.workspace_id, list);
        }

        log(`payments: ${payments.length} paid, non-addon, missing an event row, across ${paymentsByWorkspace.size} workspace(s)`);

        type Insert = {
            paymentId: string; workspaceId: string; planId: string; variationId: string | null;
            amount: string; currency: string; startsAt: Date; expiresAt: Date; previousExpiresAt: Date | null;
        };
        const inserts: Insert[] = [];
        let mismatchCount = 0;

        for (const [workspaceId, workspacePayments] of paymentsByWorkspace) {
            let runningEnd: Date | null = null;
            for (const p of workspacePayments) {
                const paidAt = new Date(p.paid_at);
                const start = runningEnd && runningEnd.getTime() > paidAt.getTime() ? runningEnd : paidAt;
                const end = new Date(start.getTime() + Number(p.duration_days) * 86400000);
                inserts.push({
                    paymentId: p.id, workspaceId, planId: p.plan_id, variationId: p.variation_id,
                    amount: p.amount, currency: p.currency,
                    startsAt: start, expiresAt: end, previousExpiresAt: runningEnd,
                });
                runningEnd = end;
            }

            const currentExpiry = currentExpiryByWorkspace.get(workspaceId);
            if (currentExpiry && runningEnd && Math.abs(currentExpiry.getTime() - runningEnd.getTime()) > 86400000) {
                mismatchCount++;
                log(`⚠ workspace ${workspaceId}: reconstructed chain ends ${runningEnd.toISOString().slice(0, 10)}, ` +
                    `current expires_at is ${currentExpiry.toISOString().slice(0, 10)} — likely an admin override happened ` +
                    `in between that this script can't see. Backfilled anyway (approximate, marked as such).`);
            }
        }

        log(`reconstructed: ${inserts.length} event(s) to insert (${mismatchCount} workspace(s) diverge from current state)`);
        if (DRY_RUN || inserts.length === 0) return;

        let written = 0;
        for (const ins of inserts) {
            const result = await db.query(`
                INSERT INTO workspace_subscription_events
                    (id, workspace_id, payment_id, event_type, plan_id, variation_id, locked_price_monthly,
                     locked_currency, starts_at, expires_at, previous_expires_at, actor_type, actor_label, is_backfilled)
                VALUES ($1, $2, $3, 'backfilled_estimate', $4, $5, $6, $7, $8, $9, $10, 'system', 'backfill-script', true)
                ON CONFLICT DO NOTHING
            `, [
                createId(), ins.workspaceId, ins.paymentId, ins.planId, ins.variationId,
                ins.amount, ins.currency, ins.startsAt, ins.expiresAt, ins.previousExpiresAt,
            ]);
            written += result.rowCount ?? 0;
        }
        log(`workspace_subscription_events: inserted ${written} row(s)`);
    } catch (err) {
        console.error('[backfill-subscription-events] FAILED:', err);
        process.exit(1);
    } finally {
        await db.end();
        console.timeEnd('backfill-subscription-events');
    }
}

main();
