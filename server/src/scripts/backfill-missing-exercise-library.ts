/**
 * Inserts exercise_library rows for old .io Exercise rows that were never
 * brought over -- migrate-incremental-catchup.ts never inserts into
 * exercise_library, only reads existing ids to link training_exercises
 * .exercise_library_id. The table was only ever populated once per workspace
 * (migrate.ts's original bulk clone of the WHOLE library, preserving old
 * Exercise.id as its own id); any exercise a coach added in .io afterward
 * was never inserted under any id -- whether or not it's used in a plan yet,
 * it's invisible in the app's exercise picker. Confirmed via
 * analyze-missing-exercise-library.ts (scoped to plan-referenced exercises
 * only, for impact-sizing): 5 exercises platform-wide, all in Belghamdi
 * Coaching (Butterfly Machine, Cable Flat Press, Chair Deadlift, Towel toe
 * curls, Wall sit -- added in .io between 2026-05-14 and 2026-07-04). This
 * backfill uses the same full-library scope as migrate.ts (not just
 * plan-referenced), so it may insert a few more than that 5 if any workspace
 * has an added-but-not-yet-used exercise.
 *
 * Field mapping matches migrate.ts's original exercise_library insert
 * exactly (same id, name_en/name_ar, muscle_group, equipment, youtube_url).
 *
 * After inserting, relinks any training_exercises row whose
 * exercise_library_id is NULL but whose original old WorkoutPlanDayItem
 * .exerciseId now resolves to one of the newly-inserted rows
 * (training_exercises.id == old WorkoutPlanDayItem.id, preserved) -- 76 rows
 * platform-wide per the analysis. The other 649 NULL rows are left alone;
 * they're null for an unrelated, legitimate reason (old reference was
 * itself null/deleted).
 *
 * Corrective only, scoped to genuinely-missing-and-referenced exercises.
 * Idempotent (skipDuplicates on insert; relink only touches still-NULL rows).
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-missing-exercise-library.ts
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-missing-exercise-library.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-missing-exercise-library] ${msg}`); }

async function main() {
  console.time('backfill-missing-exercise-library');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: allOldExercises } = await old.query<{
      id: string; workspace_id: string; name: string; name_ar: string | null;
      muscle_group: string; equipment: string | null; video_url: string | null;
      created_at: string;
    }>(`
      SELECT id, "workspaceId" AS workspace_id, name,
             "nameArabic" AS name_ar, "muscleGroup" AS muscle_group,
             "equipmentNeeded" AS equipment, "videoUrl" AS video_url,
             "createdAt" AS created_at
      FROM public."Exercise" WHERE "deletedAt" IS NULL
    `);

    const { rows: existingLib } = await db.query<{ id: string }>(`SELECT id FROM exercise_library`);
    const existingLibIds = new Set(existingLib.map(r => r.id));

    const { rows: validWorkspaces } = await db.query<{ id: string }>(`SELECT id FROM workspaces`);
    const validWorkspaceIds = new Set(validWorkspaces.map(r => r.id));

    const missing = allOldExercises.filter(e => !existingLibIds.has(e.id) && validWorkspaceIds.has(e.workspace_id));
    log(`missing exercise_library rows to insert: ${missing.length}`);
    for (const e of missing) log(`  - ${e.name} (workspace ${e.workspace_id})`);

    if (missing.length > 0 && !DRY_RUN) {
      for (const e of missing) {
        await db.query(`
          INSERT INTO exercise_library (id, workspace_id, name_en, name_ar, muscle_group, equipment, youtube_url, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
          ON CONFLICT (id) DO NOTHING
        `, [e.id, e.workspace_id, e.name, e.name_ar, e.muscle_group, e.equipment, e.video_url, new Date(e.created_at)]);
      }
      log(`inserted ${missing.length} exercise_library row(s)`);
    }

    // Relink: training_exercises rows still NULL whose original old
    // exerciseId now resolves (either from what we just inserted, or was
    // already there but not yet linked for some other reason).
    const { rows: nullRows } = await db.query<{ id: string }>(`
      SELECT id FROM training_exercises WHERE exercise_library_id IS NULL
    `);
    const { rows: oldItems } = await old.query<{ id: string; exercise_id: string | null }>(`
      SELECT id, "exerciseId" AS exercise_id FROM public."WorkoutPlanDayItem" WHERE "deletedAt" IS NULL
    `);
    const oldExerciseIdByItemId = new Map(oldItems.map(r => [r.id, r.exercise_id]));

    const allLibIds = new Set([...existingLibIds, ...missing.map(m => m.id)]);
    const toRelink = nullRows
      .map(r => ({ trainingExerciseId: r.id, exerciseLibraryId: oldExerciseIdByItemId.get(r.id) }))
      .filter((r): r is { trainingExerciseId: string; exerciseLibraryId: string } =>
        !!r.exerciseLibraryId && allLibIds.has(r.exerciseLibraryId));

    log(`training_exercises to relink: ${toRelink.length}`);
    if (toRelink.length > 0 && !DRY_RUN) {
      for (const r of toRelink) {
        await db.query(`
          UPDATE training_exercises SET exercise_library_id = $1 WHERE id = $2 AND exercise_library_id IS NULL
        `, [r.exerciseLibraryId, r.trainingExerciseId]);
      }
      log(`relinked ${toRelink.length} training_exercises row(s)`);
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-missing-exercise-library] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
    console.timeEnd('backfill-missing-exercise-library');
  }
}

main();
