/**
 * Read-only investigation into duplicate training_days rows platform-wide.
 *
 * Root cause established manually for client #1475 (Belghamdi): the old .io
 * system regenerates WorkoutPlanDay/WorkoutPlanDayItem ids whenever a coach
 * re-saves a plan there (delete-and-recreate, same pattern fitforce.app's own
 * builder uses). migrate-incremental-catchup.ts only INSERTS ids missing from
 * production (see its `existingIds('training_days')` + diff-by-id logic) --
 * it never removes production rows whose .io source row was replaced. So a
 * plan edited once in .io after its first catch-up run accumulates a second,
 * stale, orphaned copy of its whole day/exercise/set tree in production,
 * silently doubling (or more) the visible day count.
 *
 * This script classifies every production plan with duplicate (plan_id,
 * day_order) pairs into:
 *   - "safe": training_plans.id still matches a live (non-deleted) .io
 *     WorkoutPlan.id -- meaning this plan has never been re-saved through
 *     fitforce.app's own builder (which always assigns a fresh plan id), so
 *     its entire day tree is still catch-up-sourced. For these, reconciling
 *     against .io's CURRENT WorkoutPlanDay set is unambiguous: any
 *     training_days row whose id isn't currently live in .io is a stale
 *     orphan from a superseded catch-up run.
 *   - "diverged": training_plans.id has no live .io match (already edited via
 *     the in-app builder at some point, or the .io plan itself was deleted)
 *     -- these need manual review, not automated reconciliation.
 *
 * No writes. Platform-wide.
 *
 * Usage (from server/):
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/analyze-duplicate-training-days.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[analyze-duplicate-training-days] ${msg}`); }

async function main() {
  try {
    const { rows: affected } = await db.query<{
      plan_id: string; workspace_id: string; workspace_name: string;
      client_id: string; client_code: string | null;
      total_days: string; distinct_day_orders: string;
    }>(`
      SELECT tp.id AS plan_id, tp.workspace_id, w.name AS workspace_name,
             tp.client_id, c.client_code,
             COUNT(td.id) AS total_days,
             COUNT(DISTINCT td.day_order) AS distinct_day_orders
      FROM training_plans tp
      JOIN workspaces w ON w.id = tp.workspace_id
      JOIN clients c ON c.id = tp.client_id
      JOIN training_days td ON td.plan_id = tp.id
      WHERE tp.id IN (
        SELECT plan_id FROM training_days GROUP BY plan_id, day_order HAVING COUNT(*) > 1
      )
      GROUP BY tp.id, tp.workspace_id, w.name, tp.client_id, c.client_code
    `);
    log(`${affected.length} plans with duplicate day_order values`);

    const { rows: liveOldPlans } = await old.query<{ id: string }>(`
      SELECT id FROM public."WorkoutPlan" WHERE "deletedAt" IS NULL
    `);
    const liveOldPlanIds = new Set(liveOldPlans.map(r => r.id));

    let safe = 0;
    let diverged = 0;
    const byWorkspaceSafe = new Map<string, number>();
    const byWorkspaceDiverged = new Map<string, number>();

    for (const plan of affected) {
      const isSafe = liveOldPlanIds.has(plan.plan_id);
      if (isSafe) {
        safe++;
        byWorkspaceSafe.set(plan.workspace_name, (byWorkspaceSafe.get(plan.workspace_name) ?? 0) + 1);
      } else {
        diverged++;
        byWorkspaceDiverged.set(plan.workspace_name, (byWorkspaceDiverged.get(plan.workspace_name) ?? 0) + 1);
      }
    }

    log(`safe (plan id still live in .io, never re-saved in-app): ${safe}`);
    for (const [ws, n] of byWorkspaceSafe) log(`  - ${ws}: ${n}`);
    log(`diverged (needs manual review): ${diverged}`);
    for (const [ws, n] of byWorkspaceDiverged) log(`  - ${ws}: ${n}`);

    if (safe > 0) {
      // Estimate how many stale (orphaned) training_days rows the "safe"
      // plans would lose if reconciled against .io's current live day set.
      const safePlanIds = affected.filter(p => liveOldPlanIds.has(p.plan_id)).map(p => p.plan_id);
      let staleDayCount = 0;
      const staleDayIds: string[] = [];
      for (const planId of safePlanIds) {
        const { rows: liveDays } = await old.query<{ id: string }>(`
          SELECT id FROM public."WorkoutPlanDay" WHERE "planId" = $1 AND "deletedAt" IS NULL
        `, [planId]);
        const liveDayIds = new Set(liveDays.map(r => r.id));

        const { rows: prodDays } = await db.query<{ id: string }>(`
          SELECT id FROM training_days WHERE plan_id = $1
        `, [planId]);

        const stale = prodDays.filter(d => !liveDayIds.has(d.id)).map(d => d.id);
        staleDayCount += stale.length;
        staleDayIds.push(...stale);
      }
      log(`stale training_days rows in "safe" plans (would be deleted on reconciliation): ${staleDayCount}`);

      if (staleDayIds.length > 0) {
        const { rows: loggedAgainstStale } = await db.query<{ count: string }>(`
          SELECT COUNT(*) AS count FROM workout_logs WHERE day_id = ANY($1::text[])
        `, [staleDayIds]);
        log(`workout_logs referencing a stale day (would have day_id set to NULL, log itself untouched): ${loggedAgainstStale[0].count}`);
      }
    }
  } catch (err) {
    console.error('[analyze-duplicate-training-days] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
  }
}

main();
