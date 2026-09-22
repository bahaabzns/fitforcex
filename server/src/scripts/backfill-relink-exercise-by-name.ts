/**
 * Relinks training_exercises rows whose exercise_library_id is NULL to a
 * matching exercise_library row in the same workspace, by exact
 * (case-insensitive, trimmed) name match.
 *
 * Follow-up to backfill-missing-exercise-library.ts: that script relinked
 * rows whose ORIGINAL .io reference now resolves (76 rows), but many more
 * training_exercises were created directly through fitforce.app's own
 * builder -- always a fresh id, never tied to any .io reference -- because a
 * coach had to type an exercise as free text while it was missing from
 * their library dropdown (the same root cause). Now that
 * backfill-missing-exercise-library.ts has filled those gaps, 550
 * platform-wide training_exercises rows have an exact name match sitting
 * right there, unlinked, purely because they predate the library fix.
 *
 * Exact match only (case-insensitive, trimmed) -- no fuzzy matching. A
 * near-miss like "Side Step Ups" vs "Side Set Ups" (a genuine coach typo,
 * found during investigation) would NOT match here, which is correct: only
 * link when it's unambiguous.
 *
 * If a name matches more than one exercise_library row in the same
 * workspace (possible duplicate library entries), skips that name entirely
 * rather than guessing which one is correct -- logged separately so it can
 * be reviewed.
 *
 * Corrective only, idempotent (only touches still-NULL rows).
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-relink-exercise-by-name.ts
 *   DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-relink-exercise-by-name.ts
 */

import { Pool } from 'pg';

const NEW_URL = process.env.DATABASE_URL;
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-relink-exercise-by-name] ${msg}`); }

async function main() {
  console.time('backfill-relink-exercise-by-name');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: candidates } = await db.query<{
      training_exercise_id: string; workspace_id: string; name: string; library_id: string;
    }>(`
      SELECT te.id AS training_exercise_id, tp.workspace_id, te.name, el.id AS library_id
      FROM training_exercises te
      JOIN training_days td ON td.id = te.day_id
      JOIN training_plans tp ON tp.id = td.plan_id
      JOIN exercise_library el ON el.workspace_id = tp.workspace_id AND lower(trim(el.name_en)) = lower(trim(te.name))
      WHERE te.exercise_library_id IS NULL
    `);
    log(`training_exercises with an exact-name library match: ${candidates.length}`);

    const byTrainingExerciseId = new Map<string, string[]>();
    for (const c of candidates) {
      const list = byTrainingExerciseId.get(c.training_exercise_id) ?? [];
      list.push(c.library_id);
      byTrainingExerciseId.set(c.training_exercise_id, list);
    }

    const unambiguous: Array<{ trainingExerciseId: string; libraryId: string }> = [];
    let ambiguousCount = 0;
    for (const [teId, libraryIds] of byTrainingExerciseId) {
      const distinct = [...new Set(libraryIds)];
      if (distinct.length === 1) {
        unambiguous.push({ trainingExerciseId: teId, libraryId: distinct[0] });
      } else {
        ambiguousCount++;
      }
    }
    log(`unambiguous (single library match): ${unambiguous.length}`);
    log(`skipped, ambiguous (multiple library matches for the same name): ${ambiguousCount}`);

    if (unambiguous.length > 0 && !DRY_RUN) {
      for (const r of unambiguous) {
        await db.query(`
          UPDATE training_exercises SET exercise_library_id = $1 WHERE id = $2 AND exercise_library_id IS NULL
        `, [r.libraryId, r.trainingExerciseId]);
      }
      log(`relinked ${unambiguous.length} training_exercises row(s)`);
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-relink-exercise-by-name] FAILED:', err);
    process.exit(1);
  } finally {
    await db.end();
    console.timeEnd('backfill-relink-exercise-by-name');
  }
}

main();
