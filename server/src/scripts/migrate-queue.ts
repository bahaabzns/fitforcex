/**
 * Migrates the Plans Queue from old DB → new DB.
 *
 * Old table:  FormSubmission  (7 567 rows)
 *   - id, workspaceId, formId, clientId, answers (jsonb), status,
 *     scheduleAt, createdAt, updatedAt, deletedAt
 *
 * New tables:
 *   form_requests  — one row per submission
 *   form_responses — one row per answer key-value pair (expanded from answers jsonb)
 *
 * Status mapping (old → new):
 *   submitted  → submitted
 *   pending    → pending
 *   scheduled  → scheduled
 *   done / reviewed / completed / action_taken → done
 *   anything else → pending
 *
 * Usage (from server/):
 *   PG_OLD_URL="postgresql://fitforce_user:Canyouseeme%40441199@localhost:5432/fitforce_old" \
 *   DATABASE_URL="postgresql://fitforce_user:Canyouseeme%40441199@localhost:5432/fitforce_db" \
 *   npx tsx src/scripts/migrate-queue.ts
 */

import { Pool } from 'pg';
import { createId } from '@paralleldrive/cuid2';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL  = process.env.DATABASE_URL;

if (!OLD_URL || !NEW_URL) {
  console.error('PG_OLD_URL and DATABASE_URL are both required');
  process.exit(1);
}

const old   = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

const BATCH = 200;

function log(msg: string) { console.log(`[migrate-queue] ${msg}`); }

function mapStatus(s: string | null): string {
  if (!s) return 'pending';
  const n = s.toLowerCase();
  if (n === 'submitted') return 'submitted';
  if (n === 'scheduled') return 'scheduled';
  if (n === 'done' || n === 'reviewed' || n === 'completed' || n === 'action_taken') return 'done';
  return 'pending';
}

async function main() {
  // ── 1. Load what already exists in the new DB ─────────────────────────────

  const { rows: existingForms }   = await newDb.query<{ id: string }>('SELECT id FROM forms');
  const { rows: existingClients } = await newDb.query<{ id: string }>('SELECT id FROM clients');
  const { rows: existingQuestions } = await newDb.query<{ id: string; form_id: string }>(
    'SELECT id, form_id FROM form_questions'
  );

  const formIds     = new Set(existingForms.map(r => r.id));
  const clientIds   = new Set(existingClients.map(r => r.id));
  // Map: formId → Set of valid questionIds
  const questionsByForm = new Map<string, Set<string>>();
  for (const q of existingQuestions) {
    if (!questionsByForm.has(q.form_id)) questionsByForm.set(q.form_id, new Set());
    questionsByForm.get(q.form_id)!.add(q.id);
  }

  log(`new DB: ${formIds.size} forms, ${clientIds.size} clients, ${existingQuestions.length} questions`);

  // ── 2. Read old FormSubmission ─────────────────────────────────────────────

  const { rows } = await old.query<{
    id: string;
    workspaceId: string;
    formId: string;
    clientId: string;
    answers: Record<string, unknown> | null;
    status: string;
    scheduleAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>(`
    SELECT id, "workspaceId", "formId", "clientId", answers, status,
           "scheduleAt", "createdAt", "updatedAt"
    FROM public."FormSubmission"
    WHERE "deletedAt" IS NULL
      AND "clientId" IS NOT NULL
      AND "formId"   IS NOT NULL
  `);

  log(`old DB: ${rows.length} FormSubmission rows`);

  // Filter to rows whose form and client exist in the new DB
  const valid = rows.filter(r => formIds.has(r.formId) && clientIds.has(r.clientId));
  log(`valid (form+client exist in new DB): ${valid.length}`);

  if (valid.length === 0) {
    log('nothing to migrate — exiting');
    return;
  }

  // ── 3. Insert form_requests in batches ─────────────────────────────────────

  let reqInserted = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH);

    const vals: unknown[] = [];
    const placeholders = batch.map((r, j) => {
      const base = j * 9;
      const submittedAt = (r.status === 'submitted' || r.status === 'done')
        ? new Date(r.updatedAt)
        : null;
      vals.push(
        r.id,
        r.formId,
        r.clientId,
        r.workspaceId,
        mapStatus(r.status),
        new Date(r.createdAt),
        submittedAt,
        r.scheduleAt ? new Date(r.scheduleAt) : null,
        'nothing',
      );
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9})`;
    });

    await newDb.query(`
      INSERT INTO form_requests
        (id, form_id, client_id, workspace_id, status, requested_at, submitted_at, scheduled_at, post_action)
      VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO NOTHING
    `, vals);

    reqInserted += batch.length;
    log(`  form_requests: ${reqInserted}/${valid.length}`);
  }

  // ── 4. Expand answers jsonb → form_responses ───────────────────────────────

  interface ResponseRow {
    id: string;
    request_id: string;
    question_id: string;
    answer: string;
    created_at: Date;
  }

  const allResponses: ResponseRow[] = [];

  for (const r of valid) {
    if (!r.answers || typeof r.answers !== 'object') continue;
    const validQs = questionsByForm.get(r.formId);

    for (const [questionId, answer] of Object.entries(r.answers)) {
      // Only insert if question exists in new DB (skip stale/deleted question IDs)
      if (validQs && !validQs.has(questionId)) continue;
      allResponses.push({
        id:          createId(),
        request_id:  r.id,
        question_id: questionId,
        answer:      answer == null ? '' : String(answer),
        created_at:  new Date(r.createdAt),
      });
    }
  }

  log(`expanding ${allResponses.length} answer rows`);

  let respInserted = 0;
  for (let i = 0; i < allResponses.length; i += BATCH) {
    const batch = allResponses.slice(i, i + BATCH);

    const vals: unknown[] = [];
    const placeholders = batch.map((r, j) => {
      const base = j * 5;
      vals.push(r.id, r.request_id, r.question_id, r.answer, r.created_at);
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5})`;
    });

    await newDb.query(`
      INSERT INTO form_responses (id, request_id, question_id, answer, created_at)
      VALUES ${placeholders.join(',')}
      ON CONFLICT DO NOTHING
    `, vals);

    respInserted += batch.length;
    if (respInserted % 2000 === 0 || respInserted === allResponses.length) {
      log(`  form_responses: ${respInserted}/${allResponses.length}`);
    }
  }

  log(`done — ${reqInserted} form_requests, ${respInserted} form_responses migrated`);
}

main().catch(err => {
  console.error('migrate-queue FAILED:', err);
  process.exit(1);
}).finally(async () => {
  await old.end();
  await newDb.end();
});
