/**
 * Backfills two fields that every past migration script (the original historical
 * migrate-queue.ts, migrate-incremental-catchup.ts, and clone-workspace-from-snapshot.ts)
 * left at their schema defaults, platform-wide:
 *
 *  - forms.post_action        — real source: old FormTemplate.type ('nutrition' | 'workout' | 'other')
 *  - form_requests.assigned_to — real source: old FormSubmission.assignedToId (FK -> User.id)
 *
 * form_requests.post_action is then backfilled by copying down from the now-correct
 * forms.post_action, matching the app's own "denormalize the form's post_action at
 * request-creation time" design (see forms.controller.ts) — old data has no separate
 * per-submission override to lose, so this is exactly equivalent to what a correct
 * migration would have produced.
 *
 * Additive only (UPDATE, no deletes), idempotent, safe to re-run.
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-form-post-action-and-assignee.ts
 *
 *   # then, once the dry-run report looks right:
 *   PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-form-post-action-and-assignee.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-forms] ${msg}`); }

function mapPostAction(type: string): string {
  if (type === 'nutrition') return 'nutrition-plan';
  if (type === 'workout') return 'workout-plan';
  return 'nothing';
}

async function backfillFormsPostAction() {
  const { rows } = await old.query<{ id: string; type: string }>(`SELECT id, type FROM public."FormTemplate"`);
  if (rows.length === 0) { log('forms: no old templates, skipping'); return; }

  const client = await newDb.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS backfill_form_types`);
    await client.query(`CREATE TEMP TABLE backfill_form_types (id text, post_action text)`);

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values: unknown[] = [];
      const placeholders = batch.map((r, j) => {
        values.push(r.id, mapPostAction(r.type));
        return `($${j * 2 + 1},$${j * 2 + 2})`;
      });
      await client.query(
        `INSERT INTO backfill_form_types (id, post_action) VALUES ${placeholders.join(',')}`,
        values,
      );
    }

    const { rows: mismatches } = await client.query<{ id: string }>(`
      SELECT f.id FROM forms f
      JOIN backfill_form_types o ON o.id = f.id
      WHERE f.post_action IS DISTINCT FROM o.post_action
    `);
    log(`forms: ${mismatches.length} row(s) need post_action backfill`);
    if (mismatches.length === 0 || DRY_RUN) return;

    const result = await client.query(`
      UPDATE forms f SET post_action = o.post_action
      FROM backfill_form_types o
      WHERE o.id = f.id AND f.post_action IS DISTINCT FROM o.post_action
    `);
    log(`forms: corrected ${result.rowCount} row(s)`);
  } finally {
    client.release();
  }
}

async function backfillFormRequestsPostAction() {
  if (DRY_RUN) {
    const { rows } = await newDb.query<{ count: string }>(`
      SELECT count(*) FROM form_requests fr
      JOIN forms f ON f.id = fr.form_id
      WHERE fr.post_action IS DISTINCT FROM f.post_action
    `);
    log(`form_requests: ${rows[0].count} row(s) need post_action backfill`);
    return;
  }
  const result = await newDb.query(`
    UPDATE form_requests fr SET post_action = f.post_action
    FROM forms f
    WHERE f.id = fr.form_id AND fr.post_action IS DISTINCT FROM f.post_action
  `);
  log(`form_requests: corrected ${result.rowCount} row(s) post_action`);
}

async function backfillAssignedTo() {
  const { rows } = await old.query<{ id: string; assignedToId: string }>(`
    SELECT id, "assignedToId" FROM public."FormSubmission" WHERE "assignedToId" IS NOT NULL
  `);
  if (rows.length === 0) { log('form_requests: no old assignments, skipping'); return; }

  const { rows: users } = await newDb.query<{ id: string }>(`SELECT id FROM users`);
  const validUsers = new Set(users.map(u => u.id));
  const filtered = rows.filter(r => validUsers.has(r.assignedToId));
  log(`form_requests: ${rows.length} old assignment(s) found, ${filtered.length} reference a valid user`);
  if (filtered.length === 0) return;

  const client = await newDb.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS backfill_assignees`);
    await client.query(`CREATE TEMP TABLE backfill_assignees (id text, assigned_to text)`);

    const batchSize = 500;
    for (let i = 0; i < filtered.length; i += batchSize) {
      const batch = filtered.slice(i, i + batchSize);
      const values: unknown[] = [];
      const placeholders = batch.map((r, j) => {
        values.push(r.id, r.assignedToId);
        return `($${j * 2 + 1},$${j * 2 + 2})`;
      });
      await client.query(
        `INSERT INTO backfill_assignees (id, assigned_to) VALUES ${placeholders.join(',')}`,
        values,
      );
    }

    const { rows: mismatches } = await client.query<{ id: string }>(`
      SELECT fr.id FROM form_requests fr
      JOIN backfill_assignees o ON o.id = fr.id
      WHERE fr.assigned_to IS DISTINCT FROM o.assigned_to
    `);
    log(`form_requests: ${mismatches.length} row(s) need assigned_to backfill`);
    if (mismatches.length === 0 || DRY_RUN) return;

    const result = await client.query(`
      UPDATE form_requests fr SET assigned_to = o.assigned_to
      FROM backfill_assignees o
      WHERE o.id = fr.id AND fr.assigned_to IS DISTINCT FROM o.assigned_to
    `);
    log(`form_requests: corrected ${result.rowCount} row(s) assigned_to`);
  } finally {
    client.release();
  }
}

async function main() {
  console.time('backfill');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);
  try {
    await backfillFormsPostAction();
    await backfillFormRequestsPostAction();
    await backfillAssignedTo();
    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-forms] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await newDb.end();
    console.timeEnd('backfill');
  }
}

main();
