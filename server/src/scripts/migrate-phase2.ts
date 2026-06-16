/**
 * Phase 2 migration: lookup tables + packages + client measurements
 *
 * Steps 1–3 need DATABASE_URL only (reads already-migrated data to build lookup tables).
 * Steps 4–5 also need PG_OLD_URL (fitforce_old access with a superuser/postgres role).
 *
 * Usage (from server/):
 *   # Steps 1–3 only (no old DB needed):
 *   DATABASE_URL="postgresql://fitforce_user:Canyouseeme%40441199@localhost:5433/fitforce_db" \
 *   npx tsx src/scripts/migrate-phase2.ts
 *
 *   # All steps (when old DB access is restored):
 *   PG_OLD_URL="postgresql://postgres:<pass>@localhost:5433/fitforce_old" \
 *   DATABASE_URL="postgresql://fitforce_user:Canyouseeme%40441199@localhost:5433/fitforce_db" \
 *   npx tsx src/scripts/migrate-phase2.ts
 */

import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const OLD_URL = process.env.PG_OLD_URL;
const prisma = new PrismaClient();
const old = OLD_URL ? new Pool({ connectionString: OLD_URL }) : null;
const BATCH = 500;

function log(msg: string) { console.log(`[migrate-p2] ${msg}`); }

async function inBatches<T>(rows: T[], fn: (batch: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await fn(rows.slice(i, i + BATCH));
  }
}

// ─── 1. food_categories ───────────────────────────────────────────────────────
// Extract distinct (workspace_id, food_category) pairs from already-migrated food_items.
// food_categories has no unique constraint on (workspace_id, name_en), so we wipe and
// re-populate to keep the operation idempotent.

async function migrateFoodCategories() {
  await prisma.$executeRaw`TRUNCATE food_categories`;

  const rows = await prisma.$queryRaw<{ workspace_id: string; name_en: string }[]>`
    SELECT DISTINCT workspace_id, food_category AS name_en
    FROM food_items
    WHERE food_category IS NOT NULL
      AND food_category <> ''
      AND workspace_id IS NOT NULL
    ORDER BY workspace_id, name_en
  `;

  await inBatches(rows, async (batch) => {
    await prisma.food_categories.createMany({
      data: batch.map(r => ({
        id: createId(),
        workspace_id: r.workspace_id,
        name_en: r.name_en,
      })),
    });
  });

  log(`food_categories: ${rows.length} distinct categories inserted`);
}

// ─── 2. exercise_muscle_groups ────────────────────────────────────────────────
// Extract distinct (workspace_id, muscle_group) pairs from already-migrated exercise_library.

async function migrateMuscleGroups() {
  const rows = await prisma.$queryRaw<{ workspace_id: string; name_en: string }[]>`
    SELECT DISTINCT workspace_id, muscle_group AS name_en
    FROM exercise_library
    WHERE muscle_group IS NOT NULL
      AND muscle_group <> ''
    ORDER BY workspace_id, name_en
  `;

  await inBatches(rows, async (batch) => {
    await prisma.exercise_muscle_groups.createMany({
      data: batch.map(r => ({
        id: createId(),
        workspace_id: r.workspace_id,
        name_en: r.name_en,
      })),
      skipDuplicates: true,
    });
  });

  log(`exercise_muscle_groups: ${rows.length} distinct groups inserted`);
}

// ─── 3. exercise_equipments ───────────────────────────────────────────────────
// Extract distinct (workspace_id, equipment) pairs from already-migrated exercise_library.

async function migrateEquipments() {
  const rows = await prisma.$queryRaw<{ workspace_id: string; name_en: string }[]>`
    SELECT DISTINCT workspace_id, equipment AS name_en
    FROM exercise_library
    WHERE equipment IS NOT NULL
      AND equipment <> ''
    ORDER BY workspace_id, name_en
  `;

  await inBatches(rows, async (batch) => {
    await prisma.exercise_equipments.createMany({
      data: batch.map(r => ({
        id: createId(),
        workspace_id: r.workspace_id,
        name_en: r.name_en,
      })),
      skipDuplicates: true,
    });
  });

  log(`exercise_equipments: ${rows.length} distinct equipment types inserted`);
}

// ─── 4. packages + package_variations ────────────────────────────────────────
// Old model:
//   ClientPackageTemplate (workspace-scoped, no pricing) → packages
//   ClientPackage (pricing/duration, parentPackageId → template) → package_variations
//
// ClientPackage rows with no parentPackageId are standalone — create a parent package on the fly.

async function migratePackages() {
  if (!old) { log('packages: skipped (PG_OLD_URL not set)'); return; }
  try { await old.query('SELECT 1'); } catch { log('packages: skipped (old DB unreachable — check credentials)'); return; }

  // Step A: ClientPackageTemplate → packages
  const { rows: templates } = await old.query<{
    id: string; workspaceId: string; name: string;
    isActive: boolean; createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", name, "isActive", "createdAt", "deletedAt"
    FROM public."ClientPackageTemplate"
    WHERE "deletedAt" IS NULL
      AND "workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(templates, async (batch) => {
    await prisma.packages.createMany({
      data: batch.map(t => ({
        id: t.id,
        workspace_id: t.workspaceId,
        name: t.name,
        active: t.isActive,
        created_at: new Date(t.createdAt),
        updated_at: new Date(t.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  // Step B: ClientPackage → package_variations
  // Rows with parentPackageId link to a template; rows without get a synthetic parent package.
  const { rows: pkgs } = await old.query<{
    id: string; workspaceId: string; name: string; description: string | null;
    durationMonths: number; priceCents: number; currency: string;
    isActive: boolean; parentPackageId: string | null;
    createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, "workspaceId", name, description, "durationMonths", "priceCents",
           currency, "isActive", "parentPackageId", "createdAt", "deletedAt"
    FROM public."ClientPackage"
    WHERE "deletedAt" IS NULL
      AND "workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  // For standalone packages (no parentPackageId), create a parent package first
  const standalone = pkgs.filter(p => !p.parentPackageId);
  if (standalone.length) {
    await inBatches(standalone, async (batch) => {
      await prisma.packages.createMany({
        data: batch.map(p => ({
          id: `pkg_${p.id}`,
          workspace_id: p.workspaceId,
          name: p.name,
          active: p.isActive,
          created_at: new Date(p.createdAt),
          updated_at: new Date(p.createdAt),
        })),
        skipDuplicates: true,
      });
    });
  }

  await inBatches(pkgs, async (batch) => {
    await prisma.package_variations.createMany({
      data: batch.map(p => ({
        id: p.id,
        package_id: p.parentPackageId ?? `pkg_${p.id}`,
        name: p.name,
        description: p.description ?? undefined,
        duration: p.durationMonths * 30,
        price: p.priceCents / 100,
        currency: p.currency,
        active: p.isActive,
        created_at: new Date(p.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`packages: ${templates.length} templates + ${standalone.length} standalone → packages; ${pkgs.length} variations`);
}

// ─── 5. client_measurements ───────────────────────────────────────────────────
// The old Client table has no measurement columns (height, weight, gender, dob, etc.)
// and there is no separate measurement table in fitforce_old.
// Measurements were not tracked in the old system — nothing to migrate.

async function migrateClientMeasurements() {
  log('client_measurements: skipped (old system had no measurement data)');
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.time('migrate-phase2');
  console.log('FitForce X — Phase 2 Migration');
  console.log(`Old DB: ${OLD_URL ? 'connected' : 'NOT SET — steps 4–5 will be skipped'}`);
  console.log('');

  try {
    await migrateFoodCategories();
    await migrateMuscleGroups();
    await migrateEquipments();
    await migratePackages();
    await migrateClientMeasurements();
    log('Phase 2 complete.');
  } catch (err) {
    console.error('[migrate-p2] FAILED:', err);
    process.exit(1);
  } finally {
    if (old) await old.end();
    await prisma.$disconnect();
    console.timeEnd('migrate-phase2');
  }
}

main();
