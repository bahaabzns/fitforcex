/**
 * Data migration: old FitForce DB → FitForce X
 *
 * Usage (from server/):
 *   PG_OLD_URL="postgresql://postgres:<pass>@localhost:5432/fitforce_old" \
 *   DATABASE_URL="postgresql://postgres:<pass>@localhost:5432/fitforce_db" \
 *   npx tsx src/scripts/migrate.ts
 *
 * Idempotent — safe to re-run. Skips rows that already exist.
 */

import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

const OLD_URL = process.env.PG_OLD_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const prisma = new PrismaClient();

const BATCH = 500;

// ─── helpers ────────────────────────────────────────────────────────────────

function splitName(full: string, last?: string | null): { fname: string; lname: string } {
  if (last) return { fname: full.trim(), lname: last.trim() };
  const idx = full.trim().indexOf(' ');
  if (idx === -1) return { fname: full.trim(), lname: '' };
  return { fname: full.slice(0, idx).trim(), lname: full.slice(idx + 1).trim() };
}

const VALID_QUESTION_TYPES = new Set(['text','long_text','number','scale','select','multiselect','date']);
function mapQuestionType(t?: string): string {
  if (!t) return 'text';
  const n = t.toLowerCase();
  if (n === 'textarea' || n === 'long_text' || n === 'paragraph') return 'long_text';
  if (n === 'number' || n === 'numeric' || n === 'integer' || n === 'float') return 'number';
  if (n === 'scale' || n === 'rating' || n === 'slider') return 'scale';
  if (n === 'select' || n === 'dropdown' || n === 'radio' || n === 'choice') return 'select';
  if (n === 'multiselect' || n === 'checkbox' || n === 'multi') return 'multiselect';
  if (n === 'date' || n === 'datetime') return 'date';
  if (VALID_QUESTION_TYPES.has(n)) return n;
  return 'text';
}

function mapRole(oldName: string): string {
  const n = oldName.toLowerCase();
  if (n.includes('trainer') || n.includes('coach')) return 'trainer';
  if (n.includes('nutritionist') || n.includes('nutrition')) return 'nutritionist';
  if (n.includes('receptionist') || n.includes('reception')) return 'receptionist';
  if (n.includes('viewer') || n.includes('view')) return 'viewer';
  return 'manager';
}

async function inBatches<T>(rows: T[], fn: (batch: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await fn(rows.slice(i, i + BATCH));
  }
}

function log(msg: string) { console.log(`[migrate] ${msg}`); }

// ─── users ───────────────────────────────────────────────────────────────────

async function migrateUsers() {
  const { rows } = await old.query<{
    id: string; email: string; passwordHash: string;
    fullName: string; lastName: string | null; phoneNumber: string | null;
    emailVerified: boolean; emailVerificationCode: string | null;
    verificationCodeExpiresAt?: string | null; createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, email, "passwordHash", "fullName", "lastName", "phoneNumber",
           "emailVerified", "emailVerificationCode",
           "emailVerificationCodeExpiresAt" AS "verificationCodeExpiresAt",
           "createdAt", "deletedAt"
    FROM public."User"
    WHERE "deletedAt" IS NULL
  `);

  await inBatches(rows, async (batch) => {
    await prisma.users.createMany({
      data: batch.map(u => {
        const { fname, lname } = splitName(u.fullName, u.lastName);
        return {
          id: u.id,
          email: u.email.toLowerCase().trim().slice(0, 150),
          password: u.passwordHash,
          fname: fname.slice(0, 100),
          lname: lname.slice(0, 100),
          phone: u.phoneNumber ?? undefined,
          email_verified: u.emailVerified,
          email_verification_code: u.emailVerificationCode ?? undefined,
          verification_code_expires_at: u.verificationCodeExpiresAt ? new Date(u.verificationCodeExpiresAt) : undefined,
          created_at: new Date(u.createdAt),
        };
      }),
      skipDuplicates: true,
    });
  });

  log(`users: ${rows.length} migrated`);
}

// ─── workspaces ──────────────────────────────────────────────────────────────

async function migrateWorkspaces() {
  const { rows } = await old.query<{
    id: string; name: string; subdomain: string; ownerId: string;
    createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, name, subdomain, "ownerId", "createdAt", "deletedAt"
    FROM public."Workspace"
    WHERE "deletedAt" IS NULL
      AND "ownerId" IN (SELECT id FROM public."User" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(rows, async (batch) => {
    await prisma.workspaces.createMany({
      data: batch.map(w => ({
        id: w.id,
        name: w.name,
        slug: w.subdomain,
        owner_id: w.ownerId,
        created_at: new Date(w.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`workspaces: ${rows.length} migrated`);
}

// ─── workspace members ────────────────────────────────────────────────────────

async function migrateWorkspaceMembers() {
  const { rows } = await old.query<{
    id: string; workspaceId: string; userId: string;
    roleName: string; createdAt: string; deletedAt: string | null;
  }>(`
    SELECT wm.id, wm."workspaceId", wm."userId",
           COALESCE(r.name, 'member') AS "roleName", wm."createdAt", wm."deletedAt"
    FROM public."WorkspaceMember" wm
    LEFT JOIN public."Role" r ON r.id = wm."roleId"
    WHERE wm."deletedAt" IS NULL
      AND wm."workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
      AND wm."userId" IN (SELECT id FROM public."User" WHERE "deletedAt" IS NULL)
  `);

  // Also migrate the workspace owner as a member if not already in WorkspaceMember
  const ownerRows = await old.query<{ workspaceId: string; ownerId: string; createdAt: string }>(`
    SELECT w.id AS "workspaceId", w."ownerId", w."createdAt"
    FROM public."Workspace" w
    WHERE w."deletedAt" IS NULL
      AND w."ownerId" IN (SELECT id FROM public."User" WHERE "deletedAt" IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM public."WorkspaceMember" wm
        WHERE wm."workspaceId" = w.id AND wm."userId" = w."ownerId" AND wm."deletedAt" IS NULL
      )
  `);

  await inBatches(rows, async (batch) => {
    await prisma.workspace_members.createMany({
      data: batch.map(m => ({
        id: m.id,
        workspace_id: m.workspaceId,
        user_id: m.userId,
        role: mapRole(m.roleName),
        joined_at: new Date(m.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  // Insert owners as manager if missing
  if (ownerRows.rows.length) {
    const { createId } = await import('@paralleldrive/cuid2');
    await prisma.workspace_members.createMany({
      data: ownerRows.rows.map(o => ({
        id: createId(),
        workspace_id: o.workspaceId,
        user_id: o.ownerId,
        role: 'manager',
        joined_at: new Date(o.createdAt),
      })),
      skipDuplicates: true,
    });
  }

  log(`workspace_members: ${rows.length + ownerRows.rows.length} migrated`);
}

// ─── clients ──────────────────────────────────────────────────────────────────

async function migrateClients() {
  const { rows } = await old.query<{
    id: string; workspaceId: string; fullName: string; email: string | null;
    phone: string | null; phoneCountryCode: string | null; status: string;
    code: number; password: string | null;
    createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", "fullName", email, phone, "phoneCountryCode",
           status, code, password, "createdAt", "deletedAt"
    FROM public."Client"
    WHERE "deletedAt" IS NULL
      AND "workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(rows, async (batch) => {
    await prisma.clients.createMany({
      data: batch.map(c => {
        const { fname, lname } = splitName(c.fullName);
        const phone = c.phoneCountryCode && c.phone
          ? `${c.phoneCountryCode}${c.phone}`
          : c.phone ?? undefined;
        return {
          id: c.id,
          workspace_id: c.workspaceId,
          fname: fname.slice(0, 100),
          lname: lname.slice(0, 100),
          email: (c.email ?? `client_${c.id}@migrated.local`).slice(0, 150),
          phone: phone ? phone.replace(/\s+/g, '').slice(0, 20) : undefined,
          subscription_status: c.status,
          client_code: c.code,
          password: c.password ?? undefined,
          created_at: new Date(c.createdAt),
        };
      }),
      skipDuplicates: true,
    });
  });

  log(`clients: ${rows.length} migrated`);
}

// ─── food items ───────────────────────────────────────────────────────────────

async function migrateFoodItems() {
  const { rows } = await old.query<{
    id: string; workspaceId: string; name: string; nameArabic: string | null;
    category: string | null; servingSize: number | null; unit: string | null;
    calories: number; protein: number; carbs: number; fat: number;
    createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", name, "nameArabic", category, "servingSize", unit,
           calories, protein, carbs, fat, "createdAt", "deletedAt"
    FROM public."FoodItem"
    WHERE "deletedAt" IS NULL
  `);

  await inBatches(rows, async (batch) => {
    await prisma.food_items.createMany({
      data: batch.map(f => ({
        id: f.id,
        workspace_id: f.workspaceId,
        name_en: f.name,
        name_ar: f.nameArabic ?? undefined,
        food_category: f.category ?? undefined,
        serving_size: f.servingSize ?? undefined,
        serving_unit: f.unit ?? undefined,
        calories_per_serving: f.calories,
        protein_per_serving: f.protein,
        carbs_per_serving: f.carbs,
        fats_per_serving: f.fat,
      })),
      skipDuplicates: true,
    });
  });

  log(`food_items: ${rows.length} migrated`);
}

// ─── exercise library ─────────────────────────────────────────────────────────

async function migrateExerciseLibrary() {
  const { rows } = await old.query<{
    id: string; workspaceId: string; name: string; nameArabic: string | null;
    muscleGroup: string; equipmentNeeded: string | null;
    videoUrl: string | null; createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", name, "nameArabic", "muscleGroup",
           "equipmentNeeded", "videoUrl", "createdAt", "deletedAt"
    FROM public."Exercise"
    WHERE "deletedAt" IS NULL
      AND "workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(rows, async (batch) => {
    await prisma.exercise_library.createMany({
      data: batch.map(e => ({
        id: e.id,
        workspace_id: e.workspaceId,
        name_en: e.name,
        name_ar: e.nameArabic ?? undefined,
        muscle_group: e.muscleGroup,
        equipment: e.equipmentNeeded ?? undefined,
        youtube_url: e.videoUrl ?? undefined,
        created_at: new Date(e.createdAt),
        updated_at: new Date(e.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`exercise_library: ${rows.length} migrated`);
}

// ─── nutrition plans ──────────────────────────────────────────────────────────

async function migrateNutritionPlans() {
  // Plans
  const { rows: plans } = await old.query<{
    id: string; workspaceId: string; clientId: string; title: string;
    status: string; createdAt: string; updatedAt: string;
    activatedAt: string | null; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", "clientId", title, status,
           "createdAt", "updatedAt", "activatedAt", "deletedAt"
    FROM public."NutritionPlan"
    WHERE "deletedAt" IS NULL
      AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(plans, async (batch) => {
    await prisma.nutrition_plans.createMany({
      data: batch.map(p => ({
        id: p.id,
        name: p.title,
        workspace_id: p.workspaceId,
        client_id: p.clientId,
        status: p.status,
        created_at: new Date(p.createdAt),
        updated_at: new Date(p.updatedAt),
        activated_at: p.activatedAt ? new Date(p.activatedAt) : undefined,
      })),
      skipDuplicates: true,
    });
  });

  // Days → cycles (one cycle per plan day)
  const { rows: days } = await old.query<{
    id: string; planId: string; dayIndex: number; label: string | null;
    deletedAt: string | null;
  }>(`
    SELECT id, "planId", "dayIndex", label, "deletedAt"
    FROM public."NutritionPlanDay"
    WHERE "deletedAt" IS NULL
      AND "planId" IN (
        SELECT id FROM public."NutritionPlan"
        WHERE "deletedAt" IS NULL
          AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
      )
  `);

  await inBatches(days, async (batch) => {
    await prisma.nutrition_cycles.createMany({
      data: batch.map(d => ({
        id: d.id,
        plan_id: d.planId,
        name: d.label || `Day ${d.dayIndex + 1}`,
        cycle_order: d.dayIndex + 1,
      })),
      skipDuplicates: true,
    });
  });

  // Day items → meals (each meal slot within a day)
  const { rows: dayItems } = await old.query<{
    id: string; dayId: string; meal: string | null; notes: string | null;
    mealOrder: number; deletedAt: string | null;
  }>(`
    SELECT id, "dayId", meal, notes,
           ROW_NUMBER() OVER (PARTITION BY "dayId" ORDER BY "createdAt") AS "mealOrder",
           "deletedAt"
    FROM public."NutritionPlanDayItem"
    WHERE "deletedAt" IS NULL
      AND "dayId" IN (
        SELECT id FROM public."NutritionPlanDay"
        WHERE "deletedAt" IS NULL
          AND "planId" IN (
            SELECT id FROM public."NutritionPlan"
            WHERE "deletedAt" IS NULL
              AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
          )
      )
  `);

  await inBatches(dayItems, async (batch) => {
    await prisma.nutrition_meals.createMany({
      data: batch.map(m => ({
        id: m.id,
        cycle_id: m.dayId,
        name: m.meal || 'Meal',
        meal_order: Number(m.mealOrder),
        note: m.notes ?? undefined,
      })),
      skipDuplicates: true,
    });
  });

  // Meal food items
  const { rows: mealItems } = await old.query<{
    id: string; mealId: string; foodItemId: string; quantity: number;
    itemOrder: number; deletedAt: string | null;
  }>(`
    SELECT id, "mealId", "foodItemId", quantity,
           ROW_NUMBER() OVER (PARTITION BY "mealId" ORDER BY "createdAt") AS "itemOrder",
           "deletedAt"
    FROM public."MealFoodItem"
    WHERE "deletedAt" IS NULL
      AND "mealId" IN (
        SELECT id FROM public."NutritionPlanDayItem"
        WHERE "deletedAt" IS NULL
          AND "dayId" IN (
            SELECT id FROM public."NutritionPlanDay"
            WHERE "deletedAt" IS NULL
              AND "planId" IN (
                SELECT id FROM public."NutritionPlan"
                WHERE "deletedAt" IS NULL
                  AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
              )
          )
      )
      AND "foodItemId" IN (SELECT id FROM public."FoodItem" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(mealItems, async (batch) => {
    await prisma.nutrition_meal_items.createMany({
      data: batch.map(i => ({
        id: i.id,
        meal_id: i.mealId,
        food_item_id: i.foodItemId,
        amount: i.quantity,
        meal_item_order: Number(i.itemOrder),
      })),
      skipDuplicates: true,
    });
  });

  log(`nutrition_plans: ${plans.length} plans, ${days.length} cycles, ${dayItems.length} meals, ${mealItems.length} items`);
}

// ─── training (workout) plans ─────────────────────────────────────────────────

async function migrateTrainingPlans() {
  // Plans
  const { rows: plans } = await old.query<{
    id: string; workspaceId: string; clientId: string; title: string;
    status: string; createdAt: string; updatedAt: string;
    activatedAt: string | null; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", "clientId", title, status,
           "createdAt", "updatedAt", "activatedAt", "deletedAt"
    FROM public."WorkoutPlan"
    WHERE "deletedAt" IS NULL
      AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(plans, async (batch) => {
    await prisma.training_plans.createMany({
      data: batch.map(p => ({
        id: p.id,
        name: p.title,
        workspace_id: p.workspaceId,
        client_id: p.clientId,
        status: p.status === 'active' ? 'active' : 'inactive',
        created_at: new Date(p.createdAt),
        updated_at: new Date(p.updatedAt),
        activated_at: p.activatedAt ? new Date(p.activatedAt) : undefined,
      })),
      skipDuplicates: true,
    });
  });

  // Days
  const { rows: days } = await old.query<{
    id: string; planId: string; dayIndex: number; label: string | null;
    deletedAt: string | null;
  }>(`
    SELECT id, "planId", "dayIndex", label, "deletedAt"
    FROM public."WorkoutPlanDay"
    WHERE "deletedAt" IS NULL
      AND "planId" IN (
        SELECT id FROM public."WorkoutPlan"
        WHERE "deletedAt" IS NULL
          AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
      )
  `);

  await inBatches(days, async (batch) => {
    await prisma.training_days.createMany({
      data: batch.map(d => ({
        id: d.id,
        plan_id: d.planId,
        name: d.label || `Day ${d.dayIndex + 1}`,
        day_order: d.dayIndex + 1,
      })),
      skipDuplicates: true,
    });
  });

  // Day items → training exercises
  const { rows: exercises } = await old.query<{
    id: string; dayId: string; exerciseId: string; exerciseName: string;
    notes: string | null; durationSeconds: number | null; isCardio: boolean;
    exerciseOrder: number; deletedAt: string | null;
  }>(`
    SELECT di.id, di."dayId",
           CASE WHEN e.id IS NOT NULL AND e."deletedAt" IS NULL THEN di."exerciseId" ELSE NULL END AS "exerciseId",
           COALESCE(e.name, 'Exercise') AS "exerciseName",
           di.notes, di."durationSeconds", di."isCardio",
           ROW_NUMBER() OVER (PARTITION BY di."dayId" ORDER BY di."createdAt") AS "exerciseOrder",
           di."deletedAt"
    FROM public."WorkoutPlanDayItem" di
    LEFT JOIN public."Exercise" e ON e.id = di."exerciseId"
    WHERE di."deletedAt" IS NULL
      AND di."dayId" IN (
        SELECT id FROM public."WorkoutPlanDay"
        WHERE "deletedAt" IS NULL
          AND "planId" IN (
            SELECT id FROM public."WorkoutPlan"
            WHERE "deletedAt" IS NULL
              AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
          )
      )
  `);

  await inBatches(exercises, async (batch) => {
    await prisma.training_exercises.createMany({
      data: batch.map(e => ({
        id: e.id,
        day_id: e.dayId,
        name: e.exerciseName,
        exercise_order: Number(e.exerciseOrder),
        exercise_library_id: e.exerciseId,
        notes: e.notes ?? undefined,
      })),
      skipDuplicates: true,
    });
  });

  // Sets
  const { rows: sets } = await old.query<{
    id: string; dayItemId: string; setIndex: number;
    repMin: number | null; repMax: number | null;
    rir: number | null; tempo: string | null;
    restSeconds: number | null; deletedAt: string | null;
  }>(`
    SELECT id, "dayItemId", "setIndex", "repMin", "repMax",
           rir, tempo, "restSeconds", "deletedAt"
    FROM public."WorkoutPlanSet"
    WHERE "deletedAt" IS NULL
      AND "dayItemId" IN (
        SELECT id FROM public."WorkoutPlanDayItem"
        WHERE "deletedAt" IS NULL
          AND "dayId" IN (
            SELECT id FROM public."WorkoutPlanDay"
            WHERE "deletedAt" IS NULL
              AND "planId" IN (
                SELECT id FROM public."WorkoutPlan"
                WHERE "deletedAt" IS NULL
                  AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
              )
          )
      )
  `);

  await inBatches(sets, async (batch) => {
    await prisma.training_sets.createMany({
      data: batch.map(s => {
        const reps = s.repMin !== null && s.repMax !== null && s.repMin !== s.repMax
          ? `${s.repMin}-${s.repMax}`
          : s.repMin !== null ? String(s.repMin) : null;
        return {
          id: s.id,
          exercise_id: s.dayItemId,
          set_order: s.setIndex,
          reps: reps ?? undefined,
          rir: s.rir ?? undefined,
          tempo: s.tempo ?? undefined,
          rest_seconds: s.restSeconds ?? undefined,
        };
      }),
      skipDuplicates: true,
    });
  });

  log(`training_plans: ${plans.length} plans, ${days.length} days, ${exercises.length} exercises, ${sets.length} sets`);
}

// ─── threads & messages ───────────────────────────────────────────────────────

async function migrateMessages() {
  const { rows: threads } = await old.query<{
    id: string; workspaceId: string; clientId: string;
    status: string; createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", "clientId", status, "createdAt", "deletedAt"
    FROM public."Thread"
    WHERE "deletedAt" IS NULL AND "clientId" IS NOT NULL
      AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(threads, async (batch) => {
    await prisma.threads.createMany({
      data: batch.map(t => ({
        id: t.id,
        workspace_id: t.workspaceId,
        client_id: t.clientId,
        status: t.status,
        created_at: new Date(t.createdAt),
        updated_at: new Date(t.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  const { rows: messages } = await old.query<{
    id: string; threadId: string; senderType: string;
    senderUserId: string | null; senderClientId: string | null;
    body: string; readByTeamAt: string | null; readByClientAt: string | null;
    createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "threadId", "senderType", "senderUserId", "senderClientId",
           body, "readByTeamAt", "readByClientAt", "createdAt", "deletedAt"
    FROM public."Message"
    WHERE "deletedAt" IS NULL
      AND "threadId" IN (
        SELECT id FROM public."Thread"
        WHERE "deletedAt" IS NULL
          AND "clientId" IS NOT NULL
          AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
      )
  `);

  await inBatches(messages, async (batch) => {
    await prisma.messages.createMany({
      data: batch.map(m => ({
        id: m.id,
        thread_id: m.threadId,
        sender_type: m.senderType,
        sender_id: m.senderUserId ?? m.senderClientId ?? 'unknown',
        body: m.body,
        read_by_team_at: m.readByTeamAt ? new Date(m.readByTeamAt) : undefined,
        read_by_client_at: m.readByClientAt ? new Date(m.readByClientAt) : undefined,
        created_at: new Date(m.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`threads: ${threads.length}, messages: ${messages.length} migrated`);
}

// ─── workout logs ─────────────────────────────────────────────────────────────

async function migrateWorkoutLogs() {
  const { rows } = await old.query<{
    id: string; workspaceId: string; clientId: string; planId: string;
    dayIndex: number; date: string; startTime: string | null;
    endTime: string | null; notes: string | null; completed: boolean;
    exercises: unknown; createdAt: string; deletedAt: string | null;
  }>(`
    SELECT wl.id, wl."workspaceId", wl."clientId",
           CASE WHEN p.id IS NOT NULL AND p."deletedAt" IS NULL THEN wl."planId" ELSE NULL END AS "planId",
           wl."dayIndex", wl.date, wl."startTime", wl."endTime",
           wl.notes, wl.completed, wl.exercises, wl."createdAt", wl."deletedAt"
    FROM public."WorkoutLog" wl
    LEFT JOIN public."WorkoutPlan" p ON p.id = wl."planId"
    WHERE wl."deletedAt" IS NULL
      AND wl."clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(rows, async (batch) => {
    await prisma.workout_logs.createMany({
      data: batch.map(w => ({
        id: w.id,
        workspace_id: w.workspaceId,
        client_id: w.clientId,
        plan_id: w.planId,
        day_index: w.dayIndex,
        date: new Date(w.date),
        start_time: w.startTime ?? undefined,
        end_time: w.endTime ?? undefined,
        notes: w.notes ?? undefined,
        completed: w.completed,
        exercises: w.exercises as object,
        created_at: new Date(w.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`workout_logs: ${rows.length} migrated`);
}

// ─── client observations ──────────────────────────────────────────────────────

async function migrateClientObservations() {
  const { rows } = await old.query<{
    id: string; workspaceId: string; clientId: string;
    authorId: string; content: string;
    createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", "clientId", "authorId", content, "createdAt", "deletedAt"
    FROM public."ClientObservation"
    WHERE "deletedAt" IS NULL
      AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
      AND "authorId" IN (SELECT id FROM public."User" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(rows, async (batch) => {
    await prisma.client_observations.createMany({
      data: batch.map(o => ({
        id: o.id,
        workspace_id: o.workspaceId,
        client_id: o.clientId,
        author_id: o.authorId,
        content: o.content,
        created_at: new Date(o.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`client_observations: ${rows.length} migrated`);
}

// ─── transactions (from old Payment) ─────────────────────────────────────────

async function migrateTransactions() {
  const { rows } = await old.query<{
    id: string; workspaceId: string; clientId: string | null;
    amountCents: number; currency: string; status: string;
    createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", "clientId", "amountCents", currency, status, "createdAt", "deletedAt"
    FROM public."Payment"
    WHERE "deletedAt" IS NULL AND "clientId" IS NOT NULL
      AND "clientId" IN (SELECT id FROM public."Client" WHERE "deletedAt" IS NULL)
      AND "workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(rows, async (batch) => {
    await prisma.transactions.createMany({
      data: batch.map(p => ({
        id: p.id,
        workspace_id: p.workspaceId,
        client_id: p.clientId ?? undefined,
        client_name: '',
        payment_method: 'paymob',
        amount: p.amountCents / 100,
        currency: p.currency,
        status: p.status === 'succeeded' ? 'completed' : p.status,
        transaction_date: new Date(p.createdAt),
        created_at: new Date(p.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`transactions: ${rows.length} migrated`);
}

// ─── forms ────────────────────────────────────────────────────────────────────

async function migrateForms() {
  const { rows: templates } = await old.query<{
    id: string; workspaceId: string; title: string; titleArabic: string | null;
    type: string; questions: unknown; createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", title, "titleArabic", type, questions, "createdAt", "deletedAt"
    FROM public."FormTemplate"
    WHERE "deletedAt" IS NULL
      AND "workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  // Batch-insert forms
  await inBatches(templates, async (batch) => {
    await prisma.forms.createMany({
      data: batch.map(t => ({
        id: t.id,
        workspace_id: t.workspaceId,
        title_en: t.title.slice(0, 255),
        title_ar: t.titleArabic ? t.titleArabic.slice(0, 255) : undefined,
        form_type: t.type,
        status: 'active',
        created_at: new Date(t.createdAt),
        updated_at: new Date(t.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  // Expand questions JSON → form_questions rows and batch-insert
  const allQuestions: Array<{
    id: string; form_id: string; label_en: string; type: string;
    required: boolean; options: unknown; order_index: number; created_at: Date;
  }> = [];

  for (const t of templates) {
    const questions = Array.isArray(t.questions) ? t.questions as Array<{
      id?: string; label?: string; type?: string; required?: boolean; options?: unknown;
    }> : [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.id) continue;
      allQuestions.push({
        id: q.id,
        form_id: t.id,
        label_en: (q.label ?? 'Question').slice(0, 500),
        type: mapQuestionType(q.type),
        required: q.required ?? false,
        options: q.options ?? undefined,
        order_index: i,
        created_at: new Date(t.createdAt),
      });
    }
  }

  await inBatches(allQuestions, async (batch) => {
    await prisma.form_questions.createMany({
      data: batch,
      skipDuplicates: true,
    });
  });

  log(`forms: ${templates.length} forms, ${allQuestions.length} questions migrated`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.time('migration');

  try {
    log('Starting migration…');

    await migrateUsers();
    await migrateWorkspaces();
    await migrateWorkspaceMembers();
    await migrateClients();
    await migrateFoodItems();
    await migrateExerciseLibrary();
    await migrateNutritionPlans();
    await migrateTrainingPlans();
    await migrateMessages();
    await migrateWorkoutLogs();
    await migrateClientObservations();
    await migrateTransactions();
    await migrateForms();

    log('Migration complete.');
  } catch (err) {
    console.error('[migrate] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await prisma.$disconnect();
    console.timeEnd('migration');
  }
}

main();
