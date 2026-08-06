/**
 * Inserts a default set for training_exercises linked to a 'time_based'
 * exercise_library entry that currently have ZERO training_sets.
 *
 * Follow-up to backfill-cardio-tracking-type.ts. That script fixed
 * migrated (.io-id-preserved) rows; this covers a second, distinct source:
 * training_exercises created through the app's own builder (fresh ids, no
 * .io reference) via "+ Add Exercise" or "Load Plan" (which clones an
 * existing plan verbatim, sets included). handleAddExercise's own
 * defaultSetFor() DOES create a set correctly today, but plans built/cloned
 * before the tracking-type backend fix landed carry forward whatever
 * (empty/meaningless) set state existed at the time -- confirmed for Ramy
 * Abbas: 69 such rows platform-wide, all app-created ids, zero .io lineage.
 *
 * Rather than leave duration_seconds NULL (forcing every coach to refill
 * every instance by hand), this uses each exercise's own established mode
 * (most common duration_seconds among ITS existing training_sets, from
 * already-fixed instances) as the default -- e.g. Ramy Abbas's "Cool Down"
 * is 300s in 196 of 213 existing instances. Falls back to NULL only for an
 * exercise with zero existing duration data anywhere (a genuinely new
 * custom exercise, nothing to infer from).
 *
 * Corrective only, idempotent (only touches exercises with zero sets).
 * Platform-wide.
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-time-based-zero-set-exercises.ts
 *   DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-time-based-zero-set-exercises.ts
 */

import { Pool } from 'pg';
import { createId } from '@paralleldrive/cuid2';

const NEW_URL = process.env.DATABASE_URL;
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-time-based-zero-set] ${msg}`); }

async function main() {
  console.time('backfill-time-based-zero-set');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: zeroSetRows } = await db.query<{ training_exercise_id: string; exercise_library_id: string; name_en: string }>(`
      SELECT te.id AS training_exercise_id, el.id AS exercise_library_id, el.name_en
      FROM training_exercises te
      JOIN exercise_library el ON el.id = te.exercise_library_id
      WHERE el.tracking_type = 'time_based'
        AND NOT EXISTS (SELECT 1 FROM training_sets ts WHERE ts.exercise_id = te.id)
    `);
    log(`training_exercises linked to a time_based exercise with zero sets: ${zeroSetRows.length}`);
    if (zeroSetRows.length === 0) return;

    const libraryIds = [...new Set(zeroSetRows.map(r => r.exercise_library_id))];
    const { rows: durationModes } = await db.query<{ exercise_library_id: string; duration_seconds: number | null }>(`
      SELECT el.id AS exercise_library_id, ts.duration_seconds
      FROM training_sets ts
      JOIN training_exercises te ON te.id = ts.exercise_id
      JOIN exercise_library el ON el.id = te.exercise_library_id
      WHERE el.id = ANY($1::text[]) AND ts.duration_seconds IS NOT NULL
    `, [libraryIds]);

    const countsByLibraryId = new Map<string, Map<number, number>>();
    for (const r of durationModes) {
      if (!countsByLibraryId.has(r.exercise_library_id)) countsByLibraryId.set(r.exercise_library_id, new Map());
      const counts = countsByLibraryId.get(r.exercise_library_id)!;
      counts.set(r.duration_seconds!, (counts.get(r.duration_seconds!) ?? 0) + 1);
    }
    const modeByLibraryId = new Map<string, number | null>();
    for (const [libId, counts] of countsByLibraryId) {
      let best: number | null = null;
      let bestCount = -1;
      for (const [duration, count] of counts) {
        if (count > bestCount) { best = duration; bestCount = count; }
      }
      modeByLibraryId.set(libId, best);
    }

    const withMode = zeroSetRows.filter(r => modeByLibraryId.get(r.exercise_library_id) != null);
    const withoutMode = zeroSetRows.filter(r => modeByLibraryId.get(r.exercise_library_id) == null);
    log(`will insert with an inferred duration (from existing instances): ${withMode.length}`);
    log(`will insert with duration NULL (no existing data to infer from): ${withoutMode.length}`);
    for (const r of withoutMode.slice(0, 10)) log(`  - ${r.name_en} (${r.training_exercise_id})`);

    if (!DRY_RUN) {
      for (const r of zeroSetRows) {
        const duration = modeByLibraryId.get(r.exercise_library_id) ?? null;
        await db.query(`
          INSERT INTO training_sets (id, exercise_id, set_order, duration_seconds)
          VALUES ($1, $2, 1, $3)
        `, [createId(), r.training_exercise_id, duration]);
      }
      log(`inserted ${zeroSetRows.length} training_sets row(s)`);
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-time-based-zero-set] FAILED:', err);
    process.exit(1);
  } finally {
    await db.end();
    console.timeEnd('backfill-time-based-zero-set');
  }
}

main();
