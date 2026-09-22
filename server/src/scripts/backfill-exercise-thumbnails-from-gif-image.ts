/**
 * Fills exercise_library.thumbnail_path from the old .io system's
 * Exercise.gifImage, for rows still NULL.
 *
 * No migration script has ever copied this field -- not the original
 * migrate.ts bulk clone, not migrate-incremental-catchup.ts, not this
 * session's own backfill-missing-exercise-library.ts. All three use the same
 * field mapping (name_en/name_ar/muscle_group/equipment/youtube_url) that
 * simply never included it. Confirmed for Belghamdi: 165 old exercises, 71
 * with a gifImage, but only 3 of 140 production rows have a thumbnail_path.
 *
 * gifImage holds a full external URL (a YouTube thumbnail CDN link, e.g.
 * https://i.ytimg.com/vi/<id>/hqdefault.jpg -- derived from the exercise's
 * videoUrl), NOT an object-storage-relative path like thumbnail_path
 * normally holds for coach-uploaded images. This is safe: toPublicUrl() in
 * lib/storage.ts already passes through anything matching /^https?:\/\//
 * unchanged (see its comment: "imported/seeded data ... pass those through
 * as-is") -- this exact case was already anticipated.
 *
 * Matches by exercise_library.id == old Exercise.id (both cuid- and
 * UUID-format .io ids are preserved as exercise_library ids -- id format is
 * not a reliable signal of provenance, only whichever id scheme .io itself
 * used when the exercise was created there).
 *
 * Only touches thumbnail_path IS NULL rows; never overwrites an existing
 * value (whether a coach's own upload or a prior master-library backfill).
 * Corrective only, idempotent. Platform-wide.
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-exercise-thumbnails-from-gif-image.ts
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-exercise-thumbnails-from-gif-image.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-thumbnails-from-gif] ${msg}`); }

async function main() {
  console.time('backfill-thumbnails-from-gif');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    const { rows: oldExercises } = await old.query<{ id: string; gif_image: string }>(`
      SELECT id, "gifImage" AS gif_image FROM public."Exercise"
      WHERE "deletedAt" IS NULL AND "gifImage" IS NOT NULL
    `);
    log(`old .io exercises with a gifImage: ${oldExercises.length}`);

    const { rows: needsThumbnail } = await db.query<{ id: string }>(`
      SELECT id FROM exercise_library WHERE thumbnail_path IS NULL
    `);
    const needsThumbnailIds = new Set(needsThumbnail.map(r => r.id));

    const toUpdate = oldExercises.filter(e => needsThumbnailIds.has(e.id));
    log(`exercise_library rows to backfill (currently NULL, matched by id): ${toUpdate.length}`);

    if (toUpdate.length > 0 && !DRY_RUN) {
      for (const e of toUpdate) {
        await db.query(`
          UPDATE exercise_library SET thumbnail_path = $1 WHERE id = $2 AND thumbnail_path IS NULL
        `, [e.gif_image, e.id]);
      }
      log(`backfilled ${toUpdate.length} row(s)`);
    }

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-thumbnails-from-gif] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
    console.timeEnd('backfill-thumbnails-from-gif');
  }
}

main();
