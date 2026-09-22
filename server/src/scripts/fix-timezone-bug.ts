/**
 * Corrects a timezone bug introduced by migrate-incremental-catchup.ts.
 *
 * Root cause: fitforce.io's naive `timestamp without time zone` columns store
 * Africa/Cairo local wall-clock time. The original historical bulk migration
 * (migrate.ts, run months ago) happened to run in an environment where Node's
 * effective timezone was Africa/Cairo, so `new Date(oldNaiveValue)` correctly
 * auto-converted local time to UTC. migrate-incremental-catchup.ts was run on
 * this VPS, where Node's effective timezone is UTC (confirmed via
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`) — so the exact same code
 * pattern instead treated every naive old timestamp as if it were already UTC,
 * with no conversion. Every date field the catch-up script wrote is off by
 * 2-3 hours (depending on whether that historical date fell in Cairo's DST
 * window), platform-wide, across every table it touched.
 *
 * This script does NOT need to track exactly which rows the catch-up script
 * inserted. Rows correctly migrated by the original bulk migration show ZERO
 * mismatch under the `AT TIME ZONE 'Africa/Cairo'` comparison (verified
 * directly against real data before writing this script) — so comparing every
 * row, platform-wide, naturally and safely isolates only the genuinely wrong
 * ones, regardless of when they were inserted.
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/fix-timezone-bug.ts
 *
 *   # then, once the dry-run report looks right:
 *   PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/fix-timezone-bug.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[fix-tz] ${msg}`); }

/**
 * Corrects one or more timestamp columns on `newTable`, matched by id directly
 * against `oldTable`/`oldIdCol` in the old snapshot. `columns` maps each new
 * column to its old source column. Nullable columns are handled via
 * IS DISTINCT FROM so NULL-vs-NULL never counts as a mismatch.
 */
async function fixDirectMatch(
  newTable: string,
  oldTable: string,
  oldIdCol: string,
  columns: Array<{ newCol: string; oldCol: string }>,
) {
  const { rows: oldRows } = await old.query<Record<string, any>>(`
    SELECT "${oldIdCol}" AS id, ${columns.map(c => `"${c.oldCol}"`).join(', ')}
    FROM public."${oldTable}"
  `);

  if (oldRows.length === 0) {
    log(`${newTable}: no old rows to compare, skipping`);
    return;
  }

  // Load old rows into a temp table on the new connection for a server-side join —
  // same technique already validated manually earlier today.
  const client = await newDb.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS tz_fix_old`);
    await client.query(`
      CREATE TEMP TABLE tz_fix_old (id text, ${columns.map(c => `"${c.oldCol}" timestamp`).join(', ')})
    `);

    const batchSize = 500;
    for (let i = 0; i < oldRows.length; i += batchSize) {
      const batch = oldRows.slice(i, i + batchSize);
      const values: unknown[] = [];
      const placeholders = batch.map((r, j) => {
        const base = j * (columns.length + 1);
        values.push(r.id, ...columns.map(c => r[c.oldCol]));
        return `(${Array.from({ length: columns.length + 1 }, (_, k) => `$${base + k + 1}`).join(',')})`;
      });
      await client.query(
        `INSERT INTO tz_fix_old (id, ${columns.map(c => `"${c.oldCol}"`).join(', ')}) VALUES ${placeholders.join(',')}`,
        values,
      );
    }

    const mismatchConditions = columns
      .map(c => `(n."${c.newCol}" AT TIME ZONE 'UTC') IS DISTINCT FROM (o."${c.oldCol}" AT TIME ZONE 'Africa/Cairo')`)
      .join(' OR ');

    const { rows: mismatches } = await client.query<{ id: string }>(`
      SELECT n.id FROM "${newTable}" n
      JOIN tz_fix_old o ON o.id = n.id
      WHERE ${mismatchConditions}
    `);

    log(`${newTable}: ${mismatches.length} row(s) need correction`);
    if (mismatches.length === 0 || DRY_RUN) return;

    const setClauses = columns.map(c => `"${c.newCol}" = (o."${c.oldCol}" AT TIME ZONE 'Africa/Cairo')`).join(', ');
    const result = await client.query(`
      UPDATE "${newTable}" n
      SET ${setClauses}
      FROM tz_fix_old o
      WHERE o.id = n.id AND (${mismatchConditions})
    `);
    log(`${newTable}: corrected ${result.rowCount} row(s)`);
  } finally {
    client.release();
  }
}

/**
 * form_versions and form_version_questions don't carry their own old-system id —
 * every version/question created by migrate-incremental-catchup.ts inherited its
 * timestamp from the parent FormTemplate.createdAt. Corrected via a join through
 * forms.id -> FormTemplate.id instead of a direct id match.
 */
async function fixFormVersionTimestamps() {
  const { rows: oldForms } = await old.query<{ id: string; createdAt: string }>(`
    SELECT id, "createdAt" FROM public."FormTemplate"
  `);
  if (oldForms.length === 0) { log('form_versions/form_version_questions: no old forms, skipping'); return; }

  const client = await newDb.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS tz_fix_forms`);
    await client.query(`CREATE TEMP TABLE tz_fix_forms (form_id text, created_at_old timestamp)`);
    const batchSize = 500;
    for (let i = 0; i < oldForms.length; i += batchSize) {
      const batch = oldForms.slice(i, i + batchSize);
      const values: unknown[] = [];
      const placeholders = batch.map((r, j) => {
        values.push(r.id, r.createdAt);
        return `($${j * 2 + 1}, $${j * 2 + 2})`;
      });
      await client.query(
        `INSERT INTO tz_fix_forms (form_id, created_at_old) VALUES ${placeholders.join(',')}`,
        values,
      );
    }

    const { rows: versionMismatches } = await client.query<{ id: string }>(`
      SELECT fv.id FROM form_versions fv
      JOIN tz_fix_forms o ON o.form_id = fv.form_id
      WHERE (fv.created_at AT TIME ZONE 'UTC') IS DISTINCT FROM (o.created_at_old AT TIME ZONE 'Africa/Cairo')
    `);
    log(`form_versions: ${versionMismatches.length} row(s) need correction`);
    if (versionMismatches.length > 0 && !DRY_RUN) {
      const result = await client.query(`
        UPDATE form_versions fv
        SET created_at = (o.created_at_old AT TIME ZONE 'Africa/Cairo')
        FROM tz_fix_forms o
        WHERE o.form_id = fv.form_id
          AND (fv.created_at AT TIME ZONE 'UTC') IS DISTINCT FROM (o.created_at_old AT TIME ZONE 'Africa/Cairo')
      `);
      log(`form_versions: corrected ${result.rowCount} row(s)`);
    }

    const { rows: questionMismatches } = await client.query<{ id: string }>(`
      SELECT fvq.id FROM form_version_questions fvq
      JOIN form_versions fv ON fv.id = fvq.form_version_id
      JOIN tz_fix_forms o ON o.form_id = fv.form_id
      WHERE (fvq.created_at AT TIME ZONE 'UTC') IS DISTINCT FROM (o.created_at_old AT TIME ZONE 'Africa/Cairo')
    `);
    log(`form_version_questions: ${questionMismatches.length} row(s) need correction`);
    if (questionMismatches.length > 0 && !DRY_RUN) {
      const result = await client.query(`
        UPDATE form_version_questions fvq
        SET created_at = (o.created_at_old AT TIME ZONE 'Africa/Cairo')
        FROM form_versions fv, tz_fix_forms o
        WHERE fv.id = fvq.form_version_id AND o.form_id = fv.form_id
          AND (fvq.created_at AT TIME ZONE 'UTC') IS DISTINCT FROM (o.created_at_old AT TIME ZONE 'Africa/Cairo')
      `);
      log(`form_version_questions: corrected ${result.rowCount} row(s)`);
    }
  } finally {
    client.release();
  }
}

async function main() {
  console.time('fix-tz');
  log(`Starting timezone correction… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    await fixDirectMatch('users', 'User', 'id', [{ newCol: 'created_at', oldCol: 'createdAt' }]);
    await fixDirectMatch('clients', 'Client', 'id', [{ newCol: 'created_at', oldCol: 'createdAt' }]);
    await fixDirectMatch('forms', 'FormTemplate', 'id', [
      { newCol: 'created_at', oldCol: 'createdAt' },
      { newCol: 'updated_at', oldCol: 'createdAt' },
    ]);
    await fixFormVersionTimestamps();
    await fixDirectMatch('form_requests', 'FormSubmission', 'id', [
      { newCol: 'requested_at', oldCol: 'createdAt' },
      { newCol: 'submitted_at', oldCol: 'updatedAt' },
    ]);
    await fixDirectMatch('messages', 'Message', 'id', [
      { newCol: 'created_at', oldCol: 'createdAt' },
      { newCol: 'read_by_team_at', oldCol: 'readByTeamAt' },
      { newCol: 'read_by_client_at', oldCol: 'readByClientAt' },
    ]);
    await fixDirectMatch('nutrition_plans', 'NutritionPlan', 'id', [
      { newCol: 'created_at', oldCol: 'createdAt' },
      { newCol: 'updated_at', oldCol: 'updatedAt' },
      { newCol: 'activated_at', oldCol: 'activatedAt' },
    ]);
    await fixDirectMatch('training_plans', 'WorkoutPlan', 'id', [
      { newCol: 'created_at', oldCol: 'createdAt' },
      { newCol: 'updated_at', oldCol: 'updatedAt' },
      { newCol: 'activated_at', oldCol: 'activatedAt' },
    ]);
    await fixDirectMatch('workout_logs', 'WorkoutLog', 'id', [{ newCol: 'created_at', oldCol: 'createdAt' }]);
    await fixDirectMatch('transactions', 'Payment', 'id', [
      { newCol: 'transaction_date', oldCol: 'createdAt' },
      { newCol: 'created_at', oldCol: 'createdAt' },
    ]);

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Correction complete.');
  } catch (err) {
    console.error('[fix-tz] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await newDb.end();
    console.timeEnd('fix-tz');
  }
}

main();
