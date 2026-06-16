/**
 * Seed transactions for existing clients, covering every subscription scenario
 * the UI can render: Active, Expired, Pre-start, Frozen, Refunded, a non-period
 * one-time payment, and multi-transaction renewal history. Remaining clients are
 * left with no transactions ("No Subscriptions").
 *
 * All subscription periods use start_mode='custom' with explicit dates so the
 * resulting status is deterministic (no dependency on plan activation).
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-transactions.ts [slug]
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();
const SLUG = process.argv[2] || 'bahaa-bzns';

const CURRENCIES = ['EGP', 'USD', 'SAR', 'AED'];
const FALLBACK_METHODS = ['Cash', 'Visa', 'InstaPay', 'Vodafone Cash'];

function dayOffset(n: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
}

function pick<T>(arr: T[], i: number): T {
    return arr[i % arr.length];
}

type TxInput = Prisma.transactionsCreateManyInput;

async function main() {
    const workspace = await prisma.workspaces.findUnique({
        where: { slug: SLUG },
        select: { id: true, name: true },
    });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found`);
    const wsId = workspace.id;

    const clients = await prisma.clients.findMany({
        where: { workspace_id: wsId },
        select: { id: true, fname: true, lname: true },
        orderBy: { created_at: 'asc' },
    });
    if (clients.length === 0) throw new Error('No clients to assign transactions to — seed clients first.');

    const variations = await prisma.package_variations.findMany({
        where: { active: true, packages: { workspace_id: wsId } },
        select: { name: true, duration: true, price: true, currency: true, packages: { select: { name: true } } },
    });
    const variationLabels = variations.map(v => `${v.packages.name} — ${v.name}`);

    const methodRows = await prisma.payment_methods.findMany({
        where: { workspace_id: wsId, active: true },
        select: { name: true },
    });
    const methods = methodRows.length > 0 ? methodRows.map(m => m.name) : FALLBACK_METHODS;

    // Continue the per-workspace sequential code from the current max.
    const maxAgg = await prisma.transactions.aggregate({ where: { workspace_id: wsId }, _max: { transaction_code: true } });
    let nextCode = (maxAgg._max.transaction_code ?? 0) + 1;

    let variety = 0;
    const clientName = (c: typeof clients[number]) => `${c.fname} ${c.lname}`.trim();

    // Build one transaction with sensible, varied commercial fields.
    function makeTx(
        client: typeof clients[number],
        opts: { start: Date | null; duration: number | null; status: string; type?: string; createdAt: Date },
    ): TxInput {
        const label = variationLabels.length > 0 ? pick(variationLabels, variety) : null;
        const currency = pick(CURRENCIES, variety);
        const amount = 500 + (variety % 10) * 250; // 500..2750
        variety++;
        return {
            id: createId(),
            transaction_code: nextCode++,
            workspace_id: wsId,
            client_id: client.id,
            client_name: clientName(client),
            package_variation: label,
            payment_method: pick(methods, variety),
            amount,
            currency,
            duration: opts.duration,
            type: opts.type || 'subscription',
            status: opts.status,
            transaction_date: opts.start ?? opts.createdAt,
            created_at: opts.createdAt,
            subscription_start_date: opts.start,
            start_mode: opts.start ? 'custom' : 'on_first_plan',
        };
    }

    const txs: TxInput[] = [];
    const freezes: Prisma.subscription_freezesCreateManyInput[] = [];
    const currentPackageByClient = new Map<string, string | null>();

    // Carve the client list into scenario groups; whatever is left stays subscription-free.
    let cursor = 0;
    const take = (n: number) => clients.slice(cursor, (cursor += n));

    const groups = {
        active: take(14),
        expired: take(10),
        preStart: take(8),
        frozen: take(8),
        refunded: take(8),
        oneTime: take(6),
        renewal: take(12),
    };

    // Active — started 10 days ago, 30-day plan, still running.
    for (const c of groups.active) {
        const start = dayOffset(-10);
        txs.push(makeTx(c, { start, duration: 30, status: 'completed', createdAt: start }));
        currentPackageByClient.set(c.id, txs[txs.length - 1].package_variation ?? null);
    }

    // Expired — started 120 days ago, 30-day plan, long over.
    for (const c of groups.expired) {
        const start = dayOffset(-120);
        txs.push(makeTx(c, { start, duration: 30, status: 'completed', createdAt: start }));
        currentPackageByClient.set(c.id, txs[txs.length - 1].package_variation ?? null);
    }

    // Pre-start — scheduled to begin 10 days from now.
    for (const c of groups.preStart) {
        const start = dayOffset(10);
        txs.push(makeTx(c, { start, duration: 30, status: 'completed', createdAt: dayOffset(-1) }));
        currentPackageByClient.set(c.id, txs[txs.length - 1].package_variation ?? null);
    }

    // Frozen — active 60-day plan with a freeze window covering today.
    for (const c of groups.frozen) {
        const start = dayOffset(-10);
        txs.push(makeTx(c, { start, duration: 60, status: 'completed', createdAt: start }));
        currentPackageByClient.set(c.id, txs[txs.length - 1].package_variation ?? null);
        freezes.push({
            id: createId(),
            client_id: c.id,
            freeze_start_date: dayOffset(-3),
            freeze_duration_days: 14,
            notes: 'Seeded freeze (currently active)',
        });
    }

    // Refunded — a refunded payment (shows "Refunded" per-transaction status).
    for (const c of groups.refunded) {
        const start = dayOffset(-10);
        txs.push(makeTx(c, { start, duration: 30, status: 'refunded', createdAt: start }));
    }

    // One-time — a completed non-subscription payment with no duration (no period).
    for (const c of groups.oneTime) {
        txs.push(makeTx(c, { start: null, duration: null, status: 'completed', type: 'one-time', createdAt: dayOffset(-5) }));
    }

    // Renewal — an expired period followed by a current active one (two transactions).
    for (const c of groups.renewal) {
        const firstStart = dayOffset(-90);
        txs.push(makeTx(c, { start: firstStart, duration: 30, status: 'completed', createdAt: firstStart }));
        const secondStart = dayOffset(-5);
        txs.push(makeTx(c, { start: secondStart, duration: 30, status: 'completed', createdAt: secondStart }));
        currentPackageByClient.set(c.id, txs[txs.length - 1].package_variation ?? null);
    }

    await prisma.transactions.createMany({ data: txs });
    if (freezes.length > 0) await prisma.subscription_freezes.createMany({ data: freezes });

    // Reflect the latest package on each subscribed client (mirrors syncClientPackage).
    for (const [clientId, pkg] of currentPackageByClient) {
        if (pkg) await prisma.clients.update({ where: { id: clientId }, data: { current_package: pkg } });
    }

    const subscribed = cursor;
    console.log(
        `Seeded ${txs.length} transactions + ${freezes.length} freezes into "${workspace.name}" (${SLUG}).\n` +
        `Scenarios → Active:${groups.active.length} Expired:${groups.expired.length} ` +
        `Pre-start:${groups.preStart.length} Frozen:${groups.frozen.length} Refunded:${groups.refunded.length} ` +
        `One-time:${groups.oneTime.length} Renewal:${groups.renewal.length} (2 tx each). ` +
        `${clients.length - subscribed} clients left with no subscriptions.`,
    );
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
