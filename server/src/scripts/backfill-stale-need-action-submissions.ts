/**
 * Corrects form_requests that are still showing as "Need Action" in the
 * Plans Queue even though the coach already acted on them -- evidenced by
 * the client now having an active plan of the matching type (nutrition-plan
 * submission -> an active nutrition_plans row; workout-plan submission -> an
 * active training_plans row). The coach built and activated the plan; the
 * submission just never got marked reviewed (this is the historical/backfill
 * counterpart to the half-finished auto-review feature sitting uncommitted
 * in planEngine.ts -- see that file's ActivateSinglePlanResult work).
 *
 * For each matching form_requests row (status='submitted', post_action in
 * ('nutrition-plan','workout-plan')): finds the EARLIEST activated_at among
 * the client's plans of the matching type ("their first plan activated" --
 * not necessarily the currently-active one, since a client may have had
 * multiple plans of that type over time). Sets status='reviewed' and
 * action_taken_at to that timestamp.
 *
 * Sanity check: an activation that happened BEFORE the submission was itself
 * submitted doesn't fit the "coach reviewed this submission and built the
 * plan" narrative (the plan would have to have been built without seeing the
 * submission). Those are reported separately and NOT auto-corrected --
 * flagged for manual review instead of guessing.
 *
 * Corrective only, idempotent (only touches status='submitted' rows).
 * Platform-wide (reports a per-workspace breakdown so scope is visible
 * before running live, same pattern as the exercise_library fix).
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-stale-need-action-submissions.ts
 *   DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-stale-need-action-submissions.ts
 */

import { Pool } from 'pg';

const NEW_URL = process.env.DATABASE_URL;
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-stale-need-action] ${msg}`); }

async function main() {
  console.time('backfill-stale-need-action');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: candidates } = await db.query<{
      request_id: string; client_id: string; workspace_id: string; workspace_name: string;
      post_action: string; submitted_at: string | null; first_activated_at: string;
    }>(`
      SELECT fr.id AS request_id, fr.client_id, fr.workspace_id, w.name AS workspace_name,
             fr.post_action, fr.submitted_at,
             CASE
               WHEN fr.post_action = 'nutrition-plan' THEN
                 (SELECT MIN(np.activated_at) FROM nutrition_plans np WHERE np.client_id = fr.client_id AND np.activated_at IS NOT NULL)
               WHEN fr.post_action = 'workout-plan' THEN
                 (SELECT MIN(tp.activated_at) FROM training_plans tp WHERE tp.client_id = fr.client_id AND tp.activated_at IS NOT NULL)
             END AS first_activated_at
      FROM form_requests fr
      JOIN workspaces w ON w.id = fr.workspace_id
      WHERE fr.status = 'submitted'
        AND fr.post_action IN ('nutrition-plan', 'workout-plan')
    `);

    const withActivation = candidates.filter(c => c.first_activated_at != null);
    log(`form_requests still 'submitted' with post_action nutrition/workout-plan: ${candidates.length}`);
    log(`of those, client has an activated plan of the matching type: ${withActivation.length}`);

    const sane = withActivation.filter(c => !c.submitted_at || new Date(c.first_activated_at) >= new Date(c.submitted_at));
    const suspicious = withActivation.filter(c => c.submitted_at && new Date(c.first_activated_at) < new Date(c.submitted_at));

    log(`sane (plan activated at/after submission — will be corrected): ${sane.length}`);
    log(`suspicious (plan activated BEFORE submission — skipped, flagged for review): ${suspicious.length}`);
    for (const s of suspicious.slice(0, 20)) {
      log(`  - request ${s.request_id} (client ${s.client_id}, ${s.workspace_name}): submitted ${s.submitted_at}, first activation ${s.first_activated_at}`);
    }

    const byWorkspace = new Map<string, number>();
    for (const c of sane) byWorkspace.set(c.workspace_name, (byWorkspace.get(c.workspace_name) ?? 0) + 1);
    for (const [ws, count] of [...byWorkspace.entries()].sort((a, b) => b[1] - a[1])) {
      log(`  - ${ws}: ${count}`);
    }

    if (sane.length > 0 && !DRY_RUN) {
      for (const c of sane) {
        await db.query(`
          UPDATE form_requests SET status = 'reviewed', action_taken_at = $1
          WHERE id = $2 AND status = 'submitted'
        `, [c.first_activated_at, c.request_id]);
      }
      log(`corrected ${sane.length} row(s): status -> reviewed, action_taken_at -> first plan activation`);
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-stale-need-action] FAILED:', err);
    process.exit(1);
  } finally {
    await db.end();
    console.timeEnd('backfill-stale-need-action');
  }
}

main();
