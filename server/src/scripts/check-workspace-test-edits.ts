/**
 * Compares one workspace's current fitforce.app state against the fitforce.io snapshot
 * and reports exactly what has been edited or added since migration — read-only, no writes.
 * Built for reverting a specific set of manual test edits made post-migration, without
 * touching the large amount of genuinely real, already-correct data in the same workspace.
 *
 * Usage (from server/):
 *   WORKSPACE_ID="cmikc4x4f04y0mi07ty9ypxww" \
 *   PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *   npx tsx src/scripts/check-workspace-test-edits.ts
 */

import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

const OLD_URL = process.env.PG_OLD_URL;
const WORKSPACE_ID = process.env.WORKSPACE_ID;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!WORKSPACE_ID) { console.error('WORKSPACE_ID is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const prisma = new PrismaClient();

function log(msg: string) { console.log(`[check] ${msg}`); }

async function checkNutritionPlans() {
  const { rows: oldPlans } = await old.query<{ id: string; status: string; activatedAt: string | null }>(`
    SELECT id, status, "activatedAt" FROM public."NutritionPlan" WHERE "workspaceId" = $1
  `, [WORKSPACE_ID]);
  const oldById = new Map(oldPlans.map(p => [p.id, p]));

  const newPlans = await prisma.nutrition_plans.findMany({
    where: { workspace_id: WORKSPACE_ID },
    select: { id: true, name: true, status: true, activated_at: true },
  });

  log(`\n=== nutrition_plans (${newPlans.length} in production for this workspace) ===`);
  for (const p of newPlans) {
    const old = oldById.get(p.id);
    if (!old) {
      log(`  ADDED (no snapshot counterpart): id=${p.id} name="${p.name}" status=${p.status}`);
      continue;
    }
    const oldActivated = old.activatedAt ? new Date(old.activatedAt).toISOString() : null;
    const newActivated = p.activated_at ? p.activated_at.toISOString() : null;
    if (old.status !== p.status || oldActivated !== newActivated) {
      log(`  EDITED: id=${p.id} name="${p.name}" status: ${old.status} -> ${p.status}, activated_at: ${oldActivated} -> ${newActivated}`);
    }
  }
}

async function checkTrainingPlans() {
  const { rows: oldPlans } = await old.query<{ id: string; status: string; activatedAt: string | null }>(`
    SELECT id, status, "activatedAt" FROM public."WorkoutPlan" WHERE "workspaceId" = $1
  `, [WORKSPACE_ID]);
  const oldById = new Map(oldPlans.map(p => [p.id, p]));

  const newPlans = await prisma.training_plans.findMany({
    where: { workspace_id: WORKSPACE_ID },
    select: { id: true, name: true, status: true, activated_at: true },
  });

  log(`\n=== training_plans (${newPlans.length} in production for this workspace) ===`);
  for (const p of newPlans) {
    const old = oldById.get(p.id);
    if (!old) {
      log(`  ADDED (no snapshot counterpart): id=${p.id} name="${p.name}" status=${p.status}`);
      continue;
    }
    const oldStatusNormalized = old.status === 'active' ? 'active' : 'inactive'; // same normalization migrate.ts/catchup used
    const oldActivated = old.activatedAt ? new Date(old.activatedAt).toISOString() : null;
    const newActivated = p.activated_at ? p.activated_at.toISOString() : null;
    if (oldStatusNormalized !== p.status || oldActivated !== newActivated) {
      log(`  EDITED: id=${p.id} name="${p.name}" status: ${oldStatusNormalized} -> ${p.status}, activated_at: ${oldActivated} -> ${newActivated}`);
    }
  }
}

async function checkTransactions() {
  const { rows: oldPayments } = await old.query<{ id: string; amountCents: number; status: string; currency: string }>(`
    SELECT id, "amountCents", status, currency FROM public."Payment" WHERE "workspaceId" = $1
  `, [WORKSPACE_ID]);
  const oldById = new Map(oldPayments.map(p => [p.id, p]));

  const newTx = await prisma.transactions.findMany({
    where: { workspace_id: WORKSPACE_ID },
    select: { id: true, amount: true, status: true, currency: true, payment_method: true, created_at: true },
  });

  log(`\n=== transactions (${newTx.length} in production for this workspace) ===`);
  for (const t of newTx) {
    const old = oldById.get(t.id);
    if (!old) {
      log(`  ADDED (no snapshot counterpart): id=${t.id} amount=${t.amount} status=${t.status} payment_method=${t.payment_method} created_at=${t.created_at.toISOString()}`);
      continue;
    }
    const oldAmount = old.amountCents / 100;
    const oldStatus = old.status === 'succeeded' ? 'completed' : old.status;
    if (Number(t.amount) !== oldAmount || t.status !== oldStatus || t.currency !== old.currency) {
      log(`  EDITED: id=${t.id} amount: ${oldAmount} -> ${t.amount}, status: ${oldStatus} -> ${t.status}, currency: ${old.currency} -> ${t.currency}`);
    }
  }
}

async function checkForms() {
  const { rows: oldForms } = await old.query<{ id: string; title: string; questions: unknown }>(`
    SELECT id, title, questions FROM public."FormTemplate" WHERE "workspaceId" = $1
  `, [WORKSPACE_ID]);
  const oldById = new Map(oldForms.map(f => [f.id, f]));

  const newForms = await prisma.forms.findMany({
    where: { workspace_id: WORKSPACE_ID },
    select: { id: true, title_en: true, current_version_id: true },
  });

  log(`\n=== forms (${newForms.length} in production for this workspace) ===`);
  for (const f of newForms) {
    const old = oldById.get(f.id);
    if (!old) {
      const requestCount = await prisma.form_requests.count({ where: { form_id: f.id } });
      log(`  ADDED (no snapshot counterpart): id=${f.id} title="${f.title_en}" (${requestCount} form_requests reference it)`);
      continue;
    }

    if (!f.current_version_id) {
      log(`  WARNING: id=${f.id} title="${f.title_en}" has no current_version_id at all`);
      continue;
    }

    const currentQuestions = await prisma.form_version_questions.findMany({
      where: { form_version_id: f.current_version_id },
      orderBy: { order_index: 'asc' },
      select: { id: true, label_en: true, type: true, order_index: true },
    });

    const oldQuestions = Array.isArray(old.questions) ? old.questions as Array<{ id?: string; label?: string; text?: string; question?: string; name?: string; type?: string }> : [];

    const version = await prisma.form_versions.findUnique({ where: { id: f.current_version_id }, select: { version_number: true } });
    const isForked = (version?.version_number ?? 1) > 1;

    const countMismatch = currentQuestions.length !== oldQuestions.length;
    let labelMismatch = false;
    for (let i = 0; i < Math.min(currentQuestions.length, oldQuestions.length); i++) {
      const oldLabel = oldQuestions[i].label ?? oldQuestions[i].text ?? oldQuestions[i].question ?? oldQuestions[i].name ?? '';
      if (currentQuestions[i]?.label_en !== oldLabel) { labelMismatch = true; break; }
    }

    if (isForked || countMismatch || labelMismatch) {
      const requestsOnCurrentVersion = await prisma.form_requests.count({ where: { form_version_id: f.current_version_id } });
      log(`  EDITED: id=${f.id} title="${f.title_en}" version_number=${version?.version_number} forked=${isForked} question_count: ${oldQuestions.length} -> ${currentQuestions.length} (${requestsOnCurrentVersion} form_requests reference the current version)`);
    }
  }
}

async function main() {
  try {
    log(`Checking workspace ${WORKSPACE_ID} against fitforce.io snapshot…`);
    await checkNutritionPlans();
    await checkTrainingPlans();
    await checkTransactions();
    await checkForms();
    log('\nDone. Nothing was changed — this is a report only.');
  } finally {
    await old.end();
    await prisma.$disconnect();
  }
}

main();
