/**
 * Read-only analysis (no writes) of belghamdi's 145 nutrition_plans that have
 * 2 cycles instead of 1. For each plan:
 *   1. Confirms the old system genuinely had only one NutritionPlanDay for
 *      this plan (the "original" cycle's id should match it exactly).
 *   2. Identifies which of the 2 production cycles is the original (its id
 *      exists in old NutritionPlanDay) vs. the coach-created duplicate (its
 *      id doesn't exist in old data at all — created via the live app's
 *      duplicateCycle endpoint).
 *   3. Diffs the two cycles' meals (matched by meal name) item-by-item, and
 *      reports whether the only difference is a missing/substituted item
 *      (the client #796 pattern: original has Chicken Breast + rice, the
 *      duplicate substitutes something else in the same meal slot).
 *
 * Does not modify anything — prints a report to decide the next step from.
 *
 * Usage (from server/):
 *   PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/analyze-duplicate-nutrition-cycles.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

const WORKSPACE_ID = 'cmikc4x4f04y0mi07ty9ypxww';

function log(msg: string) { console.log(msg); }

type Item = { name: string; amount: string };
type Meal = { name: string; items: Item[] };

async function getCycleMeals(cycleId: string): Promise<Meal[]> {
  const { rows: meals } = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order`, [cycleId],
  );
  const result: Meal[] = [];
  for (const m of meals) {
    const { rows: items } = await db.query<{ name_en: string; amount: string }>(`
      SELECT fi.name_en, nmi.amount FROM nutrition_meal_items nmi
      JOIN food_items fi ON fi.id = nmi.food_item_id
      WHERE nmi.meal_id = $1 ORDER BY nmi.meal_item_order
    `, [m.id]);
    result.push({ name: m.name, items: items.map(i => ({ name: i.name_en, amount: i.amount })) });
  }
  return result;
}

function diffMeals(a: Meal[], b: Meal[]): string[] {
  const diffs: string[] = [];
  const byNameA = new Map(a.map(m => [m.name, m]));
  const byNameB = new Map(b.map(m => [m.name, m]));
  const allNames = new Set([...byNameA.keys(), ...byNameB.keys()]);
  for (const name of allNames) {
    const ma = byNameA.get(name);
    const mb = byNameB.get(name);
    if (!ma) { diffs.push(`  meal "${name}" only in duplicate`); continue; }
    if (!mb) { diffs.push(`  meal "${name}" only in original`); continue; }
    const setA = new Set(ma.items.map(i => `${i.name}:${i.amount}`));
    const setB = new Set(mb.items.map(i => `${i.name}:${i.amount}`));
    const onlyA = ma.items.filter(i => !setB.has(`${i.name}:${i.amount}`));
    const onlyB = mb.items.filter(i => !setA.has(`${i.name}:${i.amount}`));
    if (onlyA.length || onlyB.length) {
      diffs.push(`  meal "${name}": original-only=[${onlyA.map(i => `${i.name} ${i.amount}g`).join(', ')}] duplicate-only=[${onlyB.map(i => `${i.name} ${i.amount}g`).join(', ')}]`);
    }
  }
  return diffs;
}

async function main() {
  const { rows: plans } = await db.query<{ id: string; name: string; client_id: string }>(`
    SELECT np.id, np.name, np.client_id FROM nutrition_plans np
    JOIN nutrition_cycles nc ON nc.plan_id = np.id
    WHERE np.workspace_id = $1 AND np.status = 'active'
    GROUP BY np.id, np.name, np.client_id HAVING count(*) > 1
  `, [WORKSPACE_ID]);

  log(`Found ${plans.length} plans with duplicate cycles.\n`);

  let onlyChickenPattern = 0;
  let otherPattern = 0;
  let oldHadMultipleDays = 0;

  for (const plan of plans) {
    const { rows: oldDays } = await old.query<{ id: string }>(
      `SELECT id FROM "NutritionPlanDay" WHERE "planId" = $1 AND "deletedAt" IS NULL`, [plan.id],
    );
    const oldDayIds = new Set(oldDays.map(d => d.id));

    const { rows: cycles } = await db.query<{ id: string; name: string; cycle_order: number }>(
      `SELECT id, name, cycle_order FROM nutrition_cycles WHERE plan_id = $1 ORDER BY cycle_order`, [plan.id],
    );

    const original = cycles.find(c => oldDayIds.has(c.id));
    const duplicates = cycles.filter(c => c.id !== original?.id);

    if (oldDayIds.size > 1) {
      oldHadMultipleDays++;
      log(`[${plan.id}] "${plan.name}" — OLD SYSTEM ALREADY HAD ${oldDayIds.size} days (not a live-app duplicate)`);
      continue;
    }
    if (!original) {
      log(`[${plan.id}] "${plan.name}" — WARNING: no cycle matches the old system's day id at all`);
      continue;
    }

    for (const dup of duplicates) {
      const originalMeals = await getCycleMeals(original.id);
      const dupMeals = await getCycleMeals(dup.id);
      const diffs = diffMeals(originalMeals, dupMeals);

      const isChickenPattern = diffs.length === 1 && /chicken/i.test(diffs[0]) && /original-only/.test(diffs[0]);
      if (isChickenPattern) onlyChickenPattern++; else otherPattern++;

      log(`[${plan.id}] "${plan.name}" client=${plan.client_id}`);
      log(`  original cycle="${original.name}"(order ${original.cycle_order}) duplicate cycle="${dup.name}"(order ${dup.cycle_order})`);
      if (diffs.length === 0) {
        log(`  IDENTICAL — no meal/item differences at all`);
      } else {
        diffs.forEach(d => log(d));
      }
      log(`  pattern: ${isChickenPattern ? 'CHICKEN-ONLY (matches client #796)' : 'OTHER'}\n`);
    }
  }

  log(`\n=== SUMMARY ===`);
  log(`Total plans with duplicate cycles: ${plans.length}`);
  log(`Old system already had multiple days (not a live-app duplicate): ${oldHadMultipleDays}`);
  log(`Chicken-only pattern (matches client #796 exactly): ${onlyChickenPattern}`);
  log(`Other/different pattern: ${otherPattern}`);
}

main()
  .catch(err => { console.error('FAILED:', err); process.exit(1); })
  .finally(async () => { await old.end(); await db.end(); });
