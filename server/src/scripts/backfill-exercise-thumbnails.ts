/**
 * One-time backfill: fill exercise_library.thumbnail_path for every workspace,
 * matched by name_en against master_exercise_library, wherever it's currently NULL.
 *
 * Needed because workspaces cloned (at signup, or via the admin's old seed flow)
 * before thumbnail_path was populated on the master rows never got a thumbnail —
 * only touches rows that are missing one; never overwrites an existing value or
 * any other field, so coach edits to name/instructions/etc. are untouched.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/backfill-exercise-thumbnails.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const masters = await prisma.master_exercise_library.findMany({
        where:  { thumbnail_path: { not: null } },
        select: { name_en: true, thumbnail_path: true },
    });

    let totalUpdated = 0;
    for (const m of masters) {
        const result = await prisma.exercise_library.updateMany({
            where: { name_en: m.name_en, thumbnail_path: null },
            data:  { thumbnail_path: m.thumbnail_path },
        });
        totalUpdated += result.count;
    }

    console.log(`Backfilled thumbnail_path on ${totalUpdated} exercise_library row(s) across all workspaces (matched against ${masters.length} master exercises with a thumbnail).`);
}

main()
    .then(() => prisma.$disconnect())
    .catch((err) => {
        console.error(err);
        return prisma.$disconnect().finally(() => process.exit(1));
    });
