/**
 * Removes stale, orphaned training_days rows left behind by a superseded
 * incremental catch-up run.
 *
 * Root cause: the old .io system regenerates WorkoutPlanDay/WorkoutPlanDayItem
 * ids whenever a coach re-saves a plan there (delete-and-recreate, same
 * pattern fitforce.app's own builder uses). migrate-incremental-catchup.ts
 * only inserts .io ids that are missing from production -- it has no way to
 * know a plan's day tree was replaced in .io, so the previous catch-up run's
 * copy just sits there alongside the new one, doubling the visible day count.
 * Confirmed via analyze-duplicate-training-days.ts: 60 affected plans
 * platform-wide (56 Belghamdi, 2 Ramy Abbas, 1 Dr ZiadYamany, 1 zoldycknation),
 * all with training_plans.id still matching a LIVE .io WorkoutPlan.id --
 * meaning none of them have ever been re-saved through fitforce.app's own
 * builder (that always assigns a fresh plan id), so reconciling their whole
 * day tree against .io's CURRENT state is unambiguous.
 *
 * For each affected plan: delete every training_days row whose id is not
 * among .io's current live (non-deleted) WorkoutPlanDay ids for that plan.
 * training_exercises/training_sets/training_exercise_alternatives cascade
 * automatically (onDelete: Cascade). workout_logs.day_id is ON DELETE SET
 * NULL -- a logged session is never destroyed, only unlinked from its day
 * (day_index is a separate column, so which-day-of-the-plan context isn't
 * fully lost). Confirmed only 3 logs platform-wide reference a stale day.
 *
 * Corrective only, scoped to the exact 60 plans found by the analysis.
 * Idempotent (a plan with no stale days is a no-op).
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-duplicate-training-days.ts
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-duplicate-training-days.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-duplicate-training-days] ${msg}`); }

async function main() {
  console.time('backfill-duplicate-training-days');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: affectedPlans } = await db.query<{ plan_id: string }>(`
      SELECT DISTINCT plan_id FROM training_days
      GROUP BY plan_id
      HAVING COUNT(*) > COUNT(DISTINCT day_order)
    `);
    log(`${affectedPlans.length} plans with duplicate day_order values`);
    if (affectedPlans.length === 0) return;

    const { rows: liveOldPlans } = await old.query<{ id: string }>(`
      SELECT id FROM public."WorkoutPlan" WHERE "deletedAt" IS NULL
    `);
    const liveOldPlanIds = new Set(liveOldPlans.map(r => r.id));

    const safePlanIds = affectedPlans.map(p => p.plan_id).filter(id => liveOldPlanIds.has(id));
    const skipped = affectedPlans.length - safePlanIds.length;
    if (skipped > 0) {
      log(`SKIPPING ${skipped} plan(s) whose id no longer matches a live .io plan (already diverged via in-app edits) — needs manual review, not touched`);
    }
    log(`${safePlanIds.length} plan(s) safe to reconcile against .io's current state`);

    let totalStaleDays = 0;
    let totalLogsUnlinked = 0;
    let plansChanged = 0;

    for (const planId of safePlanIds) {
      const { rows: liveDays } = await old.query<{ id: string }>(`
        SELECT id FROM public."WorkoutPlanDay" WHERE "planId" = $1 AND "deletedAt" IS NULL
      `, [planId]);
      const liveDayIds = liveDays.map(r => r.id);

      const { rows: prodDays } = await db.query<{ id: string }>(`
        SELECT id FROM training_days WHERE plan_id = $1
      `, [planId]);

      const staleIds = prodDays.map(d => d.id).filter(id => !liveDayIds.includes(id));
      if (staleIds.length === 0) continue;

      plansChanged++;
      totalStaleDays += staleIds.length;

      const { rows: logsForPlan } = await db.query<{ count: string }>(`
        SELECT COUNT(*) AS count FROM workout_logs WHERE day_id = ANY($1::text[])
      `, [staleIds]);
      totalLogsUnlinked += Number(logsForPlan[0].count);

      if (!DRY_RUN) {
        await db.query(`DELETE FROM training_days WHERE id = ANY($1::text[])`, [staleIds]);
      }
    }

    log(`plans reconciled: ${plansChanged}`);
    log(`stale training_days ${DRY_RUN ? 'that would be' : ''} deleted: ${totalStaleDays}`);
    log(`workout_logs ${DRY_RUN ? 'that would be' : ''} unlinked (day_id -> NULL, log itself untouched): ${totalLogsUnlinked}`);
    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-duplicate-training-days] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
    console.timeEnd('backfill-duplicate-training-days');
  }
}

main();
