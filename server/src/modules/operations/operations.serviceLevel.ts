import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { DemandFilters, demandFilterSql } from './operations.service';
import { TrendRange, addDays, daysBetween } from './operations.trend';
import { resolvePeopleForWork } from './operations.finished';

export const MIN_TARGET_DAYS = 1;
export const MAX_TARGET_DAYS = 30;
const HOURS_PER_DAY = 24;

// One finished plan: who is credited, the local day it was finished, and how long the client waited.
export interface TurnaroundRow { userId: string | null; date: string; hours: number }

export interface OpenWait { open: number; overdue: number; longestHours: number }

const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const pct = (part: number, whole: number) => (whole > 0 ? round1((part / whole) * 100) : null);

interface Bucket { finished: number; onTime: number; hours: number[] }
const emptyBucket = (): Bucket => ({ finished: 0, onTime: 0, hours: [] });

function summarize(bucket: Bucket) {
    return {
        finished: bucket.finished,
        onTime: bucket.onTime,
        onTimePct: pct(bucket.onTime, bucket.finished),
        averageHours: average(bucket.hours) === null ? null : round1(average(bucket.hours) as number),
    };
}

// Pure. A plan is "on time" when the client waited no longer than the goal. `dates` is the continuous
// list of days to report; work credited to someone outside `people` stays in the totals as unattributed.
export function buildServiceLevel(args: {
    rows: TurnaroundRow[];
    people: Array<{ userId: string; name: string; role: string; isOwner: boolean }>;
    dates: string[];
    targetDays: number;
    open: OpenWait;
}) {
    const { rows, people, dates, targetDays, open } = args;
    const targetHours = targetDays * HOURS_PER_DAY;
    const dayIndex = new Map(dates.map((date, i) => [date, i]));
    const perDay = dates.map(emptyBucket);
    const perPerson = new Map<string, Bucket>();
    const total = emptyBucket();
    const unattributed = emptyBucket();
    const known = new Set(people.map((p) => p.userId));

    for (const row of rows) {
        const index = dayIndex.get(row.date);
        if (index === undefined) continue;
        const isOnTime = row.hours <= targetHours;
        const buckets = [perDay[index], total];
        if (row.userId && known.has(row.userId)) buckets.push(perPerson.get(row.userId) ?? perPerson.set(row.userId, emptyBucket()).get(row.userId)!);
        else buckets.push(unattributed);
        for (const bucket of buckets) {
            bucket.finished += 1;
            bucket.hours.push(row.hours);
            if (isOnTime) bucket.onTime += 1;
        }
    }

    const overall = summarize(total);
    const medianHours = median(total.hours);
    return {
        targetDays,
        finished: overall.finished,
        onTime: overall.onTime,
        onTimePct: overall.onTimePct,
        averageHours: overall.averageHours,
        medianHours: medianHours === null ? null : round1(medianHours),
        // Plans still waiting right now, judged against the same goal.
        waiting: {
            open: open.open,
            overdue: open.overdue,
            longestHours: round1(open.longestHours),
        },
        daily: dates.map((date, i) => ({ date, ...summarize(perDay[i]) })),
        // Most plans finished first; people with none stay listed so a quiet period is visible.
        people: people
            .map((person) => ({ ...person, ...summarize(perPerson.get(person.userId) ?? emptyBucket()) }))
            .sort((a, b) => b.finished - a.finished || a.name.localeCompare(b.name)),
        unattributed: summarize(unattributed),
    };
}

interface TurnaroundSql { userId: string | null; day: string; hours: number }

// Plans finished in the range, with how long each client waited (submission to finish). Credited to whoever
// finished them, or for older rows the assignee. Negative waits (clock quirks) are clamped to zero.
async function loadTurnaroundRows(workspaceId: string, range: TrendRange, timeZone: string, filters: DemandFilters): Promise<TurnaroundRow[]> {
    const localDay = Prisma.sql`(fr.action_taken_at AT TIME ZONE ${timeZone})::date`;
    const rows = await prisma.$queryRaw<TurnaroundSql[]>`
        SELECT COALESCE(fr.action_taken_by, fr.assigned_to) AS "userId",
               to_char(${localDay}, 'YYYY-MM-DD') AS "day",
               GREATEST(0, EXTRACT(EPOCH FROM (fr.action_taken_at - (fr.submitted_at AT TIME ZONE 'UTC'))) / 3600.0)::float8 AS "hours"
        FROM form_requests fr
        JOIN forms f ON f.id = fr.form_id
        JOIN clients c ON c.id = fr.client_id
        WHERE fr.workspace_id = ${workspaceId}
          AND fr.status = 'reviewed'
          AND fr.action_taken_at IS NOT NULL
          AND fr.submitted_at IS NOT NULL
          AND ${localDay} >= ${range.from}::date
          AND ${localDay} <= ${range.to}::date
          AND COALESCE(NULLIF(fr.post_action, ''), f.post_action, 'nothing') <> 'nothing'
          ${demandFilterSql(filters)}
    `;
    return rows.map((row) => ({ userId: row.userId, date: row.day, hours: Number(row.hours) }));
}

interface OpenSql { open: number; overdue: number; longest: number }

// Plans waiting right now, and how many have already waited longer than the goal.
async function loadOpenWait(workspaceId: string, targetDays: number, filters: DemandFilters): Promise<OpenWait> {
    const [row] = await prisma.$queryRaw<OpenSql[]>`
        SELECT COUNT(*)::int AS "open",
               COUNT(*) FILTER (WHERE fr.submitted_at < (NOW() AT TIME ZONE 'UTC') - make_interval(hours => ${targetDays * HOURS_PER_DAY}::int))::int AS "overdue",
               COALESCE(MAX(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - fr.submitted_at)) / 3600.0), 0)::float8 AS "longest"
        FROM form_requests fr
        JOIN forms f ON f.id = fr.form_id
        JOIN clients c ON c.id = fr.client_id
        WHERE fr.workspace_id = ${workspaceId}
          AND fr.status = 'submitted'
          AND fr.archived_at IS NULL
          AND fr.submitted_at IS NOT NULL
          AND COALESCE(NULLIF(fr.post_action, ''), f.post_action, 'nothing') <> 'nothing'
          ${demandFilterSql(filters)}
    `;
    return { open: row?.open ?? 0, overdue: row?.overdue ?? 0, longestHours: Number(row?.longest ?? 0) };
}

export async function getServiceTargetDays(workspaceId: string): Promise<number> {
    const workspace = await prisma.workspaces.findFirstOrThrow({ where: { id: workspaceId }, select: { service_target_days: true } });
    return workspace.service_target_days;
}

export async function setServiceTargetDays(workspaceId: string, days: number): Promise<void> {
    await prisma.workspaces.update({ where: { id: workspaceId }, data: { service_target_days: days } });
}

export async function loadServiceLevel(workspaceId: string, range: TrendRange, timeZone: string, filters: DemandFilters = {}) {
    const days = daysBetween(range.from, range.to) + 1;
    const dates = Array.from({ length: days }, (_, i) => addDays(range.from, i));
    const targetDays = await getServiceTargetDays(workspaceId);

    const [rows, open] = await Promise.all([
        loadTurnaroundRows(workspaceId, range, timeZone, filters),
        loadOpenWait(workspaceId, targetDays, filters),
    ]);
    const { people } = await resolvePeopleForWork(workspaceId, timeZone, rows.map((r) => r.userId));
    return { days, from: range.from, to: range.to, timeZone, ...buildServiceLevel({ rows, people, dates, targetDays, open }) };
}
