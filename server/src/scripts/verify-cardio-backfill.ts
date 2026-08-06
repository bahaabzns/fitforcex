/**
 * Read-only verification for backfill-cardio-tracking-type.ts: confirms
 * every old .io cardio plan item (isCardio=true, no granular WorkoutPlanSet
 * row) now has a corresponding training_sets row in production.
 *
 * Usage (from server/):
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/verify-cardio-backfill.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[verify-cardio-backfill] ${msg}`); }

async function main() {
  try {
    const { rows: cardioItems } = await old.query<{ id: string }>(`
      SELECT di.id FROM public."WorkoutPlanDayItem" di
      WHERE di."deletedAt" IS NULL AND di."isCardio" = true
        AND NOT EXISTS (SELECT 1 FROM public."WorkoutPlanSet" s WHERE s."dayItemId" = di.id AND s."deletedAt" IS NULL)
    `);
    log(`old .io cardio items with no granular sets: ${cardioItems.length}`);

    const { rows: withSets } = await db.query<{ exercise_id: string }>(`
      SELECT DISTINCT exercise_id FROM training_sets WHERE exercise_id = ANY($1::text[])
    `, [cardioItems.map(c => c.id)]);
    const withSetsIds = new Set(withSets.map(r => r.exercise_id));

    const { rows: existingTe } = await db.query<{ id: string }>(`
      SELECT id FROM training_exercises WHERE id = ANY($1::text[])
    `, [cardioItems.map(c => c.id)]);
    const existingTeIds = new Set(existingTe.map(r => r.id));

    const stillMissing = cardioItems.filter(c => existingTeIds.has(c.id) && !withSetsIds.has(c.id));
    const notMigrated = cardioItems.filter(c => !existingTeIds.has(c.id));
    const fixed = cardioItems.filter(c => existingTeIds.has(c.id) && withSetsIds.has(c.id));

    log(`fixed (has training_sets now): ${fixed.length}`);
    log(`still missing (training_exercises exists, no sets): ${stillMissing.length}`);
    log(`not yet migrated at all (no training_exercises row): ${notMigrated.length}`);
  } catch (err) {
    console.error('[verify-cardio-backfill] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
  }
}

main();
