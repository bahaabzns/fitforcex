/**
 * Corrects form_requests.status, platform-wide.
 *
 * The old system's real status vocabulary (confirmed via direct DB introspection)
 * is: pending, submitted, todo, archived — there is no 'reviewed'/'done'/'completed'/
 * 'action_taken' value. Every past migration script assumed otherwise:
 *   - migrate-queue.ts's mapStatus() collapsed a made-up 'done'/'reviewed'/'completed'/
 *     'action_taken' set into a new-system value the UI never checks for.
 *   - clone-workspace-from-snapshot.ts copied the raw old string through unmapped.
 * Neither path could ever produce the new-system 'reviewed' status, so the "Action
 * Done" bucket in the Plans Queue has always read 0, platform-wide, even though the
 * old system has thousands of genuinely completed submissions (status = 'archived').
 *
 * Confirmed mapping (product-owner confirmed, not guessed):
 *   archived  -> reviewed    (coach completed their review / built the plan)
 *   todo      -> submitted   (same "needs action" stage as 'submitted', different label)
 *   submitted -> submitted
 *   pending   -> pending
 *
 * Also backfills submitted_at (old updatedAt, Cairo-corrected) for any row that ends
 * up submitted/reviewed but has none — the same missing-data-not-just-wrong-status gap,
 * since past scripts only ever set submitted_at when old status was exactly 'submitted'.
 * And backfills action_taken_at for reviewed rows the same way.
 *
 * Finally, corrects status to 'scheduled' for any request whose scheduled_at is still
 * in the future — the old system never had a distinct "scheduled" status value, only
 * a scheduleAt timestamp alongside status='pending', so the mapping above alone would
 * leave a genuinely future-dated request looking identical to a plain pending one.
 *
 * Additive only, idempotent, safe to re-run.
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-form-request-status.ts
 *
 *   PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-form-request-status.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-status] ${msg}`); }

function mapStatus(oldStatus: string): string {
  if (oldStatus === 'archived') return 'reviewed';
  if (oldStatus === 'todo') return 'submitted';
  if (oldStatus === 'submitted') return 'submitted';
  return 'pending';
}

async function main() {
  console.time('backfill-status');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows } = await old.query<{ id: string; status: string; updatedAt: string }>(`
      SELECT id, status, "updatedAt" AT TIME ZONE 'Africa/Cairo' AS "updatedAt"
      FROM public."FormSubmission"
    `);
    if (rows.length === 0) { log('no old rows, exiting'); return; }

    const client = await newDb.connect();
    try {
      await client.query(`DROP TABLE IF EXISTS backfill_status`);
      await client.query(`
        CREATE TEMP TABLE backfill_status (id text, new_status text, updated_at timestamp)
      `);

      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values: unknown[] = [];
        const placeholders = batch.map((r, j) => {
          values.push(r.id, mapStatus(r.status), r.updatedAt);
          return `($${j * 3 + 1},$${j * 3 + 2},$${j * 3 + 3})`;
        });
        await client.query(
          `INSERT INTO backfill_status (id, new_status, updated_at) VALUES ${placeholders.join(',')}`,
          values,
        );
      }

      const { rows: statusMismatches } = await client.query<{ id: string }>(`
        SELECT fr.id FROM form_requests fr
        JOIN backfill_status o ON o.id = fr.id
        WHERE fr.status IS DISTINCT FROM o.new_status
      `);
      log(`status: ${statusMismatches.length} row(s) need correction`);
      if (statusMismatches.length > 0 && !DRY_RUN) {
        const result = await client.query(`
          UPDATE form_requests fr SET status = o.new_status
          FROM backfill_status o
          WHERE o.id = fr.id AND fr.status IS DISTINCT FROM o.new_status
        `);
        log(`status: corrected ${result.rowCount} row(s)`);
      }

      const { rows: submittedAtMissing } = await client.query<{ id: string }>(`
        SELECT fr.id FROM form_requests fr
        JOIN backfill_status o ON o.id = fr.id
        WHERE o.new_status IN ('submitted', 'reviewed') AND fr.submitted_at IS NULL
      `);
      log(`submitted_at: ${submittedAtMissing.length} row(s) missing`);
      if (submittedAtMissing.length > 0 && !DRY_RUN) {
        const result = await client.query(`
          UPDATE form_requests fr SET submitted_at = o.updated_at
          FROM backfill_status o
          WHERE o.id = fr.id AND o.new_status IN ('submitted', 'reviewed') AND fr.submitted_at IS NULL
        `);
        log(`submitted_at: backfilled ${result.rowCount} row(s)`);
      }

      const { rows: actionTakenMissing } = await client.query<{ id: string }>(`
        SELECT fr.id FROM form_requests fr
        JOIN backfill_status o ON o.id = fr.id
        WHERE o.new_status = 'reviewed' AND fr.action_taken_at IS NULL
      `);
      log(`action_taken_at: ${actionTakenMissing.length} row(s) missing`);
      if (actionTakenMissing.length > 0 && !DRY_RUN) {
        const result = await client.query(`
          UPDATE form_requests fr SET action_taken_at = o.updated_at
          FROM backfill_status o
          WHERE o.id = fr.id AND o.new_status = 'reviewed' AND fr.action_taken_at IS NULL
        `);
        log(`action_taken_at: backfilled ${result.rowCount} row(s)`);
      }
    } finally {
      client.release();
    }

    // Old status never distinguished "scheduled for a future date" from plain
    // pending — the old system just left status='pending' and relied on scheduleAt
    // alone. Any request whose scheduled_at is still in the future needs status
    // corrected to 'scheduled' so the queue's Scheduled bucket reflects it; the
    // app's own activateDueScheduledRequests() will flip it back to pending once
    // that date arrives, same as it does for requests created directly in-app.
    const { rows: futureScheduled } = await newDb.query<{ id: string }>(`
      SELECT id FROM form_requests
      WHERE status = 'pending' AND scheduled_at IS NOT NULL AND scheduled_at > NOW()
    `);
    log(`future-scheduled: ${futureScheduled.length} row(s) need status = 'scheduled'`);
    if (futureScheduled.length > 0 && !DRY_RUN) {
      const result = await newDb.query(`
        UPDATE form_requests SET status = 'scheduled'
        WHERE status = 'pending' AND scheduled_at IS NOT NULL AND scheduled_at > NOW()
      `);
      log(`future-scheduled: corrected ${result.rowCount} row(s)`);
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-status] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await newDb.end();
    console.timeEnd('backfill-status');
  }
}

main();
