/**
 * Corrects form_requests rows stuck at post_action='nothing' ("No Action" in
 * Plans Queue) even though the form they belong to is currently configured
 * with a real after-submission action ('nutrition-plan' / 'workout-plan').
 *
 * Root cause: plan activation and restart wire a client's recurring
 * check-in forms into form_requests via four insert sites (planEngine's
 * reconcileCheckInSchedules, training.controller.ts / nutrition.controller.ts
 * activatePlan, and the legacy scheduler.ts dispatch fallback) that omitted
 * post_action from the INSERT, so it silently fell back to the column
 * default instead of copying forms.post_action the way the manual
 * "assign form to client" flow (forms.controller.ts createRequests) already
 * did. Fixed in code alongside this script; this backfills the rows that
 * were already created wrong.
 *
 * Deliberately narrower than a blanket "resync from the form" backfill:
 * only touches rows where the REQUEST never got a real action stamped
 * (post_action = 'nothing') while the form's CURRENT setting is a real
 * action. A row whose post_action legitimately differs from the form's
 * current value (the coach changed the form's action after older requests
 * were already correctly stamped with the prior value) is left alone --
 * form_requests.post_action is intentionally a point-in-time copy, not a
 * live mirror of forms.post_action (see forms.controller.ts's own comment
 * on this design).
 *
 * Additive only (UPDATE, no deletes), idempotent, safe to re-run.
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-checkin-form-post-action.ts
 *   DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-checkin-form-post-action.ts
 */

import { Pool } from 'pg';

const NEW_URL = process.env.DATABASE_URL;
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-checkin-post-action] ${msg}`); }

async function main() {
  console.time('backfill-checkin-post-action');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: candidates } = await db.query<{
      request_id: string; workspace_id: string; workspace_name: string;
      status: string; form_id: string; form_title: string; form_post_action: string;
    }>(`
      SELECT fr.id AS request_id, fr.workspace_id, w.name AS workspace_name,
             fr.status, f.id AS form_id, f.title_en AS form_title, f.post_action AS form_post_action
      FROM form_requests fr
      JOIN forms f ON f.id = fr.form_id
      JOIN workspaces w ON w.id = fr.workspace_id
      WHERE fr.post_action = 'nothing'
        AND f.post_action <> 'nothing'
        AND fr.archived_at IS NULL
    `);

    log(`form_requests stuck at 'nothing' while their form now has a real action: ${candidates.length}`);

    const byStatus = new Map<string, number>();
    for (const c of candidates) byStatus.set(c.status, (byStatus.get(c.status) ?? 0) + 1);
    for (const [status, count] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
      log(`  status='${status}': ${count}`);
    }

    const byWorkspace = new Map<string, number>();
    for (const c of candidates) byWorkspace.set(c.workspace_name, (byWorkspace.get(c.workspace_name) ?? 0) + 1);
    for (const [ws, count] of [...byWorkspace.entries()].sort((a, b) => b[1] - a[1])) {
      log(`  - ${ws}: ${count}`);
    }

    if (candidates.length > 0 && !DRY_RUN) {
      const result = await db.query(`
        UPDATE form_requests fr SET post_action = f.post_action
        FROM forms f
        WHERE f.id = fr.form_id
          AND fr.post_action = 'nothing'
          AND f.post_action <> 'nothing'
          AND fr.archived_at IS NULL
      `);
      log(`corrected ${result.rowCount} row(s): post_action -> the form's current action`);
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-checkin-post-action] FAILED:', err);
    process.exit(1);
  } finally {
    await db.end();
    console.timeEnd('backfill-checkin-post-action');
  }
}

main();
