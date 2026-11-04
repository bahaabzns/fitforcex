/**
 * Seeds dummy coaches, anonymous visitor history, clients and WhatsApp follow-ups into the LOCAL
 * database so the admin Conversions and Follow-ups pages have something to show: free coaches at
 * 0–3 clients, subscribed and expired coaches, coaches from before tracking ("Unknown"),
 * visitors who never signed up, and follow-ups that are due today, overdue and upcoming.
 *
 * Every dummy row is easy to find and remove:
 *   users      → email ends with @dummy-conversions.test
 *   workspaces → slug starts with dummy-conv-   (clients, subscriptions, payments, follow-ups go with them)
 *   visitors   → id starts with dddddddd-
 *
 * Idempotent: it removes its own previous rows first, then re-creates them with dates relative to now.
 * Refuses to run unless DATABASE_URL points at localhost.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-dummy-conversions.ts          # seed
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-dummy-conversions.ts --clean  # remove only
 */

import { createId } from '@paralleldrive/cuid2';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DUMMY_EMAIL_DOMAIN = 'dummy-conversions.test';
const DUMMY_SLUG_PREFIX = 'dummy-conv-';
const DUMMY_VISITOR_PREFIX = 'dddddddd-dddd-4ddd-8ddd-';
const PAID_PERIOD_DAYS = 30;
const RENEWED_PLAN_REMAINING_DAYS = 18;
const REPORT_TIME_ZONE = 'Africa/Cairo';
const NOW = Date.now();

// Cycled across the paid dummy coaches so the "paid via" chart has a realistic mix.
const PAYMENT_STYLES: Array<{ method: string; recordedByAdmin?: boolean }> = [
    { method: 'card' }, { method: 'wallet' }, { method: 'manual' }, { method: 'card', recordedByAdmin: true },
    { method: 'card' }, { method: 'manual' }, { method: 'fawry' }, { method: 'wallet' },
];
const ADMIN_RECORDED_NOTE = 'Manual payment recorded by admin: dummy seed';

type CoachKind = 'free' | 'subscribed' | 'expired';

interface FollowUpSpec {
    daysAgo:     number;
    sent:        string;
    reply?:      string;
    /** Days from today for the reminder: 0 = due today, negative = overdue, positive = upcoming. */
    nextInDays?: number;
}

interface CoachSpec {
    name:          string;
    kind:          CoachKind;
    source:        string;
    campaign?:     string;
    firstVisitDaysAgo: number;
    daysToSignup:  number;
    visitsBeforeSignup: number;
    daysSignupToPaid?: number;
    visitsBetweenSignupAndPaid?: number;
    tracked:       boolean;
    clients:       number;
    phone?:        string | null;
    followUps?:    FollowUpSpec[];
    /** A manual transfer the coach started that is still waiting for the admin to confirm it. */
    pendingTransferDaysAgo?: number;
    /** A 0 EGP payment the admin granted — must not count as a subscription. */
    hasFreeGrant?: boolean;
}

const COACHES: CoachSpec[] = [
    // ── Subscribed ─────────────────────────────────────────────────────────────
    { name: 'Amr Fitness Studio',   kind: 'subscribed', source: 'Facebook/Instagram ad', campaign: 'dummy-ramadan-offer', firstVisitDaysAgo: 48, daysToSignup: 3,  visitsBeforeSignup: 4, daysSignupToPaid: 9,  visitsBetweenSignupAndPaid: 3, tracked: true, clients: 9,
      followUps: [{ daysAgo: 40, sent: 'Welcome message + offered a quick onboarding call', reply: 'Booked a call for tomorrow' }] },
    { name: 'Sara Coaching',        kind: 'subscribed', source: 'Instagram',                                              firstVisitDaysAgo: 61, daysToSignup: 0,  visitsBeforeSignup: 1, daysSignupToPaid: 11, visitsBetweenSignupAndPaid: 5, tracked: true, clients: 7,
      followUps: [{ daysAgo: 20, sent: 'Checked in after her first month', reply: 'Loves the nutrition builder', nextInDays: 10 }] },
    { name: 'Karim Strength',       kind: 'subscribed', source: 'TikTok ad',             campaign: 'dummy-tiktok-spring', firstVisitDaysAgo: 40, daysToSignup: 6,  visitsBeforeSignup: 6, daysSignupToPaid: 14, visitsBetweenSignupAndPaid: 2, tracked: true, clients: 5 },
    { name: 'Nour Wellness',        kind: 'subscribed', source: 'Google',                                                 firstVisitDaysAgo: 35, daysToSignup: 1,  visitsBeforeSignup: 3, daysSignupToPaid: 8,  visitsBetweenSignupAndPaid: 4, tracked: true, clients: 6 },
    { name: 'Omar Athletics',       kind: 'subscribed', source: 'WhatsApp',                                               firstVisitDaysAgo: 29, daysToSignup: 0,  visitsBeforeSignup: 2, daysSignupToPaid: 5,  visitsBetweenSignupAndPaid: 2, tracked: true, clients: 4 },
    { name: 'Hana Transformations', kind: 'subscribed', source: 'YouTube',                                                firstVisitDaysAgo: 55, daysToSignup: 12, visitsBeforeSignup: 9, daysSignupToPaid: 10, visitsBetweenSignupAndPaid: 3, tracked: true, clients: 8 },
    { name: 'Youssef PT',           kind: 'subscribed', source: 'direct',                                                 firstVisitDaysAgo: 33, daysToSignup: 2,  visitsBeforeSignup: 3, daysSignupToPaid: 2,  visitsBetweenSignupAndPaid: 1, tracked: true, clients: 4 },
    { name: 'Mariam Nutrition',     kind: 'subscribed', source: 'Facebook/Instagram ad', campaign: 'dummy-ramadan-offer', firstVisitDaysAgo: 21, daysToSignup: 0,  visitsBeforeSignup: 1, daysSignupToPaid: 1,  visitsBetweenSignupAndPaid: 0, tracked: true, clients: 5 },
    // ── Expired (paid once, plan ran out) ──────────────────────────────────────
    { name: 'Ali Hamdy Coaching',   kind: 'expired',    source: 'Instagram',                                              firstVisitDaysAgo: 95, daysToSignup: 7,  visitsBeforeSignup: 5, daysSignupToPaid: 6,  visitsBetweenSignupAndPaid: 2, tracked: true, clients: 4,
      followUps: [{ daysAgo: 4, sent: 'Asked why he did not renew', reply: 'Budget is tight, will renew next month', nextInDays: 20 }] , pendingTransferDaysAgo: 1 },
    { name: 'Mostafa Pro Fit',      kind: 'expired',    source: 'Google',                                                 firstVisitDaysAgo: 110, daysToSignup: 5, visitsBeforeSignup: 4, daysSignupToPaid: 20, visitsBetweenSignupAndPaid: 3, tracked: true, clients: 6,
      followUps: [{ daysAgo: 12, sent: 'Sent a renewal offer (10% off)', nextInDays: -5 }] },
    // ── Free coaches (never paid) ──────────────────────────────────────────────
    { name: 'Dina Fit',             kind: 'free', source: 'Instagram',                                      firstVisitDaysAgo: 10, daysToSignup: 1, visitsBeforeSignup: 2, tracked: true, clients: 3, pendingTransferDaysAgo: 2,
      followUps: [
          { daysAgo: 8, sent: 'Welcome message + quick tour offer', reply: 'Thanks! Will add clients this week' },
          { daysAgo: 3, sent: 'Told her about the 3-client limit and the paid plans', reply: 'Asked about pricing', nextInDays: 0 },
      ] },
    { name: 'Tamer Gym Online',     kind: 'free', source: 'Facebook/Instagram ad', campaign: 'dummy-lead-form', firstVisitDaysAgo: 6,  daysToSignup: 0, visitsBeforeSignup: 1, tracked: true, clients: 1 },
    { name: 'Laila Body Lab',       kind: 'free', source: 'Google',                                         firstVisitDaysAgo: 14, daysToSignup: 4, visitsBeforeSignup: 3, tracked: true, clients: 2, phone: null,
      followUps: [{ daysAgo: 2, sent: 'Emailed — no WhatsApp number on file', nextInDays: 2 }] },
    { name: 'Hossam Coach',         kind: 'free', source: 'direct',                                         firstVisitDaysAgo: 3,  daysToSignup: 0, visitsBeforeSignup: 1, tracked: true, clients: 0 , hasFreeGrant: true },
    { name: 'Rana Strong',          kind: 'free', source: 'TikTok ad',             campaign: 'dummy-tiktok-spring', firstVisitDaysAgo: 12, daysToSignup: 2, visitsBeforeSignup: 4, tracked: true, clients: 3,
      followUps: [{ daysAgo: 9, sent: 'Welcome message', nextInDays: -2 }] },
    { name: 'Salma Studio',         kind: 'free', source: 'Instagram',                                      firstVisitDaysAgo: 52, daysToSignup: 1, visitsBeforeSignup: 2, tracked: true, clients: 1,
      followUps: [
          { daysAgo: 40, sent: 'Welcome message', reply: 'Just exploring' },
          { daysAgo: 12, sent: 'Shared the new client portal video', reply: 'Nice, will try it', nextInDays: 5 },
      ] },
    { name: 'Khaled Online',        kind: 'free', source: 'direct',                                         firstVisitDaysAgo: 44, daysToSignup: 9, visitsBeforeSignup: 7, tracked: true, clients: 0,
      followUps: [{ daysAgo: 30, sent: 'Welcome message', reply: 'Not interested for now' }] },
    { name: 'Noha Fit',             kind: 'free', source: 'Instagram',                                      firstVisitDaysAgo: 2,  daysToSignup: 0, visitsBeforeSignup: 1, tracked: true, clients: 0 },
    { name: 'Bassem Training',      kind: 'free', source: 'Google',                                         firstVisitDaysAgo: 20, daysToSignup: 3, visitsBeforeSignup: 2, tracked: true, clients: 2,
      followUps: [{ daysAgo: 6, sent: 'Asked how setup is going', reply: 'Still moving clients over', nextInDays: -1 }] },
    { name: 'Farah Active',         kind: 'free', source: 'WhatsApp',                                       firstVisitDaysAgo: 27, daysToSignup: 5, visitsBeforeSignup: 3, tracked: true, clients: 3,
      followUps: [{ daysAgo: 15, sent: 'Welcome message', reply: 'Busy this week, message me next week', nextInDays: -3 }] , pendingTransferDaysAgo: 6 },
    { name: 'Ziad Performance',     kind: 'free', source: 'Facebook/Instagram ad', campaign: 'dummy-lead-form', firstVisitDaysAgo: 8,  daysToSignup: 0, visitsBeforeSignup: 1, tracked: true, clients: 1 },
    { name: 'Mona Wellness',        kind: 'free', source: 'YouTube',                                        firstVisitDaysAgo: 75, daysToSignup: 10, visitsBeforeSignup: 6, tracked: true, clients: 0, phone: '+2012321234323456543' },
    { name: 'Tarek Coaching',       kind: 'free', source: 'TikTok ad',             campaign: 'dummy-tiktok-spring', firstVisitDaysAgo: 16, daysToSignup: 1, visitsBeforeSignup: 2, tracked: true, clients: 2,
      followUps: [{ daysAgo: 1, sent: 'Welcome message', reply: 'Will check this evening', nextInDays: 0 }] , pendingTransferDaysAgo: 0 },
    // ── From before tracking existed: no visitor history ("Unknown") ───────────
    { name: 'Legacy Coach One',     kind: 'subscribed', source: '', firstVisitDaysAgo: 150, daysToSignup: 0, visitsBeforeSignup: 0, daysSignupToPaid: 2,  tracked: false, clients: 11 },
    { name: 'Legacy Coach Two',     kind: 'subscribed', source: '', firstVisitDaysAgo: 120, daysToSignup: 0, visitsBeforeSignup: 0, daysSignupToPaid: 10, tracked: false, clients: 6 },
    { name: 'Legacy Coach Three',   kind: 'expired',    source: '', firstVisitDaysAgo: 140, daysToSignup: 0, visitsBeforeSignup: 0, daysSignupToPaid: 1,  tracked: false, clients: 4 },
    { name: 'Legacy Free One',      kind: 'free',       source: '', firstVisitDaysAgo: 130, daysToSignup: 0, visitsBeforeSignup: 0, tracked: false, clients: 0 },
    { name: 'Legacy Free Two',      kind: 'free',       source: '', firstVisitDaysAgo: 100, daysToSignup: 0, visitsBeforeSignup: 0, tracked: false, clients: 1 },
    { name: 'Legacy Free Three',    kind: 'free',       source: '', firstVisitDaysAgo: 70,  daysToSignup: 0, visitsBeforeSignup: 0, tracked: false, clients: 3 },
];

// Visitors who browsed but never signed up — makes the visitors table look like real traffic.
const BROWSE_ONLY_SOURCES = ['Instagram', 'Facebook/Instagram ad', 'Google', 'direct', 'TikTok ad', 'WhatsApp', 'YouTube'];
const BROWSE_ONLY_COUNT = 60;

function assertLocalDatabase(): void {
    const url = process.env.DATABASE_URL ?? '';
    const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
    if (host !== 'localhost' && host !== '127.0.0.1') {
        throw new Error(`Refusing to seed dummy data: DATABASE_URL host is "${host || 'unknown'}", expected localhost`);
    }
}

function visitorIdFor(index: number): string {
    return `${DUMMY_VISITOR_PREFIX}${String(index).padStart(12, '0')}`;
}

function at(daysAgo: number): number {
    return NOW - daysAgo * DAY_MS;
}

// Calendar date in Cairo, which is what the admin page uses for "due today".
function cairoDateInDays(offsetDays: number): Date {
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE }).format(new Date(NOW + offsetDays * DAY_MS));
    return new Date(iso);
}

async function removeDummyRows(): Promise<void> {
    const dummyUsers = await prisma.users.findMany({
        where:  { email: { endsWith: `@${DUMMY_EMAIL_DOMAIN}` } },
        select: { id: true },
    });
    const userIds = dummyUsers.map(user => user.id);

    // users.default_workspace_id → workspaces: break the link before deleting either side.
    await prisma.users.updateMany({ where: { id: { in: userIds } }, data: { default_workspace_id: null } });
    await prisma.clients.deleteMany({ where: { workspaces: { slug: { startsWith: DUMMY_SLUG_PREFIX } } } });
    // Subscriptions, payments, subscription events and follow-ups cascade with the workspace.
    await prisma.workspaces.deleteMany({ where: { slug: { startsWith: DUMMY_SLUG_PREFIX } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
    // Sessions cascade with the visitor.
    await prisma.visitors.deleteMany({ where: { id: { startsWith: DUMMY_VISITOR_PREFIX } } });
}

interface PlanRef { planId: string; variationId: string | null; price: Prisma.Decimal | null; currency: string | null }
interface PlanRefs { paid: PlanRef; free: PlanRef }

async function loadPlans(): Promise<PlanRefs> {
    const pick = async (name: string): Promise<PlanRef> => {
        const plan = await prisma.plans.findFirst({
            where:  { name, is_active: true },
            select: { id: true, plan_variations: { where: { is_default: true }, select: { id: true, price_monthly: true, currency: true } } },
        });
        if (!plan) throw new Error(`Plan "${name}" not found — run seed-pricing-plans.ts first`);
        const variation = plan.plan_variations[0];
        return { planId: plan.id, variationId: variation?.id ?? null, price: variation?.price_monthly ?? null, currency: variation?.currency ?? null };
    };
    return { paid: await pick('oneforce'), free: await pick('free') };
}

// Evenly spaced start times from `from` up to (but never past) `to`.
function sessionTimes(from: number, to: number, count: number): number[] {
    return Array.from({ length: count }, (_, index) => from + ((to - from) * index) / Math.max(count, 1));
}

async function createVisitorWithSessions(id: string, spec: Pick<CoachSpec, 'source' | 'campaign'>, sessionStarts: number[]): Promise<void> {
    const sorted = [...sessionStarts].sort((a, b) => a - b);
    await prisma.visitors.create({
        data: {
            id,
            first_seen_at:      new Date(sorted[0]),
            last_seen_at:       new Date(sorted[sorted.length - 1]),
            first_source:       spec.source,
            first_utm_campaign: spec.campaign ?? null,
            first_fbclid:       spec.source === 'Facebook/Instagram ad',
            first_landing_path: '/',
        },
    });
    await prisma.visitor_sessions.createMany({
        data: sorted.map(start => ({
            id: createId(), visitor_id: id,
            started_at: new Date(start), last_seen_at: new Date(start + 6 * MINUTE_MS),
            page_count: 1 + Math.floor((start / MINUTE_MS) % 4), landing_path: '/',
        })),
    });
}

function phoneFor(spec: CoachSpec, index: number): string | null {
    if (spec.phone !== undefined) return spec.phone;
    return `+2010999${String(index).padStart(5, '0')}`;
}

async function createCoach(spec: CoachSpec, index: number, plans: PlanRefs): Promise<void> {
    const firstVisit = at(spec.firstVisitDaysAgo);
    const signedUp   = firstVisit + spec.daysToSignup * DAY_MS + 2 * HOUR_MS;
    const paidAt     = spec.kind === 'free' ? null : signedUp + (spec.daysSignupToPaid ?? 0) * DAY_MS + 5 * MINUTE_MS;

    let visitorId: string | null = null;
    if (spec.tracked) {
        visitorId = visitorIdFor(index);
        const beforeSignup = sessionTimes(firstVisit, signedUp - HOUR_MS, spec.visitsBeforeSignup);
        const betweenTimes = paidAt
            ? sessionTimes(signedUp + HOUR_MS, paidAt - HOUR_MS, (spec.visitsBetweenSignupAndPaid ?? 0) + 1).slice(1)
            : [];
        await createVisitorWithSessions(visitorId, spec, [...beforeSignup, ...betweenTimes]);
    }

    const userId      = createId();
    const workspaceId = createId();
    const slugBase    = `${DUMMY_SLUG_PREFIX}${index}`;

    await prisma.users.create({
        data: {
            id: userId, fname: spec.name.split(' ')[0], lname: spec.name.split(' ').slice(1).join(' ') || 'Coach',
            email: `${slugBase}@${DUMMY_EMAIL_DOMAIN}`, password: 'dummy-not-a-real-hash',
            phone: phoneFor(spec, index), email_verified: true, created_at: new Date(signedUp),
        },
    });
    await prisma.workspaces.create({
        data: {
            id: workspaceId, slug: slugBase, name: spec.name, owner_id: userId,
            created_at: new Date(signedUp), visitor_id: visitorId,
        },
    });
    await prisma.users.update({ where: { id: userId }, data: { default_workspace_id: workspaceId } });

    await createSubscriptionRows({ spec, workspaceId, signedUp, paidAt, plans, paymentStyle: PAYMENT_STYLES[index % PAYMENT_STYLES.length] });
    await createClients(workspaceId, spec.clients, index);
    await createFollowUps(workspaceId, spec.followUps ?? []);
    await createExtraPayments({ spec, workspaceId, index, plans });
}

// Payments that are not the coach's first real subscription: a transfer waiting to be confirmed,
// and a free grant. Both exist to show the admin pages ignore or flag them correctly.
async function createExtraPayments(input: { spec: CoachSpec; workspaceId: string; index: number; plans: PlanRefs }): Promise<void> {
    const { spec, workspaceId, index, plans } = input;
    const { paid } = plans;
    const base = {
        workspace_id: workspaceId, plan_id: paid.planId, variation_id: paid.variationId,
        currency: paid.currency ?? 'EGP', duration_days: PAID_PERIOD_DAYS,
    };

    if (spec.pendingTransferDaysAgo !== undefined) {
        await prisma.workspace_payments.create({
            data: {
                ...base, id: createId(), amount: paid.price ?? 0, gateway_status: 'pending', payment_method: 'manual',
                reference_code: `DUMMY-${String(index).padStart(4, '0')}`, created_at: new Date(at(spec.pendingTransferDaysAgo)),
            },
        });
    }
    if (spec.hasFreeGrant) {
        await prisma.workspace_payments.create({
            data: {
                ...base, id: createId(), amount: 0, gateway_status: 'paid', payment_method: 'manual',
                paid_at: new Date(at(1)), created_at: new Date(at(1)), notes: 'Free grant (dummy seed)',
            },
        });
    }
}

async function createSubscriptionRows(input: {
    spec: CoachSpec; workspaceId: string; signedUp: number; paidAt: number | null; plans: PlanRefs;
    paymentStyle: { method: string; recordedByAdmin?: boolean };
}): Promise<void> {
    const { spec, workspaceId, signedUp, paidAt, plans, paymentStyle } = input;
    const { paid, free } = plans;

    if (spec.kind === 'free' || !paidAt) {
        await prisma.workspace_subscriptions.create({
            data: {
                id: createId(), workspace_id: workspaceId, plan_id: free.planId, variation_id: free.variationId,
                locked_price_monthly: free.price, locked_currency: free.currency, status: 'active',
                starts_at: new Date(signedUp), expires_at: null, created_at: new Date(signedUp),
            },
        });
        return;
    }

    // Subscribed = renewed and running; expired = the single 30-day period has long finished.
    const expiresAt = spec.kind === 'subscribed'
        ? NOW + RENEWED_PLAN_REMAINING_DAYS * DAY_MS
        : paidAt + PAID_PERIOD_DAYS * DAY_MS;

    await prisma.workspace_subscriptions.create({
        data: {
            id: createId(), workspace_id: workspaceId, plan_id: paid.planId, variation_id: paid.variationId,
            locked_price_monthly: paid.price, locked_currency: paid.currency, status: 'active',
            starts_at: new Date(paidAt), expires_at: new Date(expiresAt), created_at: new Date(signedUp),
        },
    });
    await prisma.workspace_payments.create({
        data: {
            id: createId(), workspace_id: workspaceId, plan_id: paid.planId, variation_id: paid.variationId,
            amount: paid.price ?? 0, currency: paid.currency ?? 'EGP', duration_days: PAID_PERIOD_DAYS,
            gateway_status: 'paid', payment_method: paymentStyle.method, paid_at: new Date(paidAt), created_at: new Date(paidAt),
            notes: paymentStyle.recordedByAdmin ? ADMIN_RECORDED_NOTE : null,
        },
    });
}

async function createClients(workspaceId: string, count: number, coachIndex: number): Promise<void> {
    if (count === 0) return;
    await prisma.clients.createMany({
        data: Array.from({ length: count }, (_, position) => ({
            id: createId(), client_code: 10000 + position, fname: 'Dummy', lname: `Client ${coachIndex}-${position + 1}`,
            email: `dummy-client-${coachIndex}-${position + 1}@${DUMMY_EMAIL_DOMAIN}`, workspace_id: workspaceId,
        })),
    });
}

async function createFollowUps(workspaceId: string, followUps: FollowUpSpec[]): Promise<void> {
    if (followUps.length === 0) return;
    await prisma.admin_follow_ups.createMany({
        data: followUps.map(followUp => ({
            id: createId(), workspace_id: workspaceId,
            followed_up_at: new Date(at(followUp.daysAgo)),
            sent_note: followUp.sent, reply_note: followUp.reply ?? null,
            next_follow_up_on: followUp.nextInDays === undefined ? null : cairoDateInDays(followUp.nextInDays),
        })),
    });
}

async function createBrowseOnlyVisitors(): Promise<void> {
    for (let index = 0; index < BROWSE_ONLY_COUNT; index++) {
        const firstVisit = at(1 + (index * 3) % 80);
        const sessionCount = 1 + (index % 3);
        const starts = Array.from({ length: sessionCount }, (_, step) => firstVisit + step * 2 * DAY_MS).filter(start => start < NOW);
        await createVisitorWithSessions(
            visitorIdFor(1000 + index),
            { source: BROWSE_ONLY_SOURCES[(index * 5) % BROWSE_ONLY_SOURCES.length] },
            starts,
        );
    }
}

async function main(): Promise<void> {
    assertLocalDatabase();
    await removeDummyRows();
    if (process.argv.includes('--clean')) {
        console.log('Removed all dummy conversion rows.');
        return;
    }

    const plans = await loadPlans();
    for (const [index, spec] of COACHES.entries()) {
        await createCoach(spec, index + 1, plans);
    }
    await createBrowseOnlyVisitors();
    console.log(`Seeded ${COACHES.length} dummy coaches and ${BROWSE_ONLY_COUNT} browse-only visitors.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
