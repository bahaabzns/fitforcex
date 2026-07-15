/**
 * Corrects historical transactions affected by the same bug just fixed in
 * createTransaction: a renewal recorded after the client's previous subscription
 * period had already lapsed was silently chained onto wherever that lapsed period
 * ended, instead of starting from the actual payment date — backdating the new
 * period into a gap where the client had no real access at all.
 *
 * Walks each client's completed, duration>0 transactions in chronological order
 * (mirroring computeSubscriptionDetails in utils/subscriptionStatus.ts, including
 * freeze extensions) and, for any transaction not already pinned to a custom start
 * date, checks whether it was paid after the previous period's computed end. If so,
 * it's a late renewal — set start_mode='custom' and subscription_start_date to the
 * transaction's own date, exactly what the code fix now does automatically for new
 * transactions going forward.
 *
 * Additive/corrective only — only ever touches a transaction that isn't already
 * 'custom', and only when a genuine gap is detected. Idempotent (re-running finds
 * nothing left to fix once applied). Platform-wide, no workspace scoping.
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" npx tsx src/scripts/backfill-late-renewal-start-dates.ts
 *   DATABASE_URL="$DATABASE_URL" npx tsx src/scripts/backfill-late-renewal-start-dates.ts
 */

import { Pool } from 'pg';

const NEW_URL = process.env.DATABASE_URL;
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-late-renewal] ${msg}`); }

type Tx = {
  id: string;
  client_id: string;
  transaction_date: Date;
  duration: number | null;
  start_mode: string | null;
  subscription_start_date: Date | null;
};

type Freeze = { freeze_start_date: Date; freeze_duration_days: number };

async function main() {
  console.time('backfill-late-renewal');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: txs } = await db.query<Tx>(`
      SELECT id, client_id, transaction_date, duration, start_mode, subscription_start_date
      FROM transactions
      WHERE status = 'completed' AND duration IS NOT NULL AND duration > 0 AND client_id IS NOT NULL
      ORDER BY client_id, transaction_date ASC, created_at ASC
    `);

    const { rows: freezeRows } = await db.query<{ client_id: string } & Freeze>(`
      SELECT client_id, freeze_start_date, freeze_duration_days FROM subscription_freezes
    `);
    const freezesByClient = new Map<string, Freeze[]>();
    for (const f of freezeRows) {
      const list = freezesByClient.get(f.client_id) ?? [];
      list.push(f);
      freezesByClient.set(f.client_id, list);
    }

    // Matches getFirstPlanActivation() in transactions.controller.ts — the real
    // computeSubscriptionDetails uses this (not the transaction date) as the start
    // of the very first period when there's no prior period to chain from yet.
    const { rows: activationRows } = await db.query<{ client_id: string; first_activation: Date | null }>(`
      SELECT client_id, MIN(activated_at) AS first_activation FROM (
        SELECT client_id, activated_at FROM training_plans WHERE activated_at IS NOT NULL
        UNION ALL
        SELECT client_id, activated_at FROM nutrition_plans WHERE activated_at IS NOT NULL
      ) combined GROUP BY client_id
    `);
    const firstActivationByClient = new Map(activationRows.map(r => [r.client_id, r.first_activation]));

    const txsByClient = new Map<string, Tx[]>();
    for (const t of txs) {
      const list = txsByClient.get(t.client_id) ?? [];
      list.push(t);
      txsByClient.set(t.client_id, list);
    }

    const corrections: Array<{ id: string; newStartDate: Date }> = [];

    for (const [clientId, clientTxs] of txsByClient) {
      const freezes = freezesByClient.get(clientId) ?? [];
      const firstActivation = firstActivationByClient.get(clientId) ?? null;
      let prevEnd: Date | null = null;

      for (const tx of clientTxs) {
        const isCustom = tx.start_mode === 'custom' && tx.subscription_start_date !== null;
        let start: Date;

        if (isCustom) {
          start = new Date(tx.subscription_start_date!);
        } else if (prevEnd !== null && tx.transaction_date <= prevEnd) {
          // Paid on time (while still covered) — correctly chains from prevEnd, no gap.
          start = new Date(prevEnd);
        } else if (prevEnd !== null) {
          // Paid after the previous period already ended — a real gap. This is the bug.
          corrections.push({ id: tx.id, newStartDate: tx.transaction_date });
          start = new Date(tx.transaction_date);
        } else if (firstActivation) {
          // First real period — matches computeSubscriptionDetails exactly: starts
          // from first-plan-activation, not the transaction date.
          start = new Date(firstActivation);
        } else {
          start = new Date(tx.transaction_date);
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
        prevEnd = new Date(endMs);
      }
    }

    log(`transactions: ${txs.length} total (completed, duration>0), ${corrections.length} late-renewal gap(s) found`);
    if (DRY_RUN || corrections.length === 0) return;

    let updated = 0;
    for (const c of corrections) {
      const result = await db.query(`
        UPDATE transactions SET start_mode = 'custom', subscription_start_date = $1
        WHERE id = $2
      `, [c.newStartDate, c.id]);
      updated += result.rowCount ?? 0;
    }
    log(`transactions: corrected ${updated} row(s)`);
  } catch (err) {
    console.error('[backfill-late-renewal] FAILED:', err);
    process.exit(1);
  } finally {
    await db.end();
    console.timeEnd('backfill-late-renewal');
  }
}

main();
