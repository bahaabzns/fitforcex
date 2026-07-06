/**
 * Package Lifecycle Phase 0 — one-time, idempotent, re-runnable backfill.
 *
 * Resolves the legacy free-text package labels (`transactions.package_variation`,
 * `clients.current_package`) to real `package_variations` rows.
 *
 * IMPORTANT — matching strategy differs from the pre-Phase-0 resolver on purpose:
 * both the add-client wizard (`clients/page.js`) and `TransactionModal.js` store
 * this label as the COMPOSED string `"${package.name} — ${variation.name}"`, never
 * the bare variation name. The old `resolveClientPackageId()` matched the label
 * against `package_variations.name` alone (`where: { name: client.current_package }`),
 * which can only succeed if a variation's own name happens to equal the full
 * composed string — in practice this means it never matched real wizard/transaction-
 * modal data. This was a pre-existing, previously-undocumented bug (confirmed by this
 * backfill: 0/23 transactions and 0/19 clients matched in local dev data on the first
 * pass using the old strategy). See docs/package-lifecycle-implementation-plan.md,
 * "Newly discovered during implementation" note added under §18.4 Technical debt.
 *
 * This backfill therefore splits the composed label on " — " and matches
 * package.name + variation.name together, falling back to a bare variation-name
 * match for any row that isn't in the composed format. Unmatched rows are left
 * NULL (safe default — falls back to workspace-global policy) and reported so an
 * engineer can review genuine data-quality issues (renames, typos).
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/backfill-package-variation-ids.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LABEL_SEPARATOR = ' — ';

/** Resolves a stored label to a package_variations.id, trying the composed
 *  "Package — Variation" format first, then a bare variation-name match. */
async function findVariationForLabel(label: string, workspaceId: string): Promise<string | null> {
    const sepIndex = label.indexOf(LABEL_SEPARATOR);
    if (sepIndex !== -1) {
        const packageName   = label.slice(0, sepIndex);
        const variationName = label.slice(sepIndex + LABEL_SEPARATOR.length);
        const composedMatch = await prisma.package_variations.findFirst({
            where:  { name: variationName, packages: { workspace_id: workspaceId, name: packageName } },
            select: { id: true },
        });
        if (composedMatch) return composedMatch.id;
    }

    const bareMatch = await prisma.package_variations.findFirst({
        where:  { name: label, packages: { workspace_id: workspaceId } },
        select: { id: true },
    });
    return bareMatch?.id ?? null;
}

async function backfillTransactions() {
    const rows = await prisma.transactions.findMany({
        where: { package_variation_id: null, package_variation: { not: null } },
        select: { id: true, workspace_id: true, package_variation: true },
    });

    let matched = 0;
    const unmatched: { id: string; workspaceId: string; label: string }[] = [];

    for (const row of rows) {
        const variationId = await findVariationForLabel(row.package_variation as string, row.workspace_id);
        if (variationId) {
            await prisma.transactions.update({
                where: { id: row.id },
                data:  { package_variation_id: variationId },
            });
            matched++;
        } else {
            unmatched.push({ id: row.id, workspaceId: row.workspace_id, label: row.package_variation as string });
        }
    }

    return { total: rows.length, matched, unmatched };
}

async function backfillClients() {
    const rows = await prisma.clients.findMany({
        where: { current_package_variation_id: null, current_package: { not: null } },
        select: { id: true, workspace_id: true, current_package: true },
    });

    let matched = 0;
    const unmatched: { id: string; workspaceId: string | null; label: string }[] = [];

    for (const row of rows) {
        if (!row.workspace_id) { unmatched.push({ id: row.id, workspaceId: null, label: row.current_package as string }); continue; }
        const variationId = await findVariationForLabel(row.current_package as string, row.workspace_id);
        if (variationId) {
            await prisma.clients.update({
                where: { id: row.id },
                data:  { current_package_variation_id: variationId },
            });
            matched++;
        } else {
            unmatched.push({ id: row.id, workspaceId: row.workspace_id, label: row.current_package as string });
        }
    }

    return { total: rows.length, matched, unmatched };
}

async function main() {
    console.info('[Backfill] Resolving transactions.package_variation_id ...');
    const txResult = await backfillTransactions();
    console.info(`[Backfill] transactions: ${txResult.matched}/${txResult.total} matched`);
    if (txResult.unmatched.length > 0) {
        console.warn('[Backfill] Unmatched transactions (review manually):');
        for (const u of txResult.unmatched) console.warn(`  - tx=${u.id} workspace=${u.workspaceId} label="${u.label}"`);
    }

    console.info('[Backfill] Resolving clients.current_package_variation_id ...');
    const clientResult = await backfillClients();
    console.info(`[Backfill] clients: ${clientResult.matched}/${clientResult.total} matched`);
    if (clientResult.unmatched.length > 0) {
        console.warn('[Backfill] Unmatched clients (review manually):');
        for (const u of clientResult.unmatched) console.warn(`  - client=${u.id} workspace=${u.workspaceId} label="${u.label}"`);
    }
}

main()
    .catch((err) => { console.error('[Backfill] Fatal error:', err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
