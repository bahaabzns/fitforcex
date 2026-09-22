/**
 * Read-only investigation, revised: migrate-incremental-catchup.ts never
 * inserts into exercise_library, only reads existing ids to link
 * training_exercises.exercise_library_id (matching by exact id equality
 * against old .io Exercise.id). exercise_library mixes two id conventions
 * per workspace: UUID rows (a shared default library, cloned once) and cuid
 * rows that preserve the exact old Exercise.id (the workspace's own custom
 * exercises, from the one-time original clone). Any exercise a coach adds in
 * .io AFTER that one-time clone is never inserted under any id, so it can
 * never link -- confirmed for Belghamdi (6 exercises, added 2026-05-14
 * through 2026-07-04, well after the workspace's library was first cloned).
 *
 * This checks, platform-wide:
 *   1. How many exercise_library rows are genuinely missing (old Exercise.id
 *      not present in production exercise_library, for exercises actually
 *      referenced by at least one migrated WorkoutPlanDayItem).
 *   2. Of the training_exercises rows with a NULL exercise_library_id, how
 *      many would become linkable once those missing rows are inserted
 *      (i.e. their original old exerciseId reference exists among the
 *      missing set) vs how many are null for an unrelated, legitimate reason
 *      (old exerciseId was itself null, or referenced a deleted Exercise).
 *
 * No writes. Platform-wide.
 *
 * Usage (from server/):
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/analyze-missing-exercise-library.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[analyze-missing-exercise-library] ${msg}`); }

async function main() {
  try {
    // 1. Exercises actually referenced by a migrated WorkoutPlanDayItem, whose
    // exercise_library.id (== old Exercise.id) is missing from production.
    const { rows: referencedExercises } = await old.query<{
      exercise_id: string; workspace_id: string; name: string;
    }>(`
      SELECT DISTINCT e.id AS exercise_id, e."workspaceId" AS workspace_id, e.name
      FROM public."WorkoutPlanDayItem" di
      JOIN public."Exercise" e ON e.id = di."exerciseId"
      WHERE di."deletedAt" IS NULL AND e."deletedAt" IS NULL
    `);
    log(`old .io exercises referenced by at least one plan item: ${referencedExercises.length}`);

    const { rows: existingLib } = await db.query<{ id: string }>(`SELECT id FROM exercise_library`);
    const existingLibIds = new Set(existingLib.map(r => r.id));

    const missingLib = referencedExercises.filter(e => !existingLibIds.has(e.exercise_id));
    log(`referenced exercises missing from production exercise_library: ${missingLib.length}`);

    const byWorkspace = new Map<string, number>();
    for (const e of missingLib) byWorkspace.set(e.workspace_id, (byWorkspace.get(e.workspace_id) ?? 0) + 1);
    const { rows: wsNames } = await db.query<{ id: string; name: string }>(`
      SELECT id, name FROM workspaces WHERE id = ANY($1::text[])
    `, [[...byWorkspace.keys()]]);
    const wsNameById = new Map(wsNames.map(w => [w.id, w.name]));
    for (const [wsId, count] of [...byWorkspace.entries()].sort((a, b) => b[1] - a[1])) {
      log(`  - ${wsNameById.get(wsId) ?? wsId}: ${count} missing`);
    }

    // 2. Of the currently-NULL training_exercises.exercise_library_id rows,
    // how many would become linkable once the missing exercise_library rows
    // above are inserted.
    const { rows: nullRows } = await db.query<{ id: string }>(`
      SELECT id FROM training_exercises WHERE exercise_library_id IS NULL
    `);
    log(`training_exercises with NULL exercise_library_id: ${nullRows.length}`);

    const missingLibIds = new Set(missingLib.map(e => e.exercise_id));
    // training_exercises.id == old WorkoutPlanDayItem.id (preserved), so look
    // up each null row's original exerciseId directly.
    const { rows: oldItems } = await old.query<{ id: string; exercise_id: string | null }>(`
      SELECT id, "exerciseId" AS exercise_id FROM public."WorkoutPlanDayItem" WHERE "deletedAt" IS NULL
    `);
    const oldExerciseIdByItemId = new Map(oldItems.map(r => [r.id, r.exercise_id]));

    let wouldBeFixed = 0;
    let unrelated = 0;
    for (const row of nullRows) {
      const oldExerciseId = oldExerciseIdByItemId.get(row.id);
      if (oldExerciseId && missingLibIds.has(oldExerciseId)) wouldBeFixed++;
      else unrelated++;
    }
    log(`of those, would become linkable once missing exercise_library rows are inserted: ${wouldBeFixed}`);
    log(`unrelated (old reference was null/deleted, or row not from .io at all): ${unrelated}`);
  } catch (err) {
    console.error('[analyze-missing-exercise-library] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
  }
}

main();
