/**
 * Corrects form_requests wrongly marked 'submitted' by a bug in
 * backfill-form-request-status.ts: its mapStatus() mapped old .io status
 * 'todo' -> new 'submitted', but 'todo' means "assigned to the client, not
 * yet done" (0% of 'todo' rows have real answers platform-wide, identical to
 * 'pending' at 0%, vs ~99.5-99.8% for 'submitted'/'archived'). Confirmed via
 * two belghamdi clients reporting forms shown as submitted with empty
 * answers -- the app faithfully shows form_requests.status, which was wrong.
 *
 * Scope, deliberately narrow (per explicit direction, not a blanket fix):
 *   - form_type = 'assessment' only (the onboarding forms new clients get,
 *     matching the exact reported pattern) -- NOT check-in/nutrition/workout
 *     forms, which need separate investigation if they show the same symptom.
 *   - client has NEVER had an activated plan (no training_plans or
 *     nutrition_plans row with activated_at set) -- i.e. still in onboarding,
 *     not an established client with unrelated history.
 *   - status = 'submitted' only, never 'reviewed'. 3452 rows were also
 *     mismapped from 'todo' but a coach has since marked them 'reviewed' in
 *     the app (almost certainly via a bulk-review action, believing they
 *     were real submissions) -- those are deliberately left untouched here;
 *     reverting a coach's real action needs an explicit separate decision.
 *
 * For matching rows: status -> 'pending', submitted_at -> NULL (it was set
 * from the old FormSubmission.updatedAt, which reflects a status-change
 * timestamp that never should have implied a real submission).
 * requested_at is left as-is (the form genuinely was requested/assigned).
 *
 * Corrective only, scoped, idempotent (a row already 'pending' is a no-op).
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-form-status-mismap.ts
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-form-status-mismap.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-form-status-mismap] ${msg}`); }

async function main() {
  console.time('backfill-form-status-mismap');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: todoRows } = await old.query<{ id: string }>(`
      SELECT id FROM public."FormSubmission" WHERE status = 'todo' AND "deletedAt" IS NULL
    `);
    const todoIds = todoRows.map(r => r.id);
    log(`old .io 'todo' rows: ${todoIds.length}`);

    const { rows: matches } = await db.query<{ id: string }>(`
      SELECT fr.id
      FROM form_requests fr
      JOIN forms f ON f.id = fr.form_id
      WHERE fr.id = ANY($1::text[])
        AND fr.status = 'submitted'
        AND f.form_type = 'assessment'
        AND NOT EXISTS (SELECT 1 FROM training_plans tp WHERE tp.client_id = fr.client_id AND tp.activated_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM nutrition_plans np WHERE np.client_id = fr.client_id AND np.activated_at IS NOT NULL)
    `, [todoIds]);
    log(`in scope (assessment form, never-activated client, still 'submitted'): ${matches.length}`);
    if (matches.length === 0 || DRY_RUN) return;

    const ids = matches.map(m => m.id);
    const result = await db.query(`
      UPDATE form_requests SET status = 'pending', submitted_at = NULL
      WHERE id = ANY($1::text[])
    `, [ids]);
    log(`corrected ${result.rowCount} row(s): status -> pending, submitted_at -> NULL`);

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-form-status-mismap] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
    console.timeEnd('backfill-form-status-mismap');
  }
}

main();
