/**
 * Read-only investigation: migrate-incremental-catchup.ts never inserts into
 * exercise_library -- it only reads existing ids to link training_exercises
 * (see the `existingIds('exercise_library')` usage around its training_plans
 * chain). exercise_library is cloned per-workspace with fresh ids once (at
 * initial workspace migration / coach account creation), and never synced
 * again. Any exercise a coach adds in .io afterward is invisible in
 * production forever, with no error anywhere -- confirmed for Belghamdi
 * Coaching (6 exercises missing: Butterfly Machine, Cable Flat Press, Chair
 * Deadlift, Side Step Ups, Towel toe curls, Wall sit; created in .io between
 * 2026-05-14 and 2026-07-04, well after this workspace's library was first
 * cloned).
 *
 * ids are NOT a valid matching key here (exercise_library uses fresh,
 * workspace-scoped ids by design, not preserved .io ids) -- this matches by
 * (workspace_id, lower(trim(name))), same uniqueness .io itself enforces via
 * Exercise_workspaceId_name_key.
 *
 * Scoped to workspaces that already have at least one exercise_library row
 * (i.e. already-migrated workspaces) -- a workspace with zero rows hasn't
 * been cloned yet at all, which is a different, unrelated situation.
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
function normalize(name: string): string { return name.trim().toLowerCase(); }

async function main() {
  try {
    const { rows: migratedWorkspaces } = await db.query<{ workspace_id: string; name: string }>(`
      SELECT DISTINCT el.workspace_id, w.name
      FROM exercise_library el
      JOIN workspaces w ON w.id = el.workspace_id
    `);
    log(`${migratedWorkspaces.length} workspace(s) with an already-cloned exercise library`);

    let totalMissing = 0;
    const perWorkspace: Array<{ name: string; missing: number }> = [];

    for (const ws of migratedWorkspaces) {
      const { rows: oldEx } = await old.query<{ name: string }>(`
        SELECT name FROM public."Exercise" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
      `, [ws.workspace_id]);
      if (oldEx.length === 0) continue;

      const { rows: newEx } = await db.query<{ name_en: string }>(`
        SELECT name_en FROM exercise_library WHERE workspace_id = $1
      `, [ws.workspace_id]);
      const newNames = new Set(newEx.map(r => normalize(r.name_en)));

      const missing = oldEx.filter(r => !newNames.has(normalize(r.name)));
      if (missing.length > 0) {
        perWorkspace.push({ name: ws.name, missing: missing.length });
        totalMissing += missing.length;
      }
    }

    log(`workspaces affected: ${perWorkspace.length}`);
    for (const w of perWorkspace.sort((a, b) => b.missing - a.missing)) {
      log(`  - ${w.name}: ${w.missing} missing`);
    }
    log(`total missing exercises platform-wide: ${totalMissing}`);
  } catch (err) {
    console.error('[analyze-missing-exercise-library] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
  }
}

main();
