/**
 * Read-only investigation into a confirmed bug in backfill-form-request-status.ts:
 * its mapStatus() maps old status 'todo' -> new 'submitted'. Direct evidence this is
 * wrong: platform-wide, 'todo' rows have 0% real answers (3886 rows, identical to
 * 'pending' at 0%), while 'submitted'/'archived' are ~99.5-99.8% real. 'todo' clearly
 * means "assigned to client, not yet done" and should map to 'pending'.
 *
 * Before writing the corrective fix, this checks whether any of the wrongly-mapped
 * rows have since been manually "reviewed" by a coach in the app (status='reviewed')
 * -- if so, that's a real action taken on what the coach believed was a genuine
 * submission, and should NOT be silently reverted by an automated fix.
 *
 * No writes.
 *
 * Usage (from server/):
 *   PG_OLD_URL="$PG_FRESH_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/analyze-form-status-mismap.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const db = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[analyze-form-status-mismap] ${msg}`); }

async function main() {
  try {
    const { rows: todoRows } = await old.query<{ id: string }>(`
      SELECT id FROM public."FormSubmission" WHERE status = 'todo' AND "deletedAt" IS NULL
    `);
    const todoIds = todoRows.map(r => r.id);
    log(`old .io 'todo' rows: ${todoIds.length}`);

    const { rows: prodRows } = await db.query<{ id: string; status: string }>(`
      SELECT id, status FROM form_requests WHERE id = ANY($1::text[])
    `, [todoIds]);
    log(`of those, present in production form_requests: ${prodRows.length}`);

    const byStatus = new Map<string, number>();
    for (const r of prodRows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    for (const [status, count] of byStatus) log(`  production status = '${status}': ${count}`);

    const reviewedIds = prodRows.filter(r => r.status === 'reviewed').map(r => r.id);
    if (reviewedIds.length > 0) {
      log(`⚠ ${reviewedIds.length} row(s) mapped from 'todo' are now 'reviewed' in production -- a coach may have acted on these. Sample ids:`);
      for (const id of reviewedIds.slice(0, 10)) log(`  - ${id}`);
    } else {
      log(`none of the mismapped rows have been reviewed -- safe to reset all 'submitted' ones to 'pending'`);
    }
  } catch (err) {
    console.error('[analyze-form-status-mismap] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await db.end();
  }
}

main();
