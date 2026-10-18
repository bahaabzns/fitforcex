/**
 * Fill a workspace with a realistic, fully populated demo: ~1000 clients across every
 * subscription state, with packages, transactions, nutrition and training plans, workout
 * logs, food diaries, forms and check-ins, plans queue work, measurements, coach notes,
 * chat threads, a team with capacity settings, notifications and workspace settings.
 *
 * Safety
 *   - Writes nothing unless --yes is passed. Without it the script only reports what it found.
 *   - Everything it creates is tagged by e-mail domain (clients @demo-clients.example.test,
 *     team @demo-team.example.test) or metadata { demo: true }, so --reset removes exactly
 *     that and nothing else. Real clients, plans, forms and settings are never modified.
 *   - Shared setup (forms, packages, payment methods, branding, PDF settings, queue labels,
 *     metrics) is only created when the workspace lacks it, and is left in place on --reset.
 *   - Not run in one transaction (too large). If it dies half way, re-run with --reset.
 *   - Deliberately NOT created: platform billing rows (workspace_payments / subscription
 *     events: they feed the admin revenue stats), and anything that needs an uploaded file
 *     (progress photos, logo, banners).
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/seed-demo-workspace.ts <slug> [--clients=1000] [--yes] [--reset]
 *
 * Seeded logins (password: Demo@12345)
 *   team:    <first>.<last>@demo-team.example.test, e.g. omar.khaled@demo-team.example.test
 *   clients: the sample logins printed at the end
 */

import bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { Buffers } from './demo-workspace/buffers';
import { buildClient } from './demo-workspace/clientBuilder';
import { chunk, DAY, MINUTE, NOW, rand, randInt } from './demo-workspace/random';
import {
    CLIENT_EMAIL_DOMAIN, createTeam, DEMO_PASSWORD, ensureForms, ensureMetrics, ensurePackages, ensurePaymentMethods, ensureQueueLabels,
    ensureSettings, loadLibrary, TEAM_EMAIL_DOMAIN,
} from './demo-workspace/setup';
import type { BuildContext, CollectedForOutput } from './demo-workspace/types';

const prisma = new PrismaClient();
const ARGS = process.argv.slice(2);
const SLUG = ARGS.find((arg) => !arg.startsWith('--'));
const WRITE = ARGS.includes('--yes');
const RESET = ARGS.includes('--reset');
const CLIENT_COUNT = Number(ARGS.find((arg) => arg.startsWith('--clients='))?.split('=')[1] ?? 1000);
const BATCH_CLIENTS = 40;
const DELETE_CHUNK = 50;

function maskedDatabaseTarget(): string {
    try {
        const url = new URL(process.env.DATABASE_URL ?? '');
        return `${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
    } catch {
        return '(DATABASE_URL not set or unparseable)';
    }
}

// ── Cleanup ────────────────────────────────────────────────────────────────
async function findDemoClientIds(workspaceId: string): Promise<string[]> {
    const rows = await prisma.clients.findMany({
        where: { workspace_id: workspaceId, email: { endsWith: `@${CLIENT_EMAIL_DOMAIN}` } }, select: { id: true },
    });
    return rows.map((row) => row.id);
}

/** Demo team users that belong to (or were invited to) this workspace, so another workspace's team is never touched. */
function findDemoTeamUsers(workspaceId: string) {
    return prisma.users.findMany({
        where: {
            email: { endsWith: `@${TEAM_EMAIL_DOMAIN}` },
            OR: [
                { workspace_members: { some: { workspace_id: workspaceId } } },
                { workspace_invitations_workspace_invitations_invited_user_idTousers: { some: { workspace_id: workspaceId } } },
            ],
        },
        select: { id: true },
    });
}

async function removeDemoData(workspaceId: string, clientIds: string[]) {
    for (const ids of chunk(clientIds, DELETE_CHUNK)) {
        const threads = await prisma.threads.findMany({ where: { workspace_id: workspaceId, client_id: { in: ids } }, select: { id: true } });
        const threadIds = threads.map((thread) => thread.id);
        await prisma.messages.deleteMany({ where: { thread_id: { in: threadIds } } });
        await prisma.threads.deleteMany({ where: { id: { in: threadIds } } });
        await prisma.transactions.deleteMany({ where: { workspace_id: workspaceId, client_id: { in: ids } } });
        await prisma.clients.deleteMany({ where: { workspace_id: workspaceId, id: { in: ids } } });
        // training_plans has no foreign key to clients, so it does not cascade with them.
        await prisma.training_plans.deleteMany({ where: { workspace_id: workspaceId, client_id: { in: ids } } });
    }
    await prisma.notifications.deleteMany({ where: { workspace_id: workspaceId, metadata: { path: ['demo'], equals: true } } });

    const users = await findDemoTeamUsers(workspaceId);
    const userIds = users.map((user) => user.id);
    await prisma.workspace_audit_log.deleteMany({ where: { workspace_id: workspaceId, actor_user_id: { in: userIds } } });
    await prisma.workspace_audit_log.deleteMany({ where: { workspace_id: workspaceId, metadata: { path: ['demo'], equals: true } } });
    await prisma.workspace_invitations.deleteMany({ where: { workspace_id: workspaceId, OR: [{ invited_user_id: { in: userIds } }, { invited_by_user_id: { in: userIds } }] } });
    await prisma.capacity_history.deleteMany({ where: { workspace_id: workspaceId, user_id: { in: userIds } } });
    await prisma.workspace_members.deleteMany({ where: { workspace_id: workspaceId, user_id: { in: userIds } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
}

// ── Notifications ──────────────────────────────────────────────────────────
function buildNotifications(workspaceId: string, ownerId: string, managerId: string | null, collected: CollectedForOutput): Prisma.notificationsCreateManyInput[] {
    const rows: Prisma.notificationsCreateManyInput[] = [];
    const add = (recipientId: string, type: string, importance: string, title: string, body: string, entityType: string, entityId: string, clientId: string, at: Date) => {
        const ageMs = NOW.getTime() - at.getTime();
        rows.push({
            id: createId(), workspace_id: workspaceId, recipient_type: 'user', recipient_id: recipientId, type, importance, title, body,
            entity_type: entityType, entity_id: entityId, actor_type: 'client', actor_id: clientId, metadata: { demo: true },
            read_at: ageMs > 3 * DAY || rand() < 0.25 ? new Date(at.getTime() + randInt(5, 600) * MINUTE) : null, created_at: at,
        });
    };

    for (const thread of collected.unreadThreads.slice(0, 20)) {
        add(ownerId, 'message.received', 'info', `New message from ${thread.clientName}`, 'Sent you a message in the chat', 'thread', thread.threadId, thread.clientId, thread.at);
        add(thread.assignee, 'message.received', 'info', `New message from ${thread.clientName}`, 'Sent you a message in the chat', 'thread', thread.threadId, thread.clientId, thread.at);
    }
    for (const request of collected.submittedRequests.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 30)) {
        add(ownerId, 'checkin.submitted', 'actionable', `${request.clientName} submitted a form`, request.formTitle, 'form_request', request.requestId, request.clientId, request.at);
        if (request.assignee) add(request.assignee, 'checkin.assigned', 'actionable', `${request.formTitle} assigned to you`, `From ${request.clientName}`, 'form_request', request.requestId, request.clientId, request.at);
    }
    for (const client of collected.newClients.slice(0, 8)) {
        add(ownerId, 'client.created', 'info', 'New client joined', `${client.clientName} just subscribed`, 'client', client.clientId, client.clientId, client.at);
        if (managerId) add(managerId, 'client.created', 'info', 'New client joined', `${client.clientName} just subscribed`, 'client', client.clientId, client.clientId, client.at);
    }
    return rows;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function reportPlanLimit(workspaceId: string) {
    const subscription = await prisma.workspace_subscriptions.findUnique({
        where: { workspace_id: workspaceId }, include: { plans: { select: { display_name: true, max_clients: true } }, plan_variations: { select: { max_clients: true } } },
    });
    if (!subscription) return console.log('  billing plan:   none on record');
    const cap = subscription.plan_variations?.max_clients ?? subscription.plans.max_clients;
    console.log(`  billing plan:   ${subscription.plans.display_name} (${subscription.status}), client limit ${cap ?? 'unlimited'}`);
    if (cap !== null && cap < CLIENT_COUNT) {
        console.log(`  WARNING: ${CLIENT_COUNT} demo clients exceed the plan limit of ${cap}. Seeding bypasses the limit, but adding clients in the UI may be blocked or prompt an upgrade.`);
    }
}

async function main() {
    if (!SLUG) throw new Error('Usage: seed-demo-workspace.ts <workspace-slug> [--clients=1000] [--yes] [--reset]');
    if (!Number.isInteger(CLIENT_COUNT) || CLIENT_COUNT < 1) throw new Error('--clients must be a positive integer');

    const workspace = await prisma.workspaces.findUnique({ where: { slug: SLUG }, select: { id: true, name: true, owner_id: true, archived_at: true } });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found in ${maskedDatabaseTarget()}`);
    const existingDemo = await findDemoClientIds(workspace.id);
    const realClients = await prisma.clients.count({ where: { workspace_id: workspace.id } }) - existingDemo.length;

    console.log(`\nDatabase:         ${maskedDatabaseTarget()}`);
    console.log(`Workspace:        ${workspace.name} (${SLUG}) ${workspace.id}`);
    console.log(`  existing clients: ${realClients} real, ${existingDemo.length} demo`);
    await reportPlanLimit(workspace.id);
    console.log(`Plan:             seed ${CLIENT_COUNT} demo clients${RESET ? ', removing the previous demo data first' : ''}`);

    if (!WRITE) return console.log('\nDry run: nothing written. Re-run with --yes to seed.');
    const existingTeam = (await findDemoTeamUsers(workspace.id)).length;
    if ((existingDemo.length > 0 || existingTeam > 0) && !RESET) {
        throw new Error(`Demo data already exists (${existingDemo.length} clients, ${existingTeam} team users). Re-run with --reset to replace it.`);
    }
    if (workspace.archived_at) throw new Error('Workspace is archived');

    if (RESET) {
        console.log('\nRemoving previous demo data...');
        await removeDemoData(workspace.id, existingDemo);
    }

    console.log('\nPreparing workspace...');
    const [library, metrics] = await Promise.all([loadLibrary(prisma, workspace.id), ensureMetrics(prisma, workspace.id)]);
    const forms = await ensureForms(prisma, workspace.id, metrics);
    const variations = await ensurePackages(prisma, workspace.id, forms);
    const paymentMethods = await ensurePaymentMethods(prisma, workspace.id);
    const labels = await ensureQueueLabels(prisma, workspace.id);
    await ensureSettings(prisma, workspace.id, workspace.name, workspace.owner_id);
    const team = await createTeam(prisma, workspace.id, workspace.owner_id);
    console.log(`  ${library.foods.length} foods, ${library.exercises.length} exercises, ${variations.length} package variations, ${team.length} team members`);

    const [maxClient, maxTransaction] = await Promise.all([
        prisma.clients.aggregate({ where: { workspace_id: workspace.id }, _max: { client_code: true } }),
        prisma.transactions.aggregate({ where: { workspace_id: workspace.id }, _max: { transaction_code: true } }),
    ]);
    const collected: CollectedForOutput = { unreadThreads: [], submittedRequests: [], newClients: [], scenarioCounts: {}, sampleLogins: [] };
    const buffers = new Buffers(prisma);
    const ctx: BuildContext = {
        workspaceId: workspace.id, ownerId: workspace.owner_id, buffers, library, metrics, forms, variations, paymentMethods, team, labels,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10), codeBase: (maxClient._max.client_code ?? 0) + 1, collected,
    };

    console.log(`\nGenerating ${CLIENT_COUNT} clients...`);
    for (let index = 0; index < CLIENT_COUNT; index++) {
        buildClient(ctx, index);
        if ((index + 1) % BATCH_CLIENTS === 0 || index === CLIENT_COUNT - 1) {
            await buffers.flush();
            process.stdout.write(`\r  ${index + 1}/${CLIENT_COUNT}`);
        }
    }

    const transactions = buffers.transactions.sort((a, b) => (a.transaction_date as Date).getTime() - (b.transaction_date as Date).getTime());
    transactions.forEach((transaction, i) => { transaction.transaction_code = (maxTransaction._max.transaction_code ?? 0) + 1 + i; });
    for (const part of chunk(transactions, 1000)) await prisma.transactions.createMany({ data: part });
    buffers.totals.transactions = transactions.length;

    const manager = team.find((member) => member.role === 'manager');
    const notifications = buildNotifications(workspace.id, workspace.owner_id, manager?.userId ?? null, collected);
    await prisma.notifications.createMany({ data: notifications });
    buffers.totals.notifications = notifications.length;

    console.log('\n\nDone. Rows created:');
    for (const [label, count] of Object.entries(buffers.totals)) console.log(`  ${label.padEnd(24)} ${count}`);
    console.log('\nClients by scenario:', collected.scenarioCounts);
    console.log(`\nPassword for every seeded login: ${DEMO_PASSWORD}`);
    console.log(`  team:    omar.khaled@${TEAM_EMAIL_DOMAIN}  (trainer)   sara.mostafa@${TEAM_EMAIL_DOMAIN}  (manager)`);
    console.log(`  clients: ${collected.sampleLogins.join(', ')}`);
}

main()
    .catch((err) => { console.error('\n', err); process.exit(1); })
    .finally(() => prisma.$disconnect());
