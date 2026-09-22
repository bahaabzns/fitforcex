/**
 * Patches form_questions rows where label_en = 'Question' (migration default).
 *
 * The old FormTemplate.questions JSONB uses several possible field names for the
 * question text: label, text, title, question, name — try all of them in order.
 *
 * Usage (from server/):
 *   PG_OLD_URL="postgresql://fitforce_user:<password>@localhost:5432/fitforce_old" \
 *   DATABASE_URL="postgresql://fitforce_user:<password>@localhost:5432/fitforce_db" \
 *   npx tsx src/scripts/patch-question-labels.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL  = process.env.DATABASE_URL;

if (!OLD_URL || !NEW_URL) {
  console.error('PG_OLD_URL and DATABASE_URL are both required');
  process.exit(1);
}

const old   = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

function extractLabel(q: Record<string, unknown>): string | null {
  for (const field of ['label', 'text', 'title', 'question', 'name']) {
    const v = q[field];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 500);
  }
  return null;
}

async function main() {
  // Find all questions in new DB that still have the migration default label
  const { rows: stale } = await newDb.query<{ id: string; form_id: string }>(
    `SELECT id, form_id FROM form_questions WHERE label_en = 'Question'`
  );

  if (stale.length === 0) {
    console.log('patch-question-labels: no stale questions found — nothing to do');
    return;
  }

  console.log(`patch-question-labels: ${stale.length} questions with label_en = 'Question'`);

  // Group by form_id so we only query each FormTemplate once
  const formToQIds = new Map<string, Set<string>>();
  for (const r of stale) {
    if (!formToQIds.has(r.form_id)) formToQIds.set(r.form_id, new Set());
    formToQIds.get(r.form_id)!.add(r.id);
  }

  console.log(`patch-question-labels: affects ${formToQIds.size} forms`);

  // Pull old FormTemplate questions for each form
  const { rows: templates } = await old.query<{
    id: string;
    questions: Array<Record<string, unknown>>;
  }>(
    `SELECT id, questions FROM public."FormTemplate"
     WHERE id = ANY($1)`,
    [Array.from(formToQIds.keys())]
  );

  // Build patch map: questionId → label text
  const patches = new Map<string, string>();

  for (const t of templates) {
    const qIds = formToQIds.get(t.id);
    if (!qIds) continue;

    const questions = Array.isArray(t.questions) ? t.questions : [];
    for (const q of questions) {
      const qId = q.id as string | undefined;
      if (!qId || !qIds.has(qId)) continue;

      const label = extractLabel(q);
      if (label) patches.set(qId, label);
    }
  }

  console.log(`patch-question-labels: recovered ${patches.size} labels from old DB`);

  if (patches.size === 0) {
    console.log('patch-question-labels: no labels recoverable — old forms may use unknown field names');
    // Print a sample to help diagnose
    if (templates.length > 0) {
      const sample = Array.isArray(templates[0].questions) ? templates[0].questions[0] : null;
      console.log('sample question fields:', sample ? Object.keys(sample) : 'none');
    }
    return;
  }

  // Apply patches in one batched UPDATE
  const ids    = Array.from(patches.keys());
  const labels = Array.from(patches.values());

  // Build VALUES list: (id, label) pairs
  const vals: unknown[] = [];
  const placeholders = ids.map((id, i) => {
    vals.push(id, labels[i]);
    return `($${i * 2 + 1}::text, $${i * 2 + 2}::text)`;
  });

  const result = await newDb.query(`
    UPDATE form_questions fq
    SET label_en = v.label
    FROM (VALUES ${placeholders.join(',')}) AS v(id, label)
    WHERE fq.id = v.id
  `, vals);

  console.log(`patch-question-labels: updated ${result.rowCount} questions`);

  // Report how many are still stale (unrecoverable)
  const remaining = stale.length - (result.rowCount ?? 0);
  if (remaining > 0) {
    console.log(`patch-question-labels: ${remaining} questions remain as 'Question' (question IDs not found in old DB or no label field)`);
  }
}

main().catch(err => {
  console.error('patch-question-labels FAILED:', err);
  process.exit(1);
}).finally(async () => {
  await old.end();
  await newDb.end();
});
