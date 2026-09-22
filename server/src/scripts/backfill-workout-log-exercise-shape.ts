/**
 * Remaps workout_logs.exercises JSON from the old fitforce.io shape to the shape
 * workoutLogStats.ts (and the client-portal's own loggedExerciseSchema) actually
 * expects — the reason exercise weight history, charts, and "previous weight"
 * never appeared for any migrated workout log.
 *
 * Old shape (per exercise, from FitForce.io's WorkoutLog.exercises jsonb):
 *   { exerciseId, exerciseName, notes, sets: [{ reps, weight, rir, completed,
 *     restSeconds, restTime, ... }] }  — no set_order, no exercise_library_id.
 *
 * Required new shape (server/src/utils/workoutLogStats.ts, enforced by
 * clientPortal.controller.ts's loggedExerciseSchema for logs created in-app):
 *   { exercise_id, exercise_library_id, name, note, sets: [{ set_order, weight,
 *     reps, rir, rest_seconds, completed }] }
 *
 * Every helper in workoutLogStats.ts (matchesExercise, buildExerciseProgress,
 * extractPreviousSets, distinctLoggedExercises, computePersonalRecords, …) reads
 * the new key names exclusively — with the old keys, `exercise.exercise_id`,
 * `exercise.name`, and `set.rest_seconds` are all `undefined`, so every migrated
 * session silently drops out of every chart/progress/previous-weight feature.
 *
 * exercise_id maps directly to the old exerciseId, since training_exercises.id
 * preserves the old WorkoutPlanDayItem.id unchanged (see migrate-incremental-
 * catchup.ts / clone-workspace-from-snapshot.ts's training plan migration).
 * exercise_library_id is resolved by looking that id up in training_exercises.
 *
 * Idempotent — an exercise entry that already has `exercise_id` is left alone,
 * so it's safe to re-run (and won't touch logs created directly by the live app,
 * which are already in the correct shape).
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" npx tsx src/scripts/backfill-workout-log-exercise-shape.ts
 *   DATABASE_URL="$DATABASE_URL" npx tsx src/scripts/backfill-workout-log-exercise-shape.ts
 */

import { Pool } from 'pg';

const NEW_URL = process.env.DATABASE_URL;
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-workout-shape] ${msg}`); }

type OldSet = {
  reps?: number | null; weight?: number | null; rir?: number | null;
  completed?: boolean; restSeconds?: number | null; restTime?: number | null;
};
type OldExercise = {
  exerciseId?: string; exerciseName?: string; notes?: string | null;
  sets?: OldSet[];
};
type NewSet = {
  set_order: number; weight: number | null; reps: number | null;
  rir: number | null; rest_seconds: number | null; completed: boolean;
};
type NewExercise = {
  exercise_id: string; exercise_library_id: string | null;
  name: string; note: string | null; sets: NewSet[];
};

function isAlreadyNewShape(entry: unknown): boolean {
  return !!entry && typeof entry === 'object' && 'exercise_id' in (entry as object);
}

function remapExercise(old: OldExercise, libraryIdByExerciseId: Map<string, string | null>): NewExercise {
  const exerciseId = old.exerciseId ?? '';
  return {
    exercise_id: exerciseId,
    exercise_library_id: libraryIdByExerciseId.get(exerciseId) ?? null,
    name: old.exerciseName ?? 'Exercise',
    note: old.notes ?? null,
    sets: (old.sets ?? []).map((s, i) => ({
      set_order: i,
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      rir: s.rir ?? null,
      rest_seconds: s.restSeconds ?? s.restTime ?? null,
      completed: s.completed ?? false,
    })),
  };
}

async function main() {
  console.time('backfill-workout-shape');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: exerciseLib } = await db.query<{ id: string; exercise_library_id: string | null }>(`
      SELECT id, exercise_library_id FROM training_exercises
    `);
    const libraryIdByExerciseId = new Map(exerciseLib.map(e => [e.id, e.exercise_library_id]));

    const { rows: logs } = await db.query<{ id: string; exercises: OldExercise[] }>(`
      SELECT id, exercises FROM workout_logs
      WHERE jsonb_array_length(exercises) > 0
    `);

    const toFix: Array<{ id: string; newExercises: NewExercise[] }> = [];
    for (const row of logs) {
      const needsRemap = row.exercises.some(e => !isAlreadyNewShape(e));
      if (!needsRemap) continue;
      const newExercises = row.exercises.map(e =>
        isAlreadyNewShape(e) ? (e as unknown as NewExercise) : remapExercise(e, libraryIdByExerciseId)
      );
      toFix.push({ id: row.id, newExercises });
    }

    log(`workout_logs: ${logs.length} total with exercises, ${toFix.length} need remapping`);
    if (DRY_RUN || toFix.length === 0) return;

    let updated = 0;
    for (const item of toFix) {
      const result = await db.query(
        `UPDATE workout_logs SET exercises = $1::jsonb WHERE id = $2`,
        [JSON.stringify(item.newExercises), item.id],
      );
      updated += result.rowCount ?? 0;
    }
    log(`workout_logs: remapped ${updated} row(s)`);
  } catch (err) {
    console.error('[backfill-workout-shape] FAILED:', err);
    process.exit(1);
  } finally {
    await db.end();
    console.timeEnd('backfill-workout-shape');
  }
}

main();
