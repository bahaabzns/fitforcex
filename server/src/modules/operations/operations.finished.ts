import { prisma } from '../../lib/prisma';
import { DemandFilters, demandFilterSql } from './operations.service';
import { TeamPerson, TrendRange, daysBetween, addDays, loadTeamPeople, loadCapacityByPerson } from './operations.trend';
import { Prisma } from '@prisma/client';

// One row per (person, local day) from the SQL aggregate. userId is null when nobody can be credited.
export interface FinishedRow { userId: string | null; date: string; count: number }

export interface DayPoint { date: string; count: number; capacity: number }

export interface PersonFinished {
    userId: string;
    name: string;
    role: string;
    isOwner: boolean;
    total: number;
    averagePerDay: number;
    today: number;
    points: DayPoint[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

// Pure. `dates` is the continuous list of days to report; `capacityByUser` holds each person's capacity
// on those days (empty for someone with none). Finished work credited to someone who is not in `people`
// (a removed member, or no one at all) is kept in `unattributed` so the team total still adds up.
export function buildFinishedSeries(args: {
    rows: FinishedRow[]; people: Array<Pick<TeamPerson, 'userId' | 'name' | 'role' | 'isOwner'>>;
    dates: string[]; capacityByUser: Map<string, number[]>; today: string;
}) {
    const { rows, people, dates, capacityByUser, today } = args;
    const indexOfDate = new Map(dates.map((date, i) => [date, i]));
    const countsByUser = new Map<string, number[]>();
    const unattributedByDay = dates.map(() => 0);

    for (const row of rows) {
        const dayIndex = indexOfDate.get(row.date);
        if (dayIndex === undefined) continue;
        if (!row.userId || !people.some((p) => p.userId === row.userId)) {
            unattributedByDay[dayIndex] += row.count;
            continue;
        }
        const series = countsByUser.get(row.userId) ?? dates.map(() => 0);
        series[dayIndex] += row.count;
        countsByUser.set(row.userId, series);
    }

    const todayIndex = indexOfDate.get(today);
    const personRows: PersonFinished[] = people.map((person) => {
        const counts = countsByUser.get(person.userId) ?? dates.map(() => 0);
        const capacities = capacityByUser.get(person.userId) ?? dates.map(() => 0);
        const total = counts.reduce((sum, n) => sum + n, 0);
        return {
            ...person,
            total,
            averagePerDay: round1(total / dates.length),
            today: todayIndex === undefined ? 0 : counts[todayIndex],
            points: dates.map((date, i) => ({ date, count: counts[i], capacity: capacities[i] })),
        };
    });

    const teamPoints: DayPoint[] = dates.map((date, i) => ({
        date,
        count: personRows.reduce((sum, p) => sum + p.points[i].count, 0) + unattributedByDay[i],
        capacity: personRows.reduce((sum, p) => sum + p.points[i].capacity, 0),
    }));
    const teamTotal = teamPoints.reduce((sum, p) => sum + p.count, 0);

    return {
        team: { total: teamTotal, averagePerDay: round1(teamTotal / dates.length), points: teamPoints },
        // Busiest finishers first; people with nothing finished stay listed so a quiet week is visible.
        people: personRows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
        unattributed: { total: unattributedByDay.reduce((sum, n) => sum + n, 0) },
    };
}

interface FinishedSqlRow { userId: string | null; day: string; count: number }

// Plan-producing requests that were finished (status 'reviewed') on each local day, credited to whoever
// finished them (action_taken_by) or, for older rows that predate that column, to the assignee.
export async function loadFinishedRows(
    workspaceId: string, range: TrendRange, timeZone: string, filters: DemandFilters = {},
): Promise<FinishedRow[]> {
    const localDay = Prisma.sql`(fr.action_taken_at AT TIME ZONE ${timeZone})::date`;
    const rows = await prisma.$queryRaw<FinishedSqlRow[]>`
        SELECT COALESCE(fr.action_taken_by, fr.assigned_to) AS "userId",
               to_char(${localDay}, 'YYYY-MM-DD') AS "day",
               COUNT(*)::int AS "count"
        FROM form_requests fr
        JOIN forms f ON f.id = fr.form_id
        JOIN clients c ON c.id = fr.client_id
        WHERE fr.workspace_id = ${workspaceId}
          AND fr.status = 'reviewed'
          AND fr.action_taken_at IS NOT NULL
          AND ${localDay} >= ${range.from}::date
          AND ${localDay} <= ${range.to}::date
          AND COALESCE(NULLIF(fr.post_action, ''), f.post_action, 'nothing') <> 'nothing'
          ${demandFilterSql(filters)}
        GROUP BY 1, 2
    `;
    return rows.map((row) => ({ userId: row.userId, date: row.day, count: row.count }));
}

// The counted team, plus a row for anyone credited with work who is no longer a counted member
// (deactivated, role changed, removed), so their work is not silently folded into "unattributed".
export async function resolvePeopleForWork(workspaceId: string, timeZone: string, creditedUserIds: Array<string | null>) {
    const team = await loadTeamPeople(workspaceId, timeZone);
    const knownIds = new Set(team.map((p) => p.userId));
    const strayIds = [...new Set(creditedUserIds.filter((id): id is string => !!id && !knownIds.has(id)))];
    const strays = strayIds.length
        ? await prisma.users.findMany({ where: { id: { in: strayIds } }, select: { id: true, fname: true, lname: true, email: true } })
        : [];
    const people = [
        ...team,
        ...strays.map((u) => ({ userId: u.id, name: `${u.fname} ${u.lname}`.trim() || u.email, role: 'former', isOwner: false })),
    ];
    return { team, people };
}

// Everything the "plans finished" view needs for a date range.
export async function loadFinishedSeries(
    workspaceId: string, range: TrendRange, timeZone: string, today: string, filters: DemandFilters = {},
) {
    const days = daysBetween(range.from, range.to) + 1;
    const dates = Array.from({ length: days }, (_, i) => addDays(range.from, i));

    const rows = await loadFinishedRows(workspaceId, range, timeZone, filters);
    const { team, people } = await resolvePeopleForWork(workspaceId, timeZone, rows.map((r) => r.userId));

    const capacityByUser = await loadCapacityByPerson(workspaceId, dates, timeZone, team);
    return { days, from: range.from, to: range.to, timeZone, ...buildFinishedSeries({ rows, people, dates, capacityByUser, today }) };
}
