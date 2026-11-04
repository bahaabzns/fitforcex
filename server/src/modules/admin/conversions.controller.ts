import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { COACH_STATUS_SQL_TEXT, CoachStatus } from './coachStatus';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKS_IN_TREND = 12;
const REPORT_TIME_ZONE = 'Africa/Cairo';

// Upper bound (exclusive, in days) of each "how long did it take" bucket; the last is open-ended.
const TIME_TO_SUBSCRIBE_BUCKETS: Array<{ label: string; upTo: number }> = [
    { label: 'Same day',  upTo: 1 },
    { label: '1–3 days',  upTo: 4 },
    { label: '4–7 days',  upTo: 8 },
    { label: '8–14 days', upTo: 15 },
    { label: '15–30 days', upTo: 31 },
    { label: '31+ days',  upTo: Infinity },
];

interface PaidCoachRow {
    workspace_id:   string;
    workspace_name: string;
    workspace_slug: string;
    owner_fname:    string;
    owner_lname:    string;
    owner_email:    string;
    status:         CoachStatus;
    signed_up_at:   Date;
    paid_at:        Date;
    payment_method: string | null;
    amount:         string;
    currency:       string;
    recorded_by_admin: boolean;
    first_seen_at:  Date | null;
    first_source:   string | null;
    first_utm_campaign: string | null;
    visits_before_paid: number | null;
}

interface FunnelRow { visitors: number; signed_up: number; subscribed: number }
interface SourceRow { source: string; visitors: number; signups: number; subscribers: number }
interface WeekRow   { week_start: string; signups: number; subscriptions: number }

// Whole-day gaps hide the difference between "same day" and "next morning", so keep one decimal.
function daysBetween(from: Date, to: Date): number {
    return Math.max(0, Math.round(((to.getTime() - from.getTime()) / MS_PER_DAY) * 10) / 10);
}

function roundOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}

function averageOf(values: number[]): { value: number | null; basedOn: number } {
    if (values.length === 0) return { value: null, basedOn: 0 };
    const sum = values.reduce((total, current) => total + current, 0);
    return { value: roundOneDecimal(sum / values.length), basedOn: values.length };
}

function medianOf(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return roundOneDecimal(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

// Payments you record yourself carry no real payment method (it defaults to "card"), so the
// "recorded by admin" flag decides — otherwise they'd be mislabelled as card payments.
type PaidVia = 'card' | 'wallet' | 'fawry' | 'manual' | 'admin';
const KNOWN_PAYMENT_METHODS = ['card', 'wallet', 'fawry', 'manual'];

function paidViaOf(row: Pick<PaidCoachRow, 'payment_method' | 'recorded_by_admin'>): PaidVia {
    if (row.recorded_by_admin) return 'admin';
    return KNOWN_PAYMENT_METHODS.includes(row.payment_method ?? '') ? (row.payment_method as PaidVia) : 'card';
}

function tallyPaidVia(coaches: Array<{ paidVia: PaidVia }>): Array<{ method: PaidVia; count: number }> {
    const counts = new Map<PaidVia, number>();
    coaches.forEach(coach => counts.set(coach.paidVia, (counts.get(coach.paidVia) ?? 0) + 1));
    return [...counts.entries()].map(([method, count]) => ({ method, count })).sort((a, b) => b.count - a.count);
}

function bucketTimeToSubscribe(daysList: number[]): Array<{ label: string; count: number }> {
    return TIME_TO_SUBSCRIBE_BUCKETS.map((bucket, index) => {
        const lowerBound = index === 0 ? -Infinity : TIME_TO_SUBSCRIBE_BUCKETS[index - 1].upTo;
        return { label: bucket.label, count: daysList.filter(days => days >= lowerBound && days < bucket.upTo).length };
    });
}

// Same rule for queries that join workspace_payments under the `wp` alias.
// Written by admin.controller createManualPayment into every payment an admin records by hand.
const ADMIN_RECORDED_NOTE_PREFIX = 'Manual payment recorded by admin';
// 0 EGP payments are free grants you gave a coach, not a conversion, so they never count.
const PAID_PAYMENT_FILTER_WP = `wp.gateway_status = 'paid' AND wp.addon_id IS NULL AND wp.paid_at IS NOT NULL AND wp.amount > 0`;

// A coach's subscription date is their first real (non add-on) paid payment — card, wallet, Fawry,
// a manual transfer you confirmed, or a payment you recorded yourself all land here, because every
// route ends in applyPayment(), which stamps gateway_status = 'paid'.
//
// paid_at is the moment the payment was marked paid, which for manual payments is when you pressed
// the button. When a manual payment was recorded with an earlier start date, that backdated start is
// the real date the coach began paying, so it wins (LEAST also ignores a start date set in the future).
const FIRST_PAYMENT_CTE = `
    payment_candidates AS (
        SELECT
            wp.workspace_id, wp.id AS payment_id, wp.payment_method, wp.amount, wp.currency,
            LEAST(wp.paid_at, COALESCE(backdated.starts_at, wp.paid_at)) AS paid_on,
            -- the event row says an admin applied it; the note is the fallback for the case where
            -- no admin id was available to tag the event
            (wp.notes LIKE '${ADMIN_RECORDED_NOTE_PREFIX}%' OR EXISTS (
                SELECT 1 FROM workspace_subscription_events e
                WHERE e.payment_id = wp.id AND e.actor_type = 'admin'
            )) AS recorded_by_admin
        FROM workspace_payments wp
        LEFT JOIN LATERAL (
            SELECT e.starts_at FROM workspace_subscription_events e
            WHERE e.payment_id = wp.id AND e.event_type = 'admin_manual'
            ORDER BY e.created_at DESC LIMIT 1
        ) backdated ON TRUE
        WHERE ${PAID_PAYMENT_FILTER_WP}
    ),
    first_payment AS (
        SELECT DISTINCT ON (workspace_id) *
        FROM payment_candidates
        ORDER BY workspace_id, paid_on ASC
    )
`;

async function fetchPaidCoaches(): Promise<PaidCoachRow[]> {
    return prisma.$queryRawUnsafe<PaidCoachRow[]>(`
        WITH ${FIRST_PAYMENT_CTE}
        SELECT
            w.id AS workspace_id, w.name AS workspace_name, w.slug AS workspace_slug,
            u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
            ${COACH_STATUS_SQL_TEXT} AS status,
            w.created_at AS signed_up_at, fp.paid_on AS paid_at,
            fp.payment_method, fp.amount::text AS amount, fp.currency, fp.recorded_by_admin,
            v.first_seen_at, v.first_source, v.first_utm_campaign,
            CASE WHEN v.id IS NULL THEN NULL ELSE (
                SELECT COUNT(*)::int FROM visitor_sessions s
                WHERE s.visitor_id = v.id AND s.deleted_at IS NULL AND s.started_at <= fp.paid_on
            ) END AS visits_before_paid
        FROM first_payment fp
        JOIN workspaces w ON w.id = fp.workspace_id
        JOIN users u ON u.id = w.owner_id
        LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
        LEFT JOIN plans sp ON sp.id = ws.plan_id
        LEFT JOIN visitors v ON v.id = w.visitor_id AND v.deleted_at IS NULL
        ORDER BY fp.paid_on DESC
    `);
}

// Same cohort at every step (tracked visitors), so the percentages are apples to apples.
async function fetchFunnel(): Promise<FunnelRow> {
    const rows = await prisma.$queryRawUnsafe<FunnelRow[]>(`
        SELECT
            COUNT(*)::int AS visitors,
            COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM workspaces w WHERE w.visitor_id = v.id
            ))::int AS signed_up,
            COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM workspaces w
                JOIN workspace_payments wp ON wp.workspace_id = w.id
                WHERE w.visitor_id = v.id AND ${PAID_PAYMENT_FILTER_WP}
            ))::int AS subscribed
        FROM visitors v
        WHERE v.deleted_at IS NULL
    `);
    return rows[0];
}

async function fetchSourceBreakdown(): Promise<SourceRow[]> {
    return prisma.$queryRawUnsafe<SourceRow[]>(`
        SELECT
            v.first_source AS source,
            COUNT(*)::int AS visitors,
            COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM workspaces w WHERE w.visitor_id = v.id
            ))::int AS signups,
            COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM workspaces w
                JOIN workspace_payments wp ON wp.workspace_id = w.id
                WHERE w.visitor_id = v.id AND ${PAID_PAYMENT_FILTER_WP}
            ))::int AS subscribers
        FROM visitors v
        WHERE v.deleted_at IS NULL
        GROUP BY v.first_source
        ORDER BY signups DESC, visitors DESC
    `);
}

// Every workspace counts as a signup here (not only tracked ones), so the trend is the real picture.
async function fetchWeeklyTrend(): Promise<WeekRow[]> {
    return prisma.$queryRawUnsafe<WeekRow[]>(`
        WITH weeks AS (
            SELECT generate_series(
                date_trunc('week', now() AT TIME ZONE '${REPORT_TIME_ZONE}') - interval '${WEEKS_IN_TREND - 1} weeks',
                date_trunc('week', now() AT TIME ZONE '${REPORT_TIME_ZONE}'),
                interval '1 week'
            ) AS week_start
        ),
        ${FIRST_PAYMENT_CTE}
        SELECT
            to_char(week_start, 'YYYY-MM-DD') AS week_start,
            (SELECT COUNT(*)::int FROM workspaces w
              WHERE date_trunc('week', w.created_at AT TIME ZONE '${REPORT_TIME_ZONE}') = week_start) AS signups,
            (SELECT COUNT(*)::int FROM first_payment fp
              WHERE date_trunc('week', fp.paid_on AT TIME ZONE '${REPORT_TIME_ZONE}') = week_start) AS subscriptions
        FROM weeks
        ORDER BY week_start
    `);
}

async function countAllSignups(): Promise<number> {
    return prisma.workspaces.count();
}

export async function getConversions(_req: Request, res: Response, next: NextFunction) {
    try {
        const [rows, funnel, bySource, weekly, totalSignups] = await Promise.all([
            fetchPaidCoaches(), fetchFunnel(), fetchSourceBreakdown(), fetchWeeklyTrend(), countAllSignups(),
        ]);

        const coaches = rows.map(row => ({
            workspaceId:   row.workspace_id,
            workspaceName: row.workspace_name,
            workspaceSlug: row.workspace_slug,
            ownerName:     `${row.owner_fname} ${row.owner_lname}`.trim(),
            ownerEmail:    row.owner_email,
            status:        row.status,
            // null = unknown (coach signed up before visitor tracking existed)
            firstVisitAt:  row.first_seen_at,
            signedUpAt:    row.signed_up_at,
            paidAt:        row.paid_at,
            paidVia:       paidViaOf(row),
            paidAmount:    Number(row.amount),
            paidCurrency:  row.currency,
            visitsBeforeSubscribing: row.visits_before_paid,
            daysToSubscribe:         row.first_seen_at ? daysBetween(row.first_seen_at, row.paid_at) : null,
            // Known for every subscriber — only needs the signup and payment dates.
            daysOnFreeBeforePaying:  daysBetween(row.signed_up_at, row.paid_at),
            firstSource:   row.first_seen_at ? row.first_source : null,
            firstCampaign: row.first_seen_at ? row.first_utm_campaign : null,
        }));

        // Averages use only coaches that have real tracking data, so "unknown" rows can't skew them.
        const tracked = (pick: (coach: typeof coaches[number]) => number | null) =>
            coaches.map(pick).filter((value): value is number => value !== null);
        const daysToSubscribe = tracked(coach => coach.daysToSubscribe);

        res.json({
            coaches,
            summary: {
                totalSignups,
                totalSubscribers:   coaches.length,
                trackedSubscribers: daysToSubscribe.length,
                avgDaysToSubscribe:   averageOf(daysToSubscribe),
                medianDaysToSubscribe: medianOf(daysToSubscribe),
                avgVisitsBeforeSubscribing: averageOf(tracked(coach => coach.visitsBeforeSubscribing)),
                avgDaysOnFreeBeforePaying:  averageOf(coaches.map(coach => coach.daysOnFreeBeforePaying)),
            },
            paidVia: tallyPaidVia(coaches),
            funnel: { visitors: funnel.visitors, signedUp: funnel.signed_up, subscribed: funnel.subscribed },
            bySource,
            weekly: weekly.map(week => ({ weekStart: week.week_start, signups: week.signups, subscriptions: week.subscriptions })),
            timeToSubscribe: bucketTimeToSubscribe(daysToSubscribe),
        });
    } catch (err) {
        next(err);
    }
}
