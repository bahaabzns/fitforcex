/**
 * Plan Variations, Phase 1 — one-time, idempotent, re-runnable backfill.
 *
 * Every `plans` row needs at least one `plan_variations` row (the feature requires every
 * plan to have >=1 variation, including free plans). For each plan with zero variations,
 * this creates exactly one, copying today's plan-level limits/pricing so existing customers
 * see zero behavior change. Every existing `workspace_subscriptions`/`workspace_payments`
 * row is then pointed at that plan's variation, with the subscription's locked price
 * snapshotted from it.
 *
 * Safe to re-run: plans that already have a variation are skipped; subscriptions/payments
 * that already have a variation_id are left untouched.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/backfill-plan-variations.ts
 */

import { createId } from '@paralleldrive/cuid2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillVariations() {
    const plans = await prisma.plans.findMany({
        include: { _count: { select: { plan_variations: true } } },
    });

    let created = 0;
    for (const plan of plans) {
        if (plan._count.plan_variations > 0) continue;

        await prisma.plan_variations.create({
            data: {
                id:            createId(),
                plan_id:       plan.id,
                max_clients:   plan.max_clients,
                price_monthly: plan.price_monthly,
                currency:      plan.currency,
                payment_link:  plan.payment_link,
                is_default:    true,
                is_active:     true,
                sort_order:    0,
            },
        });
        created++;
    }

    return { total: plans.length, created };
}

async function backfillSubscriptions() {
    const rows = await prisma.workspace_subscriptions.findMany({
        where: { variation_id: null },
        select: { id: true, plan_id: true },
    });

    let matched = 0;
    const unmatched: string[] = [];

    for (const row of rows) {
        const variation = await prisma.plan_variations.findFirst({
            where:  { plan_id: row.plan_id, is_default: true },
            select: { id: true, price_monthly: true, currency: true },
        });
        if (!variation) { unmatched.push(row.id); continue; }

        await prisma.workspace_subscriptions.update({
            where: { id: row.id },
            data: {
                variation_id:         variation.id,
                locked_price_monthly: variation.price_monthly,
                locked_currency:      variation.currency,
            },
        });
        matched++;
    }

    return { total: rows.length, matched, unmatched };
}

async function backfillPayments() {
    const rows = await prisma.workspace_payments.findMany({
        where: { variation_id: null },
        select: { id: true, plan_id: true },
    });

    let matched = 0;
    const unmatched: string[] = [];

    for (const row of rows) {
        const variation = await prisma.plan_variations.findFirst({
            where:  { plan_id: row.plan_id, is_default: true },
            select: { id: true },
        });
        if (!variation) { unmatched.push(row.id); continue; }

        await prisma.workspace_payments.update({
            where: { id: row.id },
            data:  { variation_id: variation.id },
        });
        matched++;
    }

    return { total: rows.length, matched, unmatched };
}

async function main() {
    console.info('[Backfill] Creating a default plan_variations row for every variation-less plan ...');
    const planResult = await backfillVariations();
    console.info(`[Backfill] plans: ${planResult.created}/${planResult.total} received a new default variation`);

    console.info('[Backfill] Resolving workspace_subscriptions.variation_id ...');
    const subResult = await backfillSubscriptions();
    console.info(`[Backfill] workspace_subscriptions: ${subResult.matched}/${subResult.total} matched`);
    if (subResult.unmatched.length > 0) {
        console.warn(`[Backfill] Unmatched subscriptions (plan has no variation, review manually): ${subResult.unmatched.join(', ')}`);
    }

    console.info('[Backfill] Resolving workspace_payments.variation_id ...');
    const payResult = await backfillPayments();
    console.info(`[Backfill] workspace_payments: ${payResult.matched}/${payResult.total} matched`);
    if (payResult.unmatched.length > 0) {
        console.warn(`[Backfill] Unmatched payments (plan has no variation, review manually): ${payResult.unmatched.join(', ')}`);
    }
}

main()
    .catch((err) => { console.error('[Backfill] Fatal error:', err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
