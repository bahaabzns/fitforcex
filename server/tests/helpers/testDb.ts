import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

export const testPrisma = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

let testPool: Pool | null = null;

export function getTestPool(): Pool {
    if (!testPool) {
        testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
    return testPool;
}

export async function resetTestDb(): Promise<void> {
    await testPrisma.$transaction(async (tx) => {
        // Break the FK cycle between users.default_workspace_id → workspaces before truncating
        await tx.$executeRawUnsafe(`UPDATE users SET default_workspace_id = NULL`);
        await tx.$executeRawUnsafe(`
            TRUNCATE TABLE
                insight_events, insights,
                insight_prompt_dismissals, insight_prompt_workspaces, insight_prompt_conditions, insight_prompt_impressions,
                insight_prompts, roadmap_items,
                notifications,
                messages, threads,
                workout_logs, form_requests, forms,
                client_observations, clients,
                subscription_status_audit, subscription_access_policies,
                package_variations, packages, transactions,
                workspace_members, workspace_subscriptions,
                workspaces, user_sessions,
                password_reset_tokens, users
            RESTART IDENTITY CASCADE
        `);
    }, { timeout: 20000 });
}

export async function closeTestDb(): Promise<void> {
    await testPrisma.$disconnect();
    if (testPool) {
        await testPool.end();
        testPool = null;
    }
}
