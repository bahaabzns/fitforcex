import { prisma } from '../../lib/prisma';
import { DemandFilters, demandFilterSql } from './operations.service';
import { addDays, loadDailyCapacity } from './operations.trend';
import { loadFinishedRows } from './operations.finished';

// The cards show the last two weeks: one week for the little chart's shape, and the week before it
// so "vs last week" has something to compare against.
export const KPI_TREND_DAYS = 14;
const TRAILING_DAYS = 7;

export interface KpiPoint {
    date: string;
    waiting: number;          // plans waiting for action at the end of that day
    capacity: number;         // what the team could finish that day (days off taken out)
    fullPct: number | null;   // waiting / average daily capacity over the 7 days to that day
    finished: number;         // plans the team finished that day
}

const round1 = (value: number) => Math.round(value * 10) / 10;

// Pure. `waiting` and `capacity` are aligned with `dates`.
export function buildKpiSeries(dates: string[], waiting: number[], capacity: number[], finished: number[]): KpiPoint[] {
    return dates.map((date, i) => {
        // A weekday-by-weekday number would swing wildly around weekends, so "how full" compares the
        // backlog with the team's average daily capacity over the 7 days ending that day.
        const window = capacity.slice(Math.max(0, i - TRAILING_DAYS + 1), i + 1);
        const averageCapacity = window.reduce((sum, value) => sum + value, 0) / window.length;
        return {
            date,
            waiting: waiting[i],
            capacity: capacity[i],
            fullPct: averageCapacity > 0 ? round1((waiting[i] / averageCapacity) * 100) : null,
            finished: finished[i],
        };
    });
}

interface BacklogRow { day: string; count: number }

// Plans waiting at the end of each local day, estimated from when each request was submitted and when it
// left the queue (finished or archived). A request counts on every day from submission until the day it
// was finished or archived. (Reviews that were later undone lose their finish date, so a few past days
// can read slightly high.)
export async function loadBacklogByDay(
    workspaceId: string, dates: string[], timeZone: string, filters: DemandFilters = {},
): Promise<number[]> {
    const from = dates[0];
    const to = dates[dates.length - 1];
    const rows = await prisma.$queryRaw<BacklogRow[]>`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS "day", COUNT(open.id)::int AS "count"
        FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS d(day)
        LEFT JOIN (
            SELECT fr.id,
                   ((fr.submitted_at AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date AS submitted_day,
                   (fr.action_taken_at AT TIME ZONE ${timeZone})::date AS finished_day,
                   (fr.archived_at AT TIME ZONE ${timeZone})::date AS archived_day
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            JOIN clients c ON c.id = fr.client_id
            WHERE fr.workspace_id = ${workspaceId}
              AND fr.submitted_at IS NOT NULL
              AND COALESCE(NULLIF(fr.post_action, ''), f.post_action, 'nothing') <> 'nothing'
              ${demandFilterSql(filters)}
        ) open
          ON open.submitted_day <= d.day
         AND (open.finished_day IS NULL OR open.finished_day > d.day)
         AND (open.archived_day IS NULL OR open.archived_day > d.day)
        GROUP BY d.day
        ORDER BY d.day
    `;
    const byDay = new Map(rows.map((row) => [row.day, row.count]));
    return dates.map((date) => byDay.get(date) ?? 0);
}

export async function loadKpiSeries(workspaceId: string, today: string, timeZone: string, filters: DemandFilters = {}) {
    const dates = Array.from({ length: KPI_TREND_DAYS }, (_, i) => addDays(today, i - (KPI_TREND_DAYS - 1)));
    const range = { from: dates[0], to: dates[dates.length - 1] };
    const [waiting, capacity, finishedRows] = await Promise.all([
        loadBacklogByDay(workspaceId, dates, timeZone, filters),
        loadDailyCapacity(workspaceId, dates, timeZone),
        loadFinishedRows(workspaceId, range, timeZone, filters),
    ]);
    // Team total per day, whoever finished the plan.
    const finishedByDay = new Map<string, number>();
    for (const row of finishedRows) finishedByDay.set(row.date, (finishedByDay.get(row.date) ?? 0) + row.count);
    const finished = dates.map((date) => finishedByDay.get(date) ?? 0);
    return { ...range, timeZone, points: buildKpiSeries(dates, waiting, capacity, finished) };
}
