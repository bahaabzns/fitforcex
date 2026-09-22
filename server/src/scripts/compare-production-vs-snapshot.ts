/**
 * Read-only, no-writes comparison between production (fitforce.app) and the
 * fitforce.io snapshot dated 2026-07-15 (the freshest available). For every
 * migrated entity type, reports: old count, new count, and how many old ids
 * are still missing from production — a comprehensive health check beyond
 * what any single backfill script covers on its own.
 *
 * Usage (from server/):
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/compare-production-vs-snapshot.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

type Check = {
  label: string;
  oldTable: string;
  oldWhere: string;
  newTable: string;
};

const checks: Check[] = [
  { label: 'workspaces',             oldTable: '"Workspace"',              oldWhere: '"deletedAt" IS NULL',                          newTable: 'workspaces' },
  { label: 'users',                  oldTable: '"User"',                   oldWhere: '"deletedAt" IS NULL',                          newTable: 'users' },
  { label: 'workspace_members',      oldTable: '"WorkspaceMember"',        oldWhere: '"deletedAt" IS NULL',                          newTable: 'workspace_members' },
  { label: 'clients',                oldTable: '"Client"',                 oldWhere: '"deletedAt" IS NULL',                          newTable: 'clients' },
  { label: 'client_observations',    oldTable: '"ClientObservation"',      oldWhere: '"deletedAt" IS NULL',                          newTable: 'client_observations' },
  { label: 'forms',                  oldTable: '"FormTemplate"',           oldWhere: '"deletedAt" IS NULL',                          newTable: 'forms' },
  { label: 'form_requests',          oldTable: '"FormSubmission"',         oldWhere: '"deletedAt" IS NULL AND "clientId" IS NOT NULL AND "formId" IS NOT NULL', newTable: 'form_requests' },
  { label: 'threads',                oldTable: '"Thread"',                 oldWhere: '"deletedAt" IS NULL AND "clientId" IS NOT NULL', newTable: 'threads' },
  { label: 'messages',               oldTable: '"Message"',                oldWhere: '"deletedAt" IS NULL',                          newTable: 'messages' },
  { label: 'nutrition_plans',        oldTable: '"NutritionPlan"',          oldWhere: '"deletedAt" IS NULL',                          newTable: 'nutrition_plans' },
  { label: 'nutrition_cycles',       oldTable: '"NutritionPlanDay"',       oldWhere: '"deletedAt" IS NULL',                          newTable: 'nutrition_cycles' },
  { label: 'nutrition_meals',        oldTable: '"NutritionPlanDayItem"',   oldWhere: '"deletedAt" IS NULL',                          newTable: 'nutrition_meals' },
  { label: 'nutrition_meal_items',   oldTable: '"MealFoodItem"',           oldWhere: '"deletedAt" IS NULL',                          newTable: 'nutrition_meal_items' },
  { label: 'training_plans',         oldTable: '"WorkoutPlan"',            oldWhere: '"deletedAt" IS NULL',                          newTable: 'training_plans' },
  { label: 'training_days',          oldTable: '"WorkoutPlanDay"',         oldWhere: '"deletedAt" IS NULL',                          newTable: 'training_days' },
  { label: 'training_exercises',     oldTable: '"WorkoutPlanDayItem"',     oldWhere: '"deletedAt" IS NULL',                          newTable: 'training_exercises' },
  { label: 'training_sets',          oldTable: '"WorkoutPlanSet"',         oldWhere: '"deletedAt" IS NULL',                          newTable: 'training_sets' },
  { label: 'workout_logs',           oldTable: '"WorkoutLog"',             oldWhere: '"deletedAt" IS NULL',                          newTable: 'workout_logs' },
  { label: 'transactions',           oldTable: '"Payment"',                oldWhere: '"deletedAt" IS NULL AND "clientId" IS NOT NULL', newTable: 'transactions' },
  { label: 'food_items',             oldTable: '"FoodItem"',               oldWhere: '"deletedAt" IS NULL',                          newTable: 'food_items' },
  { label: 'exercise_library',       oldTable: '"Exercise"',               oldWhere: '"deletedAt" IS NULL',                          newTable: 'exercise_library' },
  { label: 'packages',               oldTable: '"ClientPackageTemplate"',  oldWhere: '"deletedAt" IS NULL',                          newTable: 'packages' },
  { label: 'package_variations',     oldTable: '"ClientPackage"',          oldWhere: '"deletedAt" IS NULL',                          newTable: 'package_variations' },
];

async function main() {
  console.log('label'.padEnd(20), 'old'.padStart(8), 'new'.padStart(8), 'missing_ids'.padStart(12));
  console.log('-'.repeat(52));

  for (const check of checks) {
    try {
      const { rows: oldRows } = await old.query<{ id: string }>(
        `SELECT id FROM public.${check.oldTable} WHERE ${check.oldWhere}`
      );
      const oldIds = new Set(oldRows.map(r => r.id));

      const { rows: newRows } = await db.query<{ id: string }>(`SELECT id FROM ${check.newTable}`);
      const newIds = new Set(newRows.map(r => r.id));

      const missing = [...oldIds].filter(id => !newIds.has(id)).length;

      console.log(
        check.label.padEnd(20),
        String(oldIds.size).padStart(8),
        String(newIds.size).padStart(8),
        String(missing).padStart(12),
      );
    } catch (err) {
      console.log(check.label.padEnd(20), 'ERROR:', (err as Error).message);
    }
  }
}

main()
  .catch(err => { console.error('FAILED:', err); process.exit(1); })
  .finally(async () => { await old.end(); await db.end(); });
