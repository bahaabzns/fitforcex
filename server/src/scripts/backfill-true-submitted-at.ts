/**
 * Corrects form_requests.submitted_at using the old system's "form_submitted"
 * Notification events, which record the true, immutable moment a client
 * submitted — unlike FormSubmission.updatedAt, which gets overwritten by any
 * later touch (e.g. a coach bulk-reviewing/archiving dozens of submissions at
 * once, which is exactly what earlier backfills picked up as "submitted_at").
 *
 * Confirmed real: belghamdi had clusters of 24-81 form_requests all sharing
 * one exact minute for submitted_at, which is impossible for genuine client
 * behavior. Cross-checking those same submissions against Notification rows
 * (type='form_submitted', data->>'submissionId' = the submission's id) showed
 * their true submission dates were months earlier and properly staggered.
 *
 * Old system schema: Notification has no dedicated FK column to FormSubmission
 * — the link lives inside the jsonb `data` column as `submissionId`. Multiple
 * Notification rows can share one submissionId (one per recipient), so this
 * takes MIN(createdAt) per submission as the canonical event time.
 *
 * Only corrects rows where a real notification exists (~61% coverage in
 * belghamdi; the rest keep whatever they already have — no notification means
 * no better data available, not corrected to something worse).
 * Converts via AT TIME ZONE 'Africa/Cairo' at the SQL source, same as every
 * other timestamp fix this session — never relies on Node's ambient timezone.
 *
 * Additive/corrective only, idempotent. Platform-wide.
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-true-submitted-at.ts
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-true-submitted-at.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-true-submitted] ${msg}`); }

async function main() {
  console.time('backfill-true-submitted');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows } = await old.query<{ submission_id: string; true_submitted_at: string }>(`
      SELECT data->>'submissionId' AS submission_id,
             MIN("createdAt") AT TIME ZONE 'Africa/Cairo' AS true_submitted_at
      FROM "Notification"
      WHERE type = 'form_submitted' AND data->>'submissionId' IS NOT NULL
      GROUP BY data->>'submissionId'
    `);
    log(`notifications: ${rows.length} distinct submissions with a real submitted event`);
    if (rows.length === 0) return;

    const client = await db.connect();
    try {
      await client.query(`DROP TABLE IF EXISTS true_submitted_at_tmp`);
      await client.query(`CREATE TEMP TABLE true_submitted_at_tmp (id text, true_submitted_at timestamp)`);

      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values: unknown[] = [];
        const placeholders = batch.map((r, j) => {
          values.push(r.submission_id, r.true_submitted_at);
          return `($${j * 2 + 1},$${j * 2 + 2})`;
        });
        await client.query(
          `INSERT INTO true_submitted_at_tmp (id, true_submitted_at) VALUES ${placeholders.join(',')}`,
          values,
        );
      }

      const { rows: mismatches } = await client.query<{ id: string }>(`
        SELECT fr.id FROM form_requests fr
        JOIN true_submitted_at_tmp t ON t.id = fr.id
        WHERE (fr.submitted_at AT TIME ZONE 'UTC') IS DISTINCT FROM (t.true_submitted_at AT TIME ZONE 'Africa/Cairo')
      `);
      log(`form_requests: ${mismatches.length} row(s) need correction`);
      if (mismatches.length === 0 || DRY_RUN) return;

      const result = await client.query(`
        UPDATE form_requests fr
        SET submitted_at = (t.true_submitted_at AT TIME ZONE 'Africa/Cairo')
        FROM true_submitted_at_tmp t
        WHERE t.id = fr.id
          AND (fr.submitted_at AT TIME ZONE 'UTC') IS DISTINCT FROM (t.true_submitted_at AT TIME ZONE 'Africa/Cairo')
      `);
      log(`form_requests: corrected ${result.rowCount} row(s)`);
    } finally {
      client.release();
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-true-submitted] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
    console.timeEnd('backfill-true-submitted');
  }
}

main();
