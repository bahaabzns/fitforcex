/**
 * Phase 3 migration: workspace billing plans + subscriptions + payments + client packages
 *
 * Steps:
 *   1. WorkspacePackage    → plans
 *   2. WorkspaceSubscription → update workspace_subscriptions (real plan/status/dates)
 *   3. WorkspacePayment    → workspace_payments
 *   4. ClientPackageTemplate + ClientPackage → packages + package_variations
 *
 * Usage (from server/):
 *   PG_OLD_URL="postgresql://fitforce_user:<password>@localhost:5432/fitforce_old" \
 *   DATABASE_URL="postgresql://fitforce_user:<password>@localhost:5432/fitforce_db" \
 *   npx tsx src/scripts/migrate-phase3.ts
 */

import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';

const OLD_URL = process.env.PG_OLD_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }

const prisma = new PrismaClient();
const old = new Pool({ connectionString: OLD_URL });
const BATCH = 500;

function log(msg: string) { console.log(`[migrate-p3] ${msg}`); }

async function inBatches<T>(rows: T[], fn: (batch: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await fn(rows.slice(i, i + BATCH));
  }
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── 1. WorkspacePackage → plans ──────────────────────────────────────────────
// These are FitForce platform subscription plans coaches buy. Migrate all rows
// (including inactive) since payments reference them.

async function migratePlans() {
  const { rows } = await old.query<{
    id: string; name: string; description: string | null;
    durationMonths: number; priceCents: number; currency: string;
    isActive: boolean; teamMembersLimit: number | null;
    features: unknown; createdAt: string;
  }>(`SELECT id, name, description, "durationMonths", "priceCents", currency,
             "isActive", "teamMembersLimit", features, "createdAt"
      FROM public."WorkspacePackage"
      ORDER BY "createdAt"`);

  await inBatches(rows, async (batch) => {
    await prisma.plans.createMany({
      data: batch.map((p, i) => ({
        id:              p.id,
        name:            toSlug(p.name) || p.id,
        display_name:    p.name,
        duration_days:   p.durationMonths > 0 ? p.durationMonths * 30 : 30,
        price_monthly:   p.priceCents / 100,
        currency:        p.currency,
        is_active:       p.isActive,
        max_team_seats:  p.teamMembersLimit ?? null,
        features:        (p.features as object) ?? [],
        sort_order:      i,
        show_on_landing: false,
        cta_text:        'Get Started',
        cta_variant:     'outline',
        features_header: "What's included:",
        created_at:      new Date(p.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`plans: ${rows.length} workspace packages migrated`);
}

// ─── 2. WorkspaceSubscription → workspace_subscriptions ──────────────────────
// One subscription per workspace — take the current active/pre_start one
// (lowest queuePosition, non-deleted) and update the existing row.

async function migrateWorkspaceSubscriptions() {
  const { rows } = await old.query<{
    workspaceId: string; packageId: string; status: string;
    startDate: string | null; endDate: string | null; createdAt: string;
  }>(`
    SELECT DISTINCT ON ("workspaceId")
      "workspaceId", "packageId", status, "startDate", "endDate", "createdAt"
    FROM public."WorkspaceSubscription"
    WHERE "deletedAt" IS NULL
    ORDER BY "workspaceId", "queuePosition" ASC NULLS LAST, "createdAt" DESC
  `);

  let updated = 0;
  for (const sub of rows) {
    const result = await prisma.workspace_subscriptions.updateMany({
      where: { workspace_id: sub.workspaceId },
      data: {
        plan_id:    sub.packageId,
        status:     sub.status,
        starts_at:  sub.startDate ? new Date(sub.startDate) : new Date(sub.createdAt),
        expires_at: sub.endDate   ? new Date(sub.endDate)   : undefined,
      },
    });
    if (result.count > 0) updated++;
  }

  log(`workspace_subscriptions: ${updated}/${rows.length} updated with real plan/status/dates`);
}

// ─── 3. WorkspacePayment → workspace_payments ─────────────────────────────────

async function migrateWorkspacePayments() {
  const { rows } = await old.query<{
    id: string; workspaceId: string; packageId: string;
    amountCents: number; currency: string; status: string;
    providerRef: string | null; createdAt: string;
    promoDiscountCents: number; durationMonths: number;
  }>(`
    SELECT wp.id, wp."workspaceId", wp."packageId",
           wp."amountCents", wp.currency, wp.status,
           wp."providerRef", wp."createdAt",
           wp."promoDiscountCents",
           COALESCE(pkg."durationMonths", 1) AS "durationMonths"
    FROM public."WorkspacePayment" wp
    LEFT JOIN public."WorkspacePackage" pkg ON pkg.id = wp."packageId"
    WHERE wp."deletedAt" IS NULL
      AND wp."workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(rows, async (batch) => {
    await prisma.workspace_payments.createMany({
      data: batch.map(p => ({
        id:                   p.id,
        workspace_id:         p.workspaceId,
        plan_id:              p.packageId,
        amount:               p.amountCents / 100,
        currency:             p.currency,
        duration_days:        p.durationMonths > 0 ? p.durationMonths * 30 : 30,
        fawaterak_status:     p.status === 'paid' ? 'paid' : p.status === 'failed' ? 'failed' : 'pending',
        fawaterak_invoice_id: p.providerRef ?? undefined,
        paid_at:              p.status === 'paid' ? new Date(p.createdAt) : undefined,
        notes:                p.promoDiscountCents > 0
                                ? `Promo discount: ${p.promoDiscountCents / 100} ${p.currency}`
                                : undefined,
        created_at:           new Date(p.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`workspace_payments: ${rows.length} billing records migrated`);
}

// ─── 4. ClientPackageTemplate + ClientPackage → packages + package_variations ──
// Coaching service packages coaches sell to their clients.

async function migrateClientPackages() {
  // Step A: templates → packages
  const { rows: templates } = await old.query<{
    id: string; workspaceId: string; name: string;
    isActive: boolean; createdAt: string;
  }>(`
    SELECT id, "workspaceId", name, "isActive", "createdAt"
    FROM public."ClientPackageTemplate"
    WHERE "deletedAt" IS NULL
      AND "workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  await inBatches(templates, async (batch) => {
    await prisma.packages.createMany({
      data: batch.map(t => ({
        id:           t.id,
        workspace_id: t.workspaceId,
        name:         t.name,
        active:       t.isActive,
        created_at:   new Date(t.createdAt),
        updated_at:   new Date(t.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  // Step B: pricing variations → package_variations
  const { rows: pkgs } = await old.query<{
    id: string; workspaceId: string; name: string; description: string | null;
    durationMonths: number; priceCents: number; currency: string;
    isActive: boolean; parentPackageId: string | null; createdAt: string;
  }>(`
    SELECT id, "workspaceId", name, description, "durationMonths", "priceCents",
           currency, "isActive", "parentPackageId", "createdAt"
    FROM public."ClientPackage"
    WHERE "deletedAt" IS NULL
      AND "workspaceId" IN (SELECT id FROM public."Workspace" WHERE "deletedAt" IS NULL)
  `);

  // Standalone packages (no parentPackageId) need a synthetic parent
  const standalone = pkgs.filter(p => !p.parentPackageId);
  if (standalone.length) {
    await inBatches(standalone, async (batch) => {
      await prisma.packages.createMany({
        data: batch.map(p => ({
          id:           `pkg_${p.id}`,
          workspace_id: p.workspaceId,
          name:         p.name,
          active:       p.isActive,
          created_at:   new Date(p.createdAt),
          updated_at:   new Date(p.createdAt),
        })),
        skipDuplicates: true,
      });
    });
  }

  await inBatches(pkgs, async (batch) => {
    await prisma.package_variations.createMany({
      data: batch.map(p => ({
        id:           p.id,
        package_id:   p.parentPackageId ?? `pkg_${p.id}`,
        name:         p.name,
        description:  p.description ?? undefined,
        duration:     p.durationMonths * 30,
        price:        p.priceCents / 100,
        currency:     p.currency,
        active:       p.isActive,
        created_at:   new Date(p.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  log(`client packages: ${templates.length} templates, ${standalone.length} synthetic parents, ${pkgs.length} variations`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.time('migrate-phase3');
  console.log('FitForce X — Phase 3 Migration');
  console.log(`Old DB: ${OLD_URL}`);
  console.log('');

  try {
    await migratePlans();
    await migrateWorkspaceSubscriptions();
    await migrateWorkspacePayments();
    await migrateClientPackages();
    log('Phase 3 complete.');
  } catch (err) {
    console.error('[migrate-p3] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await prisma.$disconnect();
    console.timeEnd('migrate-phase3');
  }
}

main();
