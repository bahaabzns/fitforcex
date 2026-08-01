/**
 * One-time production cutover — cleans up the legacy ad-hoc plan catalog and migrates
 * specific real workspaces onto the new Free/OneForce/TeamForce/Enterprise model, per
 * decisions made workspace-by-workspace (see conversation history for the reasoning behind
 * each one — this script is intentionally not generic/reusable, it encodes those exact
 * decisions).
 *
 * MUST run AFTER:
 *   1. deploy.sh has applied all migrations (schema for variations/add-ons/trial settings)
 *   2. seed-pricing-plans.ts has created Free/OneForce/TeamForce/Enterprise + their variations
 *
 * Safe to re-run: every step is idempotent (plan cleanup checked by current state; workspace
 * migrations just re-set the same target plan/variation if run twice). Uses the same
 * downgrade-guard check the app itself uses before each workspace migration, as a safety net
 * against a typo in this script putting a workspace over a limit it doesn't fit.
 *
 * Usage (from server/, on the production box, AFTER steps 1-2 above):
 *   npx dotenv -e .env -- npx tsx src/scripts/migrate-legacy-production-plans.ts
 */

import { PrismaClient } from '@prisma/client';
import { checkVariationSwitchAllowed } from '../lib/planVariationSwitch';

const prisma = new PrismaClient();

// ── 1. Plan catalog cleanup ────────────────────────────────────────────────────

async function cleanupLegacyPlans() {
    const renamed = await prisma.plans.updateMany({
        where: { name: 'one' },
        data:  { display_name: 'Legacy OneForce', is_active: false },
    });
    console.info(`[Cutover] renamed/deactivated "one" → "Legacy OneForce": ${renamed.count} row(s)`);

    const deactivated = await prisma.plans.updateMany({
        where: { name: { in: ['free-trial', '1-month', 'team-1-month', 'enterprise-1-month', 'custom-1-months'] } },
        data:  { is_active: false },
    });
    console.info(`[Cutover] deactivated 5 dead legacy plans: ${deactivated.count} row(s)`);

    const deleted = await prisma.plans.deleteMany({
        where: { name: { in: ['testing', 'custom-4-months', 'custom-3-months', '3-months-team'] } },
    });
    console.info(`[Cutover] deleted 4 zero-usage plans: ${deleted.count} row(s)`);
}

// ── 2. Workspace-level migrations ──────────────────────────────────────────────

type Migration = { workspaceSlug: string; targetPlan: string; targetMaxClients: number | null };

const MIGRATIONS: Migration[] = [
    // custom-12-months small/comped accounts → Free (3-client cap; each has 1 client except
    // "hul", handled separately below since 5 clients doesn't fit Free).
    { workspaceSlug: 'eyad',   targetPlan: 'free', targetMaxClients: 3 },
    { workspaceSlug: 'you',    targetPlan: 'free', targetMaxClients: 3 },
    { workspaceSlug: '123456', targetPlan: 'free', targetMaxClients: 3 },
    { workspaceSlug: 'hassannajeb', targetPlan: 'free', targetMaxClients: 3 },
    // custom-30-months, 3 clients → Free (fits exactly at the cap).
    { workspaceSlug: 'ziad', targetPlan: 'free', targetMaxClients: 3 },
    // "hul" (Hossam Hassan) has 5 clients — doesn't fit Free's 3-client cap, goes to
    // OneForce instead (100-client cap) rather than force-overriding Free.
    { workspaceSlug: 'hul', targetPlan: 'oneforce', targetMaxClients: 100 },
    // offer-4-months-2500, active, 7 clients → fits comfortably under OneForce.
    { workspaceSlug: 'zdoc', targetPlan: 'oneforce', targetMaxClients: 100 },
    // growth-250, exactly 250 clients → TeamForce's matching 250-client variation.
    { workspaceSlug: 'fitsavior-com', targetPlan: 'teamforce', targetMaxClients: 250 },
    // custom-6-months, 2656 clients → TeamForce's 5000-client/20-seat variation (smallest
    // tier that fits).
    { workspaceSlug: 'belghamdi', targetPlan: 'teamforce', targetMaxClients: 5000 },
    // Deliberately NOT migrated: "elzekred" (already cancelled, left as historical record),
    // "fitnesstime"/"bassiouney"/"vgdsgsdgdsg" (expired/internal test accounts, no action
    // taken on them).
];

async function migrateWorkspaces() {
    for (const m of MIGRATIONS) {
        const workspace = await prisma.workspaces.findUnique({
            where:  { slug: m.workspaceSlug },
            select: { id: true, owner_id: true },
        });
        if (!workspace) {
            console.warn(`[Cutover] skipping "${m.workspaceSlug}" — workspace not found`);
            continue;
        }

        const plan = await prisma.plans.findFirst({ where: { name: m.targetPlan, is_active: true } });
        if (!plan) {
            console.warn(`[Cutover] skipping "${m.workspaceSlug}" — target plan "${m.targetPlan}" not found/active`);
            continue;
        }

        const variation = await prisma.plan_variations.findFirst({
            where: { plan_id: plan.id, max_clients: m.targetMaxClients, is_active: true },
        });
        if (!variation) {
            console.warn(`[Cutover] skipping "${m.workspaceSlug}" — no active variation on "${m.targetPlan}" with max_clients=${m.targetMaxClients}`);
            continue;
        }

        try {
            await checkVariationSwitchAllowed(workspace.id, {
                max_clients:    variation.max_clients,
                max_team_seats: variation.max_team_seats ?? plan.max_team_seats,
            });
        } catch (err) {
            console.error(`[Cutover] BLOCKED "${m.workspaceSlug}" → ${m.targetPlan} (${m.targetMaxClients} clients) — current usage exceeds this target:`, (err as { message?: string }).message);
            continue;
        }

        await prisma.workspace_subscriptions.updateMany({
            where: { workspace_id: workspace.id },
            data: {
                plan_id:              plan.id,
                variation_id:         variation.id,
                locked_price_monthly: variation.price_monthly,
                locked_currency:      variation.currency,
            },
        });
        console.info(`[Cutover] migrated "${m.workspaceSlug}" → ${m.targetPlan} (${m.targetMaxClients ?? 'unlimited'} clients, ${variation.price_monthly ?? 'custom'} ${variation.currency})`);
    }
}

async function main() {
    await cleanupLegacyPlans();
    await migrateWorkspaces();
    console.info('[Cutover] done.');
}

main()
    .catch((err) => { console.error('[Cutover] Fatal error:', err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
