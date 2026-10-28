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

/**
 * Closes the *app's* own database clients (src/lib/prisma and the pg pool in src/db). Each test file
 * gets a fresh module registry, so each one creates its own pair — and unlike testPrisma/testPool
 * above, nothing closed them. Across ~58 files the idle connections piled up past Postgres's
 * max_connections, and from then on every request failed ("too many clients") — which the auth
 * middleware reports as a 401, so late suites failed with misleading auth errors.
 */
export async function closeAppConnections(): Promise<void> {
    const appPrisma = (globalThis as { prisma?: { $disconnect?: () => Promise<void> } }).prisma;
    await appPrisma?.$disconnect?.();

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const appPool = require('../../src/db').default;
        // A suite that mocks src/db has no real pool to end.
        if (typeof appPool?.end === 'function') await appPool.end();
    } catch {
        // Already ended by the suite itself, or the module couldn't load — nothing left to close.
    }
}
