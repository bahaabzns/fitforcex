/**
 * Back-fills a freemium subscription for any workspace that has none.
 * Run with: npx ts-node -r tsconfig-paths/register prisma/seedWorkspaceSub.ts
 */
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

async function main() {
    const freemium = await prisma.plans.findFirst({ where: { name: 'freemium' } });
    if (!freemium) { console.error('No freemium plan found — run your plans seed first.'); process.exit(1); }

    const unsubscribed = await prisma.$queryRaw<{ id: string; slug: string }[]>`
        SELECT w.id, w.slug FROM workspaces w
        WHERE NOT EXISTS (SELECT 1 FROM workspace_subscriptions ws WHERE ws.workspace_id = w.id)
    `;

    if (!unsubscribed.length) { console.log('All workspaces already have subscriptions.'); return; }

    for (const ws of unsubscribed) {
        await prisma.workspace_subscriptions.create({
            data: {
                id:           createId(),
                workspace_id: ws.id,
                plan_id:      freemium.id,
                status:       'active',
                starts_at:    new Date(),
            },
        });
        console.log(`Subscribed workspace "${ws.slug}" to freemium.`);
    }
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
