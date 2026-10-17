/**
 * Seed the Operations dashboard with demo data covering its edge cases, for one workspace.
 *
 * Re-runnable: everything this script creates is tagged (users `ops-demo-*@example.test`,
 * clients `ops-demo-client-*@example.test`, forms titled `[Ops Demo] ...`) and is deleted at the
 * start of each run, so running it twice leaves one copy. Nothing else in the workspace is
 * touched. Existing members' capacities are NOT changed; the seeded members are added on top.
 *
 * Cases covered
 *   Capacity    overloaded / tight / healthy trainers, zero capacity, NULL capacity (not configured),
 *               inactive member with work, ineligible roles (receptionist/viewer) with work,
 *               owner capacity, an assignee id that no longer exists, capacity history (set, change, clear)
 *   Demand      nutrition + workout x assessment + check-in, review-only ('nothing'), a request whose
 *               own post_action is '' (falls back to the form), unassigned, assigned to owner/members
 *   Statuses    submitted (need-action, many ages), reviewed, archived, pending, sent, scheduled (future)
 *   Packages    five package names, long and Arabic names, clients with no package,
 *               an archived client and a soft-deleted client that still hold open requests
 *   Trend       ~100 days of daily inflow with weekday waves, spikes, empty days, requests today,
 *               requests either side of UTC midnight (time-zone bucketing), one older than 366 days
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/seed-operations-demo.ts [slug]
 *   (default slug: test1; seeded users can log in with password "password123")
 *   Add --no-limits to seed the same requests and team but with NO daily limits, days off or capacity history,
 *   which is what a brand-new workspace looks like (shows the first-time setup card on the dashboard).
 */

import bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { DEFAULT_PERMISSIONS } from '../lib/defaultPermissions';

const prisma = new PrismaClient();
const ARGS = process.argv.slice(2);
const NO_LIMITS = ARGS.includes('--no-limits');
const SLUG = ARGS.find((arg) => !arg.startsWith('--')) || 'test1';
const DAY = 86_400_000;
const HOUR = 3_600_000;

const USER_EMAIL = (key: string) => `ops-demo-${key}@example.test`;
const CLIENT_EMAIL = (n: number) => `ops-demo-client-${n}@example.test`;
const FORM_PREFIX = '[Ops Demo]';
const REMOVED_USER_ID = 'ops-demo-removed-user';   // assignee that no longer exists

// Deterministic PRNG so re-runs produce the same shape of data.
function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(20261017);
const randInt = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];

const ago = (days: number, hoursOffset = 0) => new Date(Date.now() - days * DAY - hoursOffset * HOUR);

// ── Team ────────────────────────────────────────────────────────────────
interface TeamSpec {
    key: string; fname: string; lname: string; role: string;
    capacity: number | null; isActive: boolean;
    daysOff?: number[];   // weekdays off: 0 = Sunday ... 6 = Saturday
    history?: Array<{ daysAgo: number; from: number | null; to: number | null }>;
}
const TEAM: TeamSpec[] = [
    { key: 'trainer-overloaded', fname: 'Omar',   lname: 'Overloaded', role: 'trainer',      capacity: 6,    isActive: true,
      history: [{ daysAgo: 70, from: null, to: 4 }, { daysAgo: 21, from: 4, to: 6 }] },
    { key: 'trainer-healthy',    fname: 'Hana',   lname: 'Healthy',    role: 'trainer',      capacity: 10,   isActive: true, daysOff: [5, 6],
      history: [{ daysAgo: 45, from: null, to: 8 }, { daysAgo: 9, from: 8, to: 10 }] },
    { key: 'nutri-tight',        fname: 'Nadia',  lname: 'Tight',      role: 'nutritionist', capacity: 4,    isActive: true, daysOff: [5],
      history: [{ daysAgo: 30, from: null, to: 5 }, { daysAgo: 14, from: 5, to: null }, { daysAgo: 6, from: null, to: 4 }] },
    { key: 'manager-mid',        fname: 'Mazen',  lname: 'Manager',    role: 'manager',      capacity: 5,    isActive: true, daysOff: [6, 0] },
    { key: 'trainer-unset',      fname: 'Ula',    lname: 'Unset',      role: 'trainer',      capacity: null, isActive: true },
    { key: 'trainer-zero',       fname: 'Zaid',   lname: 'Zero',       role: 'trainer',      capacity: 0,    isActive: true },
    { key: 'trainer-inactive',   fname: 'Ines',   lname: 'Inactive',   role: 'trainer',      capacity: 8,    isActive: false },
    { key: 'receptionist',       fname: 'Rana',   lname: 'Reception',  role: 'receptionist', capacity: null, isActive: true },
    { key: 'viewer',             fname: 'Victor', lname: 'Viewer',     role: 'viewer',       capacity: null, isActive: true },
];

// ── Packages and clients ────────────────────────────────────────────────
const PACKAGES: Array<string | null> = [
    'Gold 12-Week', 'Silver 8-Week', 'Starter', 'باقة التحول الكاملة',
    'Premium One-to-One Coaching with Weekly Video Calls and Meal Prep Support', null,
];
const FIRST_NAMES = ['Sara', 'Ahmed', 'Mona', 'Youssef', 'Laila', 'Karim', 'Dina', 'Tarek', 'Salma', 'Hassan', 'نور', 'مريم', 'خالد', 'ياسمين'];
const LAST_NAMES = ['Hassan', 'Ali', 'Farouk', 'Nabil', 'Saad', 'Mansour', 'Adel', 'Gamal', 'العطار', 'الشريف', 'منصور'];
const CLIENT_COUNT = 42;

// ── Forms: every action x type combination ──────────────────────────────
interface FormSpec { key: string; title: string; postAction: string; formType: string }
const FORM_SPECS: FormSpec[] = [
    { key: 'nutri-checkin',   title: `${FORM_PREFIX} Nutrition check-in`,   postAction: 'nutrition-plan', formType: 'check-in' },
    { key: 'nutri-assess',    title: `${FORM_PREFIX} Nutrition assessment`, postAction: 'nutrition-plan', formType: 'assessment' },
    { key: 'workout-checkin', title: `${FORM_PREFIX} Workout check-in`,     postAction: 'workout-plan',   formType: 'check-in' },
    { key: 'workout-assess',  title: `${FORM_PREFIX} Workout assessment`,   postAction: 'workout-plan',   formType: 'assessment' },
    { key: 'review-checkin',  title: `${FORM_PREFIX} Review-only check-in`, postAction: 'nothing',        formType: 'check-in' },
    { key: 'review-assess',   title: `${FORM_PREFIX} Review-only assessment`, postAction: 'nothing',      formType: 'assessment' },
];

interface SeedForm { id: string; versionId: string; postAction: string; formType: string; questionIds: string[] }

async function cleanup(workspaceId: string) {
    const clients = await prisma.clients.findMany({ where: { workspace_id: workspaceId, email: { startsWith: 'ops-demo-client-' } }, select: { id: true } });
    const clientIds = clients.map((c) => c.id);
    const requests = await prisma.form_requests.findMany({ where: { client_id: { in: clientIds } }, select: { id: true } });
    const requestIds = requests.map((r) => r.id);
    await prisma.form_responses.deleteMany({ where: { request_id: { in: requestIds } } });
    await prisma.form_requests.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.clients.deleteMany({ where: { id: { in: clientIds } } });

    const forms = await prisma.forms.findMany({ where: { workspace_id: workspaceId, title_en: { startsWith: FORM_PREFIX } }, select: { id: true } });
    const formIds = forms.map((f) => f.id);
    await prisma.form_requests.deleteMany({ where: { form_id: { in: formIds } } });
    const versions = await prisma.form_versions.findMany({ where: { form_id: { in: formIds } }, select: { id: true } });
    await prisma.forms.updateMany({ where: { id: { in: formIds } }, data: { current_version_id: null } });
    await prisma.form_version_questions.deleteMany({ where: { form_version_id: { in: versions.map((v) => v.id) } } });
    await prisma.form_versions.deleteMany({ where: { id: { in: versions.map((v) => v.id) } } });
    await prisma.forms.deleteMany({ where: { id: { in: formIds } } });

    const users = await prisma.users.findMany({ where: { email: { startsWith: 'ops-demo-', endsWith: '@example.test' } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    await prisma.capacity_history.deleteMany({ where: { workspace_id: workspaceId, user_id: { in: [...userIds, REMOVED_USER_ID] } } });
    await prisma.workspace_members.deleteMany({ where: { workspace_id: workspaceId, user_id: { in: userIds } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
}

async function seedForms(workspaceId: string): Promise<Record<string, SeedForm>> {
    const result: Record<string, SeedForm> = {};
    for (const spec of FORM_SPECS) {
        const formId = createId();
        const versionId = createId();
        await prisma.forms.create({
            data: { id: formId, workspace_id: workspaceId, title_en: spec.title, post_action: spec.postAction, form_type: spec.formType, status: 'active' },
        });
        await prisma.form_versions.create({ data: { id: versionId, form_id: formId, version_number: 1, sealed_at: new Date() } });
        await prisma.forms.update({ where: { id: formId }, data: { current_version_id: versionId } });

        const questions: Prisma.form_version_questionsCreateManyInput[] = [
            { id: createId(), form_version_id: versionId, label_en: 'Current weight (kg)', label_ar: 'الوزن الحالي (كجم)', type: 'number', order_index: 0 },
            { id: createId(), form_version_id: versionId, label_en: 'Anything your coach should know?', label_ar: 'هل من شيء يجب أن يعرفه مدربك؟', type: 'text', order_index: 1 },
        ].map((q) => ({ ...q, origin_question_id: q.id }));
        await prisma.form_version_questions.createMany({ data: questions });
        result[spec.key] = { id: formId, versionId, postAction: spec.postAction, formType: spec.formType, questionIds: questions.map((q) => q.id as string) };
    }
    return result;
}

async function seedTeam(workspaceId: string, ownerId: string): Promise<Record<string, string>> {
    const passwordHash = await bcrypt.hash('password123', 10);
    const userIds: Record<string, string> = {};
    for (const spec of TEAM) {
        const user = await prisma.users.create({
            data: { id: createId(), fname: spec.fname, lname: spec.lname, email: USER_EMAIL(spec.key), password: passwordHash, email_verified: true },
        });
        userIds[spec.key] = user.id;
        await prisma.workspace_members.create({
            data: {
                id: createId(), workspace_id: workspaceId, user_id: user.id, role: spec.role,
                permissions: DEFAULT_PERMISSIONS[spec.role] as unknown as Prisma.InputJsonValue,
                is_active: spec.isActive, daily_plan_capacity: NO_LIMITS ? null : spec.capacity, days_off: NO_LIMITS ? [] : (spec.daysOff ?? []),
                joined_at: ago(120),   // long-standing members, so the capacity chart has history to replay
            },
        });
        const history = NO_LIMITS ? [] : (spec.history ?? []);
        for (const [index, change] of history.entries()) {
            // The latest entry is when the current days off took effect; earlier ones predate days off.
            const isLast = index === history.length - 1;
            await prisma.capacity_history.create({
                data: {
                    id: createId(), workspace_id: workspaceId, user_id: user.id,
                    previous_capacity: change.from, new_capacity: change.to,
                    previous_days_off: [], new_days_off: isLast ? (spec.daysOff ?? []) : [],
                    changed_by: ownerId, changed_at: ago(change.daysAgo, randInt(0, 9)),
                },
            });
        }
    }
    if (NO_LIMITS) {
        // A fresh workspace: clear every limit, days off and capacity change in it, including the owner's and any real members'.
        await prisma.workspace_members.updateMany({ where: { workspace_id: workspaceId }, data: { daily_plan_capacity: null, days_off: [] } });
        await prisma.workspaces.update({ where: { id: workspaceId }, data: { owner_daily_plan_capacity: null, owner_days_off: [] } });
        await prisma.capacity_history.deleteMany({ where: { workspace_id: workspaceId } });
        return userIds;
    }

    // Owner capacity (optional setting) with its own history, plus history for someone who has since left.
    await prisma.workspaces.update({ where: { id: workspaceId }, data: { owner_daily_plan_capacity: 3 } });
    await prisma.capacity_history.create({ data: { id: createId(), workspace_id: workspaceId, user_id: ownerId, previous_capacity: null, new_capacity: 3, changed_by: ownerId, changed_at: ago(12) } });
    await prisma.capacity_history.create({ data: { id: createId(), workspace_id: workspaceId, user_id: REMOVED_USER_ID, previous_capacity: null, new_capacity: 7, changed_by: ownerId, changed_at: ago(40) } });
    return userIds;
}

async function seedClients(workspaceId: string) {
    const clients: Array<{ id: string; kind: 'normal' | 'archived' | 'deleted' }> = [];
    for (let i = 1; i <= CLIENT_COUNT; i++) {
        const kind = i === CLIENT_COUNT - 1 ? 'archived' : i === CLIENT_COUNT ? 'deleted' : 'normal';
        const id = createId();
        await prisma.clients.create({
            data: {
                id, client_code: 900000 + i, fname: pick(FIRST_NAMES), lname: pick(LAST_NAMES), email: CLIENT_EMAIL(i),
                workspace_id: workspaceId, current_package: PACKAGES[(i - 1) % PACKAGES.length],
                archived_at: kind === 'archived' ? ago(5) : null,
                deleted_at: kind === 'deleted' ? ago(3) : null,
            },
        });
        clients.push({ id, kind });
    }
    return clients;
}

interface RequestSeed {
    status: 'submitted' | 'reviewed' | 'pending' | 'sent' | 'scheduled';
    form: string; assignee: string | null;
    submittedAt?: Date; archived?: boolean; ownPostAction?: string; clientIndex?: number;
    finishedBy?: string | null;
}

async function seedRequests(
    workspaceId: string, ownerId: string, userIds: Record<string, string>,
    forms: Record<string, SeedForm>, clients: Awaited<ReturnType<typeof seedClients>>,
) {
    const normalClients = clients.filter((c) => c.kind === 'normal');
    const archivedClient = clients.find((c) => c.kind === 'archived')!;
    const deletedClient = clients.find((c) => c.kind === 'deleted')!;
    const planForms = ['nutri-checkin', 'nutri-assess', 'workout-checkin', 'workout-assess'];

    const assignees: Array<string | null> = [
        userIds['trainer-overloaded'], userIds['trainer-overloaded'], userIds['trainer-overloaded'],
        userIds['trainer-healthy'], userIds['nutri-tight'], userIds['nutri-tight'], userIds['manager-mid'],
        userIds['trainer-unset'], userIds['trainer-zero'], userIds['trainer-inactive'], userIds['receptionist'],
        ownerId, REMOVED_USER_ID, null, null, null,
    ];

    // Who finished past plans: mostly the active team, occasionally the owner, sometimes nobody recorded
    // (older rows from before finishers were tracked fall back to the assignee).
    const finishers: Array<string | null> = [
        userIds['trainer-overloaded'], userIds['trainer-overloaded'], userIds['trainer-healthy'], userIds['trainer-healthy'],
        userIds['nutri-tight'], userIds['manager-mid'], ownerId, ownerId, null,
    ];

    const seeds: RequestSeed[] = [];

    // ── Open need-action work, spread over every age bucket and assignee ──
    const openAges = [0.1, 0.3, 0.8, 1.2, 1.6, 2.4, 3.4, 4.5, 6.2, 8.5, 12, 20, 45];
    for (let i = 0; i < 70; i++) {
        seeds.push({
            status: 'submitted', form: pick(planForms), assignee: pick(assignees),
            submittedAt: ago(pick(openAges)),
        });
    }
    // Extra load on named trainers so each status band appears.
    for (let i = 0; i < 9; i++) seeds.push({ status: 'submitted', form: pick(planForms), assignee: userIds['trainer-overloaded'], submittedAt: ago(randInt(0, 6)) });
    for (let i = 0; i < 3; i++) seeds.push({ status: 'submitted', form: pick(planForms), assignee: userIds['nutri-tight'], submittedAt: ago(randInt(0, 3)) });
    for (let i = 0; i < 2; i++) seeds.push({ status: 'submitted', form: pick(planForms), assignee: userIds['trainer-healthy'], submittedAt: ago(randInt(0, 3)) });
    // Request whose own post_action is blank: counted via the form's action.
    for (let i = 0; i < 3; i++) seeds.push({ status: 'submitted', form: 'nutri-checkin', assignee: null, submittedAt: ago(1), ownPostAction: '' });
    // Review-only items (no plan to produce).
    for (let i = 0; i < 12; i++) seeds.push({ status: 'submitted', form: pick(['review-checkin', 'review-assess']), assignee: pick(assignees), submittedAt: ago(randInt(0, 10)) });
    // Open work belonging to an archived and a soft-deleted client (queue counts these; see DEBT.md).
    seeds.push({ status: 'submitted', form: 'workout-checkin', assignee: null, submittedAt: ago(2), clientIndex: -1 });
    seeds.push({ status: 'submitted', form: 'nutri-assess', assignee: null, submittedAt: ago(2), clientIndex: -2 });

    // ── Excluded from "needs action" ──
    for (let i = 0; i < 8; i++) seeds.push({ status: 'submitted', form: pick(planForms), assignee: pick(assignees), submittedAt: ago(randInt(1, 30)), archived: true });
    for (let i = 0; i < 6; i++) seeds.push({ status: 'pending', form: pick(planForms), assignee: null });
    for (let i = 0; i < 5; i++) seeds.push({ status: 'sent', form: pick(planForms), assignee: null });
    for (let i = 0; i < 6; i++) seeds.push({ status: 'scheduled', form: pick(planForms), assignee: null });

    // ── Reviewed history + trend: ~100 days of daily inflow (weekday waves, spikes, gaps) ──
    for (let day = 0; day < 100; day++) {
        const weekday = new Date(Date.now() - day * DAY).getUTCDay();
        const isWeekend = weekday === 5 || weekday === 6;
        let perDay = isWeekend ? randInt(0, 1) : randInt(1, 4);
        if (day % 17 === 0) perDay += randInt(5, 9);        // spike
        if (day % 23 === 11 || day % 31 === 20) perDay = 0;  // quiet days
        for (let i = 0; i < perDay; i++) {
            const form = pick([...planForms, 'review-checkin']);
            seeds.push({ status: 'reviewed', form, assignee: pick(assignees), submittedAt: ago(day, randInt(0, 20)), archived: rand() < 0.15, finishedBy: pick(finishers) });
        }
    }

    // ── Time-zone and range edges ──
    const startOfTodayUtc = new Date(); startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    seeds.push({ status: 'reviewed', form: 'workout-assess', assignee: null, submittedAt: new Date(startOfTodayUtc.getTime() - 30 * 60_000) }); // 23:30 UTC yesterday
    seeds.push({ status: 'reviewed', form: 'workout-assess', assignee: null, submittedAt: new Date(startOfTodayUtc.getTime() + 30 * 60_000) }); // 00:30 UTC today
    seeds.push({ status: 'reviewed', form: 'nutri-assess',   assignee: null, submittedAt: ago(130) });   // outside 90d, inside 366d
    seeds.push({ status: 'reviewed', form: 'nutri-checkin',  assignee: null, submittedAt: ago(400) });   // outside the max custom range

    const requestRows: Prisma.form_requestsCreateManyInput[] = [];
    const responseRows: Prisma.form_responsesCreateManyInput[] = [];
    for (const seed of seeds) {
        const form = forms[seed.form];
        const client = seed.clientIndex === -1 ? archivedClient : seed.clientIndex === -2 ? deletedClient : pick(normalClients);
        const id = createId();
        const submittedAt = seed.submittedAt ?? null;
        const requestedAt = submittedAt ? new Date(submittedAt.getTime() - randInt(1, 4) * DAY) : ago(randInt(0, 5));
        requestRows.push({
            id, workspace_id: workspaceId, form_id: form.id, form_version_id: form.versionId, client_id: client.id,
            status: seed.status, requested_at: requestedAt, submitted_at: submittedAt,
            scheduled_at: seed.status === 'scheduled' ? new Date(Date.now() + randInt(1, 14) * DAY) : null,
            action_taken_at: seed.status === 'reviewed' && submittedAt ? new Date(Math.min(Date.now(), submittedAt.getTime() + randInt(1, 3) * DAY)) : null,
            post_action: seed.ownPostAction ?? form.postAction,
            assigned_to: seed.assignee,
            action_taken_by: seed.status === 'reviewed' ? (seed.finishedBy ?? null) : null,
            archived_at: seed.archived ? ago(randInt(0, 4)) : null,
        });
        if (submittedAt) {
            responseRows.push(
                { id: createId(), request_id: id, question_id: form.questionIds[0], answer: String(randInt(55, 105)), created_at: submittedAt },
                { id: createId(), request_id: id, question_id: form.questionIds[1], answer: pick(['Feeling good.', 'Low energy this week.', 'Knee is a bit sore.', 'تمام الحمد لله']), created_at: submittedAt },
            );
        }
    }
    await prisma.form_requests.createMany({ data: requestRows });
    await prisma.form_responses.createMany({ data: responseRows });
    return requestRows;
}

async function main() {
    const workspace = await prisma.workspaces.findUnique({ where: { slug: SLUG }, select: { id: true, name: true, owner_id: true } });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found`);

    console.log(`Seeding operations demo data into "${workspace.name}" (${SLUG})${NO_LIMITS ? ' without daily limits' : ''}...`);
    await cleanup(workspace.id);
    const forms = await seedForms(workspace.id);
    const userIds = await seedTeam(workspace.id, workspace.owner_id);
    const clients = await seedClients(workspace.id);
    const requests = await seedRequests(workspace.id, workspace.owner_id, userIds, forms, clients);

    const byStatus = requests.reduce<Record<string, number>>((acc, r) => { acc[r.status as string] = (acc[r.status as string] ?? 0) + 1; return acc; }, {});
    console.log(`\nDone. ${TEAM.length} members, ${clients.length} clients, ${FORM_SPECS.length} forms, ${requests.length} requests.`);
    console.log('  requests by status:', byStatus);
    console.log('  seeded logins: ops-demo-<key>@example.test / password123 (keys:', TEAM.map((t) => t.key).join(', ') + ')');
}

main()
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
