/**
 * Backfills food_items that are referenced by real, historical nutrition-plan meal
 * items but were never migrated at all, platform-wide.
 *
 * Root cause: migrate.ts's original migrateFoodItems() (the one-time historical
 * migration) filters `WHERE "deletedAt" IS NULL` — it only ever captured food items
 * that were still active in the coach's library at the moment that script ran. No
 * script since has ever re-synced food_items (migrate-incremental-catchup.ts has no
 * equivalent function at all). If a coach later deleted a food item from their
 * active library, past meals that used it were never retroactively affected in the
 * old system — but that food item was permanently excluded from ever being migrated,
 * silently dropping that ingredient from every historical meal that referenced it.
 *
 * Confirmed via a concrete real example (belghamdi client Ahmed Ashraf Farouq,
 * plan "ALL YEAR LEAN LACTOSE INTOLERENT"): "meal 2" was missing Chicken Breast
 * (300g) and boiled rice (200g), both soft-deleted in the old system on
 * 2025-12-03, explaining a coach-reported "calories extremely low" bug.
 *
 * Preserves the exact old FoodItem.id (matching migrate.ts's own convention) so
 * every existing nutrition_meal_items/nutrition_meal_item_alternatives row that
 * references it resolves correctly with zero further changes needed.
 *
 * Additive only — only inserts food_items that are referenced by a real
 * (non-deleted) MealFoodItem row and don't already exist in the new food_items
 * table. Idempotent, safe to re-run.
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-missing-food-items.ts
 *
 *   PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-missing-food-items.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-food-items] ${msg}`); }

async function main() {
  console.time('backfill-food-items');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: existing } = await newDb.query<{ id: string }>(`SELECT id FROM food_items`);
    const existingIds = new Set(existing.map(r => r.id));

    const { rows } = await old.query<{
      id: string; workspaceId: string; name: string; nameArabic: string | null;
      category: string | null; servingSize: number | null; unit: string | null;
      calories: number; protein: number; carbs: number; fat: number;
    }>(`
      SELECT DISTINCT fi.id, fi."workspaceId", fi.name, fi."nameArabic", fi.category,
             fi."servingSize", fi.unit, fi.calories, fi.protein, fi.carbs, fi.fat
      FROM "MealFoodItem" mfi
      JOIN "FoodItem" fi ON fi.id = mfi."foodItemId"
      WHERE mfi."deletedAt" IS NULL
        AND fi."workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
    `);

    const missing = rows.filter(f => !existingIds.has(f.id));
    log(`food_items: ${rows.length} distinct referenced, ${missing.length} missing from production`);
    if (DRY_RUN || missing.length === 0) return;

    const validWorkspaces = await newDb.query<{ id: string }>(`SELECT id FROM workspaces`);
    const validWorkspaceIds = new Set(validWorkspaces.rows.map(w => w.id));
    const insertable = missing.filter(f => validWorkspaceIds.has(f.workspaceId));
    log(`food_items: ${insertable.length} belong to a workspace that exists in production`);

    let inserted = 0;
    for (const f of insertable) {
      const result = await newDb.query(`
        INSERT INTO food_items (id, workspace_id, name_en, name_ar, food_category, serving_size, serving_unit, calories_per_serving, protein_per_serving, carbs_per_serving, fats_per_serving)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [f.id, f.workspaceId, f.name, f.nameArabic, f.category, f.servingSize, f.unit, f.calories, f.protein, f.carbs, f.fat]);
      inserted += result.rowCount ?? 0;
    }
    log(`food_items: inserted ${inserted} row(s)`);
  } catch (err) {
    console.error('[backfill-food-items] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await newDb.end();
    console.timeEnd('backfill-food-items');
  }
}

main();
