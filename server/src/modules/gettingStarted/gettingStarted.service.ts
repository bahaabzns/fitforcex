import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { DEMO_EVENT } from '../demoClient/demoClient.service';
import { DEMO_CLIENT } from '../demoClient/demoClient.content';

// The checklist is for a new coach's first weeks: a workspace older than this never sees it.
const CHECKLIST_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Starter package: a ready-to-edit package so the coach can add a real client on it straight away.
const STARTER_PACKAGE_NAME = 'باقة البداية / Starter package';
const STARTER_VARIATION = { name: 'شهر / 1 Month', duration: 30, price: 1000, currency: 'EGP', cycleDays: 14, reviewOffsetDays: 3 };

export const GETTING_STARTED_STEP = {
    EDIT_DEMO: 'edit_demo',
    VIEW_APP: 'view_app',
    OPEN_QUEUE: 'open_queue',
    ADD_FORM: 'add_form',
    ADD_QUESTIONS: 'add_questions',
    CREATE_PACKAGE: 'create_package',
    ADD_CLIENT: 'add_client',
    SHARE_PORTAL: 'share_portal',
    RECORD_PAYMENT: 'record_payment',
} as const;
type StepKey = typeof GETTING_STARTED_STEP[keyof typeof GETTING_STARTED_STEP];

// The checklist reads as a story in three chapters: try it on the demo, set up your work, then your first real client.
export const GETTING_STARTED_GROUP = { TRY: 'try', SETUP: 'setup', FIRST_CLIENT: 'first_client' } as const;
type GroupKey = typeof GETTING_STARTED_GROUP[keyof typeof GETTING_STARTED_GROUP];

export interface GettingStartedStatus {
    visible: boolean;
    steps: Array<{ key: StepKey; group: GroupKey; done: boolean }>;
    doneCount: number;
    total: number;
    demoClientId: string | null;
    firstRealClientId: string | null;
    portalSlug: string | null;
    // Shown in the arrow guide so the coach can sign in to the client app from the sidebar link.
    demoLogin: { email: string; password: string } | null;
}

const HIDDEN: GettingStartedStatus = { visible: false, steps: [], doneCount: 0, total: 0, demoClientId: null, firstRealClientId: null, portalSlug: null, demoLogin: null };

/**
 * What a new owner still has to do, ordered so the result comes first: see the demo, then set up a package, then the
 * first real client. Every step is read from real data (the demo client's own records never count toward the real
 * steps), so it ticks itself off and can never drift from what actually happened. The three demo steps only exist
 * while the demo client does.
 */
export async function getGettingStarted(workspaceId: string, isOwner: boolean): Promise<GettingStartedStatus> {
    if (!isOwner) return HIDDEN;
    const workspace = await prisma.workspaces.findUnique({
        where: { id: workspaceId },
        select: { slug: true, created_at: true, archived_at: true, getting_started_dismissed_at: true },
    });
    if (!workspace || workspace.archived_at || workspace.getting_started_dismissed_at) return HIDDEN;
    if (Date.now() - workspace.created_at.getTime() > CHECKLIST_WINDOW_DAYS * MS_PER_DAY) return HIDDEN;

    const [demoClient, firstRealClient, events, packages, payments] = await Promise.all([
        prisma.clients.findFirst({ where: { workspace_id: workspaceId, is_demo: true }, select: { id: true } }),
        prisma.clients.findFirst({ where: { workspace_id: workspaceId, is_demo: false, deleted_at: null }, orderBy: { created_at: 'asc' }, select: { id: true } }),
        prisma.demo_client_events.findMany({ where: { workspace_id: workspaceId }, select: { event_type: true } }),
        prisma.packages.count({ where: { workspace_id: workspaceId, is_demo: false } }),
        prisma.transactions.count({ where: { workspace_id: workspaceId, is_demo: false } }),
    ]);
    const happened = new Set(events.map((event) => event.event_type));

    const steps: GettingStartedStatus['steps'] = [
        ...(demoClient ? [
            { key: GETTING_STARTED_STEP.EDIT_DEMO, group: GETTING_STARTED_GROUP.TRY, done: happened.has(DEMO_EVENT.EDITED) },
            { key: GETTING_STARTED_STEP.VIEW_APP, group: GETTING_STARTED_GROUP.TRY, done: happened.has(DEMO_EVENT.VIEWED_APP) },
            { key: GETTING_STARTED_STEP.OPEN_QUEUE, group: GETTING_STARTED_GROUP.TRY, done: happened.has(DEMO_EVENT.QUEUE_OPENED) },
        ] : []),
        { key: GETTING_STARTED_STEP.ADD_FORM, group: GETTING_STARTED_GROUP.SETUP, done: happened.has(DEMO_EVENT.FORM_ADDED) },
        { key: GETTING_STARTED_STEP.ADD_QUESTIONS, group: GETTING_STARTED_GROUP.SETUP, done: happened.has(DEMO_EVENT.FORM_QUESTIONS_SAVED) },
        { key: GETTING_STARTED_STEP.CREATE_PACKAGE, group: GETTING_STARTED_GROUP.SETUP, done: packages > 0 },
        { key: GETTING_STARTED_STEP.ADD_CLIENT, group: GETTING_STARTED_GROUP.FIRST_CLIENT, done: !!firstRealClient },
        { key: GETTING_STARTED_STEP.SHARE_PORTAL, group: GETTING_STARTED_GROUP.FIRST_CLIENT, done: happened.has(DEMO_EVENT.REAL_CLIENT_PORTAL_LOGIN) },
        { key: GETTING_STARTED_STEP.RECORD_PAYMENT, group: GETTING_STARTED_GROUP.FIRST_CLIENT, done: payments > 0 },
    ];
    const doneCount = steps.filter((step) => step.done).length;

    return {
        // Once everything is done there is nothing left to show.
        visible: doneCount < steps.length,
        steps, doneCount, total: steps.length,
        demoClientId: demoClient?.id ?? null,
        firstRealClientId: firstRealClient?.id ?? null,
        portalSlug: workspace.slug,
        demoLogin: demoClient ? { email: DEMO_CLIENT.email, password: DEMO_CLIENT.password } : null,
    };
}

export async function dismissGettingStarted(workspaceId: string): Promise<void> {
    await prisma.workspaces.updateMany({ where: { id: workspaceId, getting_started_dismissed_at: null }, data: { getting_started_dismissed_at: new Date() } });
}

/**
 * Creates one editable package tied to the workspace's default assessment and check-in forms. Safe to call twice: if
 * the coach already has a real package, nothing is created and that package is returned.
 */
export async function createStarterPackage(workspaceId: string): Promise<{ packageId: string; created: boolean }> {
    const existing = await prisma.packages.findFirst({ where: { workspace_id: workspaceId, is_demo: false }, select: { id: true } });
    if (existing) return { packageId: existing.id, created: false };

    const [assessment, checkIn] = await Promise.all([
        prisma.forms.findFirst({ where: { workspace_id: workspaceId, is_demo: false, form_type: 'assessment' }, orderBy: { created_at: 'asc' }, select: { id: true } }),
        prisma.forms.findFirst({ where: { workspace_id: workspaceId, is_demo: false, form_type: 'check-in' }, orderBy: { created_at: 'asc' }, select: { id: true } }),
    ]);

    const packageId = createId();
    await prisma.$transaction(async (tx) => {
        await tx.packages.create({ data: { id: packageId, workspace_id: workspaceId, name: STARTER_PACKAGE_NAME } });
        const variationId = createId();
        await tx.package_variations.create({
            data: {
                id: variationId, package_id: packageId, name: STARTER_VARIATION.name, duration: STARTER_VARIATION.duration, price: STARTER_VARIATION.price,
                currency: STARTER_VARIATION.currency, nutrition_cycle_days: STARTER_VARIATION.cycleDays, training_cycle_days: STARTER_VARIATION.cycleDays,
                review_offset_days: STARTER_VARIATION.reviewOffsetDays, plan_update_mode: 'extend',
            },
        });
        const defaultForms = [
            ...(assessment ? [{ kind: 'assessment', formId: assessment.id }] : []),
            ...(checkIn ? [{ kind: 'checkin-nutrition', formId: checkIn.id }, { kind: 'checkin-training', formId: checkIn.id }] : []),
        ];
        await tx.package_default_forms.createMany({
            data: defaultForms.map((entry, index) => ({ id: createId(), package_variation_id: variationId, form_id: entry.formId, kind: entry.kind, sort_order: index + 1 })),
        });
    });
    return { packageId, created: true };
}
