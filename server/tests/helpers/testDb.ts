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
                messages, threads,
                workout_logs, form_requests, forms,
                client_observations, clients,
                workspace_members, workspace_subscriptions,
                workspaces, user_sessions,
                password_reset_tokens, users
            RESTART IDENTITY CASCADE
        `);
    }, { timeout: 10000 });
}

export async function closeTestDb(): Promise<void> {
    await testPrisma.$disconnect();
    if (testPool) {
        await testPool.end();
        testPool = null;
    }
}
