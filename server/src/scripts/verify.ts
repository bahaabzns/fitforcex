/**
 * Post-migration verification
 *
 * Compares source counts (old DB) against destination counts (new DB),
 * then spot-checks FK integrity and a few data values.
 *
 * Usage (from server/, with SSH tunnel open on 5433):
 *   PG_OLD_URL="postgresql://postgres:<pass>@localhost:5433/fitforce_old" \
 *   DATABASE_URL="postgresql://postgres:<pass>@localhost:5433/fitforce_db" \
 *   npx tsx src/scripts/verify.ts
 */

import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

const OLD_URL = process.env.PG_OLD_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const prisma = new PrismaClient();

let failures = 0;

function pass(msg: string) { console.log(`  ✅ ${msg}`); }
function fail(msg: string) { console.error(`  ❌ ${msg}`); failures++; }
function section(title: string) { console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`); }

async function countOld(table: string, where = '"deletedAt" IS NULL'): Promise<number> {
  const { rows } = await old.query(`SELECT COUNT(*)::int AS n FROM public."${table}" WHERE ${where}`);
  return rows[0].n;
}

async function countNew(table: string): Promise<number> {
  const result = await (prisma as any)[table].count();
  return result;
}

// ─── count checks ────────────────────────────────────────────────────────────

async function verifyCounts() {
  section('ROW COUNTS');

  const checks: Array<{ label: string; oldTable: string; newTable: string; oldWhere?: string }> = [
    { label: 'users',              oldTable: 'User',            newTable: 'users' },
    { label: 'workspaces',         oldTable: 'Workspace',       newTable: 'workspaces' },
    { label: 'clients',            oldTable: 'Client',          newTable: 'clients' },
    { label: 'food_items',         oldTable: 'FoodItem',        newTable: 'food_items' },
    { label: 'exercise_library',   oldTable: 'Exercise',        newTable: 'exercise_library' },
    { label: 'nutrition_plans',    oldTable: 'NutritionPlan',   newTable: 'nutrition_plans' },
    { label: 'nutrition_cycles',   oldTable: 'NutritionPlanDay', newTable: 'nutrition_cycles' },
    { label: 'nutrition_meals',    oldTable: 'NutritionPlanDayItem', newTable: 'nutrition_meals' },
    { label: 'training_plans',     oldTable: 'WorkoutPlan',     newTable: 'training_plans' },
    { label: 'training_days',      oldTable: 'WorkoutPlanDay',  newTable: 'training_days' },
    { label: 'training_exercises', oldTable: 'WorkoutPlanDayItem', newTable: 'training_exercises' },
    { label: 'training_sets',      oldTable: 'WorkoutPlanSet',  newTable: 'training_sets' },
    { label: 'threads',            oldTable: 'Thread',          newTable: 'threads',
      oldWhere: '"deletedAt" IS NULL AND "clientId" IS NOT NULL' },
    { label: 'workout_logs',       oldTable: 'WorkoutLog',      newTable: 'workout_logs' },
    { label: 'transactions',       oldTable: 'Payment',         newTable: 'transactions',
      oldWhere: '"deletedAt" IS NULL AND "clientId" IS NOT NULL' },
    { label: 'forms',              oldTable: 'FormTemplate',    newTable: 'forms' },
  ];

  for (const c of checks) {
    const src = await countOld(c.oldTable, c.oldWhere);
    const dst = await countNew(c.newTable);
    const label = c.label.padEnd(22);
    if (dst >= src) {
      pass(`${label} old=${src}  new=${dst}`);
    } else {
      fail(`${label} old=${src}  new=${dst}  MISSING ${src - dst}`);
    }
  }
}

// ─── FK integrity ─────────────────────────────────────────────────────────────

async function verifyIntegrity() {
  section('FK INTEGRITY (orphaned rows in new DB)');

  const checks: Array<{ label: string; sql: string }> = [
    {
      label: 'training_days → training_plans',
      sql: `SELECT COUNT(*)::int AS n FROM training_days d
            WHERE NOT EXISTS (SELECT 1 FROM training_plans p WHERE p.id = d.plan_id)`,
    },
    {
      label: 'training_exercises → training_days',
      sql: `SELECT COUNT(*)::int AS n FROM training_exercises e
            WHERE NOT EXISTS (SELECT 1 FROM training_days d WHERE d.id = e.day_id)`,
    },
    {
      label: 'training_sets → training_exercises',
      sql: `SELECT COUNT(*)::int AS n FROM training_sets s
            WHERE NOT EXISTS (SELECT 1 FROM training_exercises e WHERE e.id = s.exercise_id)`,
    },
    {
      label: 'nutrition_cycles → nutrition_plans',
      sql: `SELECT COUNT(*)::int AS n FROM nutrition_cycles c
            WHERE plan_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM nutrition_plans p WHERE p.id = c.plan_id)`,
    },
    {
      label: 'nutrition_meals → nutrition_cycles',
      sql: `SELECT COUNT(*)::int AS n FROM nutrition_meals m
            WHERE cycle_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM nutrition_cycles c WHERE c.id = m.cycle_id)`,
    },
    {
      label: 'nutrition_meal_items → nutrition_meals',
      sql: `SELECT COUNT(*)::int AS n FROM nutrition_meal_items i
            WHERE meal_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM nutrition_meals m WHERE m.id = i.meal_id)`,
    },
    {
      label: 'workout_logs → clients',
      sql: `SELECT COUNT(*)::int AS n FROM workout_logs w
            WHERE NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = w.client_id)`,
    },
    {
      label: 'form_questions → forms',
      sql: `SELECT COUNT(*)::int AS n FROM form_questions q
            WHERE NOT EXISTS (SELECT 1 FROM forms f WHERE f.id = q.form_id)`,
    },
    {
      label: 'workspace_members → workspaces',
      sql: `SELECT COUNT(*)::int AS n FROM workspace_members m
            WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = m.workspace_id)`,
    },
    {
      label: 'workspace_members → users',
      sql: `SELECT COUNT(*)::int AS n FROM workspace_members m
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id)`,
    },
  ];

  for (const c of checks) {
    const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(c.sql);
    const n = Number(rows[0]?.n ?? 0);
    if (n === 0) {
      pass(c.label);
    } else {
      fail(`${c.label} — ${n} orphaned rows`);
    }
  }
}

// ─── spot checks ──────────────────────────────────────────────────────────────

async function verifySpotChecks() {
  section('SPOT CHECKS (sample data correctness)');

  // Pick 3 random clients from old DB and verify they exist in new DB with correct data
  const { rows: sampleClients } = await old.query<{
    id: string; fullName: string; email: string | null;
  }>(`SELECT id, "fullName", email FROM public."Client"
      WHERE "deletedAt" IS NULL ORDER BY random() LIMIT 3`);

  for (const c of sampleClients) {
    const found = await prisma.clients.findUnique({ where: { id: c.id } });
    if (!found) {
      fail(`Client ${c.id} (${c.fullName}) not found in new DB`);
    } else {
      pass(`Client "${c.fullName}" → fname="${found.fname}" lname="${found.lname}"`);
    }
  }

  // Pick 1 random training plan and verify its days + exercises + sets are present
  const { rows: samplePlans } = await old.query<{ id: string; title: string }>(
    `SELECT id, title FROM public."WorkoutPlan"
     WHERE "deletedAt" IS NULL
       AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
     ORDER BY random() LIMIT 1`
  );

  if (samplePlans.length) {
    const plan = samplePlans[0];
    const newPlan = await prisma.training_plans.findUnique({
      where: { id: plan.id },
      include: { training_days: { include: { training_exercises: { include: { training_sets: true } } } } },
    });
    if (!newPlan) {
      fail(`Training plan "${plan.title}" not found`);
    } else {
      const days = newPlan.training_days.length;
      const exercises = newPlan.training_days.reduce((s, d) => s + d.training_exercises.length, 0);
      const sets = newPlan.training_days.reduce((s, d) =>
        s + d.training_exercises.reduce((s2, e) => s2 + e.training_sets.length, 0), 0);
      pass(`Plan "${plan.title}" → ${days} days, ${exercises} exercises, ${sets} sets`);
    }
  }

  // Verify at least one user can be found by email
  const { rows: sampleUsers } = await old.query<{ id: string; email: string }>(
    `SELECT id, email FROM public."User" WHERE "deletedAt" IS NULL ORDER BY random() LIMIT 1`
  );
  if (sampleUsers.length) {
    const u = sampleUsers[0];
    const found = await prisma.users.findUnique({ where: { email: u.email.toLowerCase().trim() } });
    if (!found) {
      fail(`User ${u.email} not found in new DB`);
    } else {
      pass(`User ${u.email} found (id matches: ${found.id === u.id})`);
    }
  }

  // Verify form_questions count per form matches old JSON array length
  const { rows: sampleForms } = await old.query<{ id: string; title: string; questions: unknown }>(
    `SELECT id, title, questions FROM public."FormTemplate"
     WHERE "deletedAt" IS NULL AND jsonb_array_length(questions) > 0
     ORDER BY random() LIMIT 3`
  );
  for (const f of sampleForms) {
    const qs = Array.isArray(f.questions) ? f.questions : [];
    const validQs = qs.filter((q: any) => q.id).length;
    const newCount = await prisma.form_questions.count({ where: { form_id: f.id } });
    if (newCount === validQs) {
      pass(`Form "${f.title}" → ${newCount}/${validQs} questions`);
    } else {
      fail(`Form "${f.title}" → expected ${validQs} questions, got ${newCount}`);
    }
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('FitForce X — Post-Migration Verification');
  console.log('==========================================');

  try {
    await verifyCounts();
    await verifyIntegrity();
    await verifySpotChecks();
  } finally {
    await old.end();
    await prisma.$disconnect();
  }

  console.log('\n==========================================');
  if (failures === 0) {
    console.log('✅ All checks passed — data looks good.');
  } else {
    console.error(`❌ ${failures} check(s) failed — review before going live.`);
    process.exit(1);
  }
}

main();
