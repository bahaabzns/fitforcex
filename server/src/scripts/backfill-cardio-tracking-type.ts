/**
 * Fixes cardio/duration-based exercises migrated from .io: sets
 * exercise_library.tracking_type/tracked_metrics to the already-built
 * 'time_based' category (with 'duration_seconds' selected), and backfills
 * training_sets.duration_seconds for the affected training_exercises.
 *
 * .io's duration data lives entirely on WorkoutPlanDayItem (isCardio,
 * durationSeconds, sets count) -- per-usage, not per-exercise-definition.
 * Exercise.isCardio is frequently FALSE even for genuinely cardio exercises
 * (confirmed for Ramy Abbas's "Cool Down": Exercise.isCardio=false, but
 * every one of its ~700+ plan usages has WorkoutPlanDayItem.isCardio=true,
 * durationSeconds=300). The real signal is whether ANY plan usage of that
 * exercise was flagged isCardio -- not the exercise definition's own flag.
 *
 * No granular WorkoutPlanSet rows exist for these items in .io at all --
 * every migration/catch-up script has only ever sourced training_sets from
 * WorkoutPlanSet, so these items transferred with a name but zero sets and
 * no duration data whatsoever (confirmed: 804 such items platform-wide, 724
 * in Ramy Abbas alone).
 *
 * The tracking-type feature itself (exercise_library.tracking_type,
 * tracked_metrics, training_sets.duration_seconds/distance_km/...) already
 * exists in the schema and UI -- this backfill only sets the underlying
 * DATA using that already-built category.
 *
 * Two passes:
 *   1. exercise_library: for every row whose old Exercise id has at least
 *      one isCardio=true WorkoutPlanDayItem usage, sets tracking_type =
 *      'time_based', tracked_metrics = ['duration_seconds'] -- but ONLY if
 *      still at the untouched default ('sets_reps', no tracked_metrics or
 *      still exactly the generic default set) -- never overwrites a coach's
 *      own later, deliberate choice.
 *   2. training_sets: for every training_exercises row (matched by id ==
 *      old WorkoutPlanDayItem.id) that is isCardio=true, has sets > 0 and
 *      durationSeconds set, and currently has ZERO training_sets rows,
 *      inserts `sets` rows (set_order 1..N, duration_seconds =
 *      durationSeconds).
 *
 * Corrective only, idempotent (only touches library rows still at default,
 * and training_exercises with zero existing sets). Platform-wide.
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-cardio-tracking-type.ts
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-cardio-tracking-type.ts
 */

import { Pool } from 'pg';
import { createId } from '@paralleldrive/cuid2';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-cardio-tracking-type] ${msg}`); }

async function main() {
  console.time('backfill-cardio-tracking-type');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    // ─── Pass 1: exercise_library tracking_type ──────────────────────────
    const { rows: cardioExerciseRows } = await old.query<{ exercise_id: string }>(`
      SELECT DISTINCT e.id AS exercise_id
      FROM public."WorkoutPlanDayItem" di
      JOIN public."Exercise" e ON e.id = di."exerciseId"
      WHERE di."deletedAt" IS NULL AND di."isCardio" = true AND e."deletedAt" IS NULL
    `);
    const cardioExerciseIds = cardioExerciseRows.map(r => r.exercise_id);
    log(`old .io exercises with at least one cardio usage: ${cardioExerciseIds.length}`);

    const { rows: candidateLibraryRows } = await db.query<{
      id: string; tracking_type: string; tracked_metrics: string[];
    }>(`
      SELECT id, tracking_type, tracked_metrics FROM exercise_library WHERE id = ANY($1::text[])
    `, [cardioExerciseIds]);

    const untouchedDefault = candidateLibraryRows.filter(r =>
      r.tracking_type === 'sets_reps' &&
      (r.tracked_metrics.length === 0 || (r.tracked_metrics.length <= 2 && r.tracked_metrics.every(m => m === 'tempo' || m === 'rir')))
    );
    const alreadyCustomized = candidateLibraryRows.length - untouchedDefault.length;
    log(`exercise_library rows matching cardio usage: ${candidateLibraryRows.length}`);
    log(`  still at default (will be set to time_based): ${untouchedDefault.length}`);
    log(`  already customized by a coach (skipped): ${alreadyCustomized}`);

    if (untouchedDefault.length > 0 && !DRY_RUN) {
      const ids = untouchedDefault.map(r => r.id);
      await db.query(`
        UPDATE exercise_library SET tracking_type = 'time_based', tracked_metrics = ARRAY['duration_seconds']
        WHERE id = ANY($1::text[])
      `, [ids]);
      log(`updated ${ids.length} exercise_library row(s) to time_based`);
    }

    // ─── Pass 2: training_sets duration backfill ─────────────────────────
    const { rows: cardioItems } = await old.query<{
      id: string; sets: number; duration_seconds: number | null;
    }>(`
      SELECT id, sets, "durationSeconds" AS duration_seconds
      FROM public."WorkoutPlanDayItem"
      WHERE "deletedAt" IS NULL AND "isCardio" = true AND "durationSeconds" IS NOT NULL AND sets > 0
    `);
    log(`old .io cardio plan items with a duration and set count: ${cardioItems.length}`);

    const { rows: existingTe } = await db.query<{ id: string }>(`
      SELECT id FROM training_exercises WHERE id = ANY($1::text[])
    `, [cardioItems.map(c => c.id)]);
    const existingTeIds = new Set(existingTe.map(r => r.id));

    const { rows: hasSets } = await db.query<{ exercise_id: string }>(`
      SELECT DISTINCT exercise_id FROM training_sets WHERE exercise_id = ANY($1::text[])
    `, [cardioItems.filter(c => existingTeIds.has(c.id)).map(c => c.id)]);
    const hasSetsIds = new Set(hasSets.map(r => r.exercise_id));

    const toBackfill = cardioItems.filter(c => existingTeIds.has(c.id) && !hasSetsIds.has(c.id));
    const totalSetsToInsert = toBackfill.reduce((sum, c) => sum + c.sets, 0);
    log(`training_exercises needing synthesized sets: ${toBackfill.length} (${totalSetsToInsert} total set rows)`);

    if (toBackfill.length > 0 && !DRY_RUN) {
      for (const item of toBackfill) {
        for (let setOrder = 1; setOrder <= item.sets; setOrder++) {
          await db.query(`
            INSERT INTO training_sets (id, exercise_id, set_order, duration_seconds)
            VALUES ($1, $2, $3, $4)
          `, [createId(), item.id, setOrder, item.duration_seconds]);
        }
      }
      log(`inserted ${totalSetsToInsert} training_sets row(s) across ${toBackfill.length} exercise(s)`);
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-cardio-tracking-type] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
    console.timeEnd('backfill-cardio-tracking-type');
  }
}

main();
