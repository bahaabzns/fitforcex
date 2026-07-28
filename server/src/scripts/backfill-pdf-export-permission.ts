/**
 * One-time backfill: grants the new `pdfExport` permission module to every
 * existing workspace_member.
 *
 * Permissions are a JSONB snapshot copied from DEFAULT_PERMISSIONS onto each
 * workspace_member row at invite time (see workspaces.controller.ts /
 * invitations.controller.ts) — they are never read live from the const. Adding
 * `pdfExport` to DEFAULT_PERMISSIONS only affects members invited after this
 * change; every already-existing member's stored JSON is missing the key, so
 * requirePermission('pdfExport', ...) would deny them (only the workspace
 * owner bypasses, via isOwner). This script merges the key into every row
 * that doesn't already have it. Idempotent — safe to re-run.
 *
 * Usage (from server/):
 *   DRY_RUN=true npx ts-node -r tsconfig-paths/register src/scripts/backfill-pdf-export-permission.ts
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-pdf-export-permission.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { DEFAULT_PERMISSIONS } from '../lib/defaultPermissions';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === 'true';

function log(msg: string) {
    console.log(`[backfill-pdf-export-permission] ${msg}`);
}

async function main() {
    log(DRY_RUN ? 'Starting (DRY RUN — no writes)' : 'Starting (LIVE — writing)');

    const members = await prisma.workspace_members.findMany({
        select: { id: true, role: true, permissions: true },
    });

    let updated = 0;
    let skipped = 0;

    for (const member of members) {
        const permissions = (member.permissions ?? {}) as Record<string, unknown>;
        if (permissions.pdfExport) {
            skipped++;
            continue;
        }

        const pdfExportGrant = DEFAULT_PERMISSIONS[member.role]?.pdfExport
            ?? { read: true, write: false, delete: false };

        const nextPermissions = { ...permissions, pdfExport: pdfExportGrant };

        if (!DRY_RUN) {
            await prisma.workspace_members.update({
                where: { id: member.id },
                data:  { permissions: nextPermissions as Prisma.InputJsonValue },
            });
        }
        updated++;
    }

    log(`${DRY_RUN ? 'Would update' : 'Updated'} ${updated} member(s), skipped ${skipped} (already had pdfExport).`);
}

main()
    .catch((err) => {
        console.error('[backfill-pdf-export-permission] FAILED:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
