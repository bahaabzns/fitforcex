import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { DemandFilters, demandFilterSql } from './operations.service';
import { CAPACITY_ROLES } from './operations.constants';
import { weekdayOf } from './operations.schedule';

export const TREND_DAYS_OPTIONS = [1, 7, 30, 90] as const;
export const DEFAULT_TREND_DAYS = 30;
// Longest custom range accepted, so one request can't aggregate years of rows into a chart.
export const MAX_TREND_RANGE_DAYS = 366;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// True only for real calendar dates ('2026-02-30' matches the pattern but is not one).
export function isIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export interface TrendRange { from: string; to: string }

// A custom from/to range, or null when it is absent or unusable (the caller then falls back to a preset).
// `to` is clamped to today: future days can have no submissions.
export function parseCustomRange(rawFrom: unknown, rawTo: unknown, today: string): TrendRange | null {
    if (!isIsoDate(rawFrom) || !isIsoDate(rawTo)) return null;
    const to = rawTo > today ? today : rawTo;
    if (rawFrom > to) return null;
    if (daysBetween(rawFrom, to) + 1 > MAX_TREND_RANGE_DAYS) return null;
    return { from: rawFrom, to };
}

export interface DailyDemandPoint { date: string; count: number }  // date: YYYY-MM-DD in the viewer's zone

// Falls back to UTC for anything Intl doesn't recognise, so a bad client value
// can never reach the SQL as an unknown zone name.
export function resolveTimeZone(raw: unknown): string {
    if (typeof raw !== 'string' || !raw) return 'UTC';
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: raw });
        return raw;
    } catch {
        return 'UTC';
    }
}

// "Today" as YYYY-MM-DD in the given zone (en-CA formats as ISO year-month-day).
export function todayIn(timeZone: string, now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Pure calendar arithmetic on YYYY-MM-DD strings (UTC midnight), so it is independent of the server zone.
export function addDays(isoDate: string, delta: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
}

// One point per day for the `days` days ending on `lastDay`, with zero-demand days included
// so the chart's x-axis is continuous.
export function buildDailySeries(rows: DailyDemandPoint[], lastDay: string, days: number): DailyDemandPoint[] {
    const countByDate = new Map(rows.map((row) => [row.date, row.count]));
    return Array.from({ length: days }, (_, i) => {
        const date = addDays(lastDay, i - (days - 1));
        return { date, count: countByDate.get(date) ?? 0 };
    });
}

// ── Team capacity per day, replayed from capacity_history ───────────────

export interface CapacityPerson {
    userId: string;
    joinedDate: string | null;          // local YYYY-MM-DD; null = always present (the owner)
    currentCapacity: number | null;
    currentDaysOff: number[];
}
export interface CapacityChangeEntry {
    userId: string;
    localDate: string;                  // the day the change was made, in the viewer's zone
    previous: number | null;
    next: number | null;
    previousDaysOff: number[];
    nextDaysOff: number[];
}

// Capacity a person had on `date`: the schedule set by the latest change on or before that day.
// Before their first recorded change it is that change's "previous" schedule; with no history at
// all it is their current one. Zero before they joined the team, and zero on any weekday that
// is one of their days off at that time.
function capacityOn(date: string, person: CapacityPerson, changes: CapacityChangeEntry[]): number {
    if (person.joinedDate && date < person.joinedDate) return 0;

    let capacity = person.currentCapacity;
    let daysOff = person.currentDaysOff;
    if (changes.length > 0) {
        capacity = changes[0].previous;
        daysOff = changes[0].previousDaysOff;
        for (const change of changes) {
            if (change.localDate > date) break;
            capacity = change.next;
            daysOff = change.nextDaysOff;
        }
    }
    return daysOff.includes(weekdayOf(date)) ? 0 : (capacity ?? 0);
}

// Pure: each person's capacity on every date. `changes` must be oldest first.
export function buildCapacityByPerson(
    dates: string[], people: CapacityPerson[], changes: CapacityChangeEntry[],
): Map<string, number[]> {
    const changesByUser = new Map<string, CapacityChangeEntry[]>();
    for (const change of changes) {
        const list = changesByUser.get(change.userId) ?? [];
        list.push(change);
        changesByUser.set(change.userId, list);
    }
    return new Map(people.map((person) => [
        person.userId,
        dates.map((date) => capacityOn(date, person, changesByUser.get(person.userId) ?? [])),
    ]));
}

// Pure: one total per date, summing every counted person.
export function buildDailyCapacity(dates: string[], people: CapacityPerson[], changes: CapacityChangeEntry[]): number[] {
    const byPerson = buildCapacityByPerson(dates, people, changes);
    return dates.map((_, i) => people.reduce((sum, person) => sum + (byPerson.get(person.userId)?.[i] ?? 0), 0));
}

export interface TeamPerson extends CapacityPerson {
    name: string;
    role: string;
    isOwner: boolean;
}

const displayName = (u: { fname: string; lname: string; email: string }) => `${u.fname} ${u.lname}`.trim() || u.email;

// Eligibility (role, active flag) is today's: past role changes and deactivations are not recorded,
// and people who have since left are not counted (their role at the time is unknown).
export async function loadTeamPeople(workspaceId: string, timeZone: string): Promise<TeamPerson[]> {
    const [members, workspace] = await Promise.all([
        prisma.workspace_members.findMany({
            where: { workspace_id: workspaceId, is_active: true, role: { in: [...CAPACITY_ROLES] } },
            select: {
                user_id: true, role: true, daily_plan_capacity: true, days_off: true, joined_at: true,
                users: { select: { fname: true, lname: true, email: true } },
            },
        }),
        prisma.workspaces.findFirstOrThrow({
            where: { id: workspaceId },
            select: {
                owner_id: true, owner_daily_plan_capacity: true, owner_days_off: true,
                users_workspaces_owner_idTousers: { select: { fname: true, lname: true, email: true } },
            },
        }),
    ]);
    return [
        {
            userId: workspace.owner_id, name: displayName(workspace.users_workspaces_owner_idTousers), role: 'owner', isOwner: true,
            joinedDate: null, currentCapacity: workspace.owner_daily_plan_capacity, currentDaysOff: workspace.owner_days_off,
        },
        ...members.map((m) => ({
            userId: m.user_id, name: displayName(m.users), role: m.role, isOwner: false,
            joinedDate: todayIn(timeZone, m.joined_at), currentCapacity: m.daily_plan_capacity, currentDaysOff: m.days_off,
        })),
    ];
}

export async function loadCapacityByPerson(
    workspaceId: string, dates: string[], timeZone: string, people?: TeamPerson[],
): Promise<Map<string, number[]>> {
    const team = people ?? await loadTeamPeople(workspaceId, timeZone);
    const history = await prisma.capacity_history.findMany({
        where: { workspace_id: workspaceId, user_id: { in: team.map((p) => p.userId) } },
        orderBy: { changed_at: 'asc' },
        select: { user_id: true, previous_capacity: true, new_capacity: true, previous_days_off: true, new_days_off: true, changed_at: true },
    });
    const changes: CapacityChangeEntry[] = history.map((row) => ({
        userId: row.user_id, localDate: todayIn(timeZone, row.changed_at),
        previous: row.previous_capacity, next: row.new_capacity,
        previousDaysOff: row.previous_days_off, nextDaysOff: row.new_days_off,
    }));
    return buildCapacityByPerson(dates, team, changes);
}

export async function loadDailyCapacity(workspaceId: string, dates: string[], timeZone: string): Promise<number[]> {
    const byPerson = await loadCapacityByPerson(workspaceId, dates, timeZone);
    return dates.map((_, i) => [...byPerson.values()].reduce((sum, series) => sum + series[i], 0));
}

interface DailyRow { day: string; count: number }

// Demand arriving per day: plan-producing requests by the day the client submitted them.
// Counts every request that was ever submitted (reviewed and archived ones included), since
// they were demand on the day they arrived. form_requests.submitted_at is timestamp WITHOUT
// time zone holding UTC, so it is tagged UTC first and then shifted into the viewer's zone.
export async function loadDailyDemand(
    workspaceId: string, range: TrendRange, timeZone: string, filters: DemandFilters = {},
): Promise<DailyDemandPoint[]> {
    const localDay = Prisma.sql`((fr.submitted_at AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date`;

    const rows = await prisma.$queryRaw<DailyRow[]>`
        SELECT to_char(${localDay}, 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "count"
        FROM form_requests fr
        JOIN forms f ON f.id = fr.form_id
        JOIN clients c ON c.id = fr.client_id
        WHERE fr.workspace_id = ${workspaceId}
          AND fr.submitted_at IS NOT NULL
          AND ${localDay} >= ${range.from}::date
          AND ${localDay} <= ${range.to}::date
          AND COALESCE(NULLIF(fr.post_action, ''), f.post_action, 'nothing') <> 'nothing'
          ${demandFilterSql(filters)}
        GROUP BY 1
    `;
    return buildDailySeries(rows.map((row) => ({ date: row.day, count: row.count })), range.to, daysBetween(range.from, range.to) + 1);
}
