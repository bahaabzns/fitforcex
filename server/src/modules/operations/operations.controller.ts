import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import {
    HORIZON_DAYS_OPTIONS, DEFAULT_HORIZON_DAYS, MAX_DAILY_PLAN_CAPACITY, CAPACITY_ROLES,
    TIGHT_FROM_PCT, OVERLOADED_ABOVE_PCT,
} from './operations.constants';
import { buildSummary, buildTrainerRow, OperationsSummary } from './operations.aggregate';
import { loadDemandGroups, loadCapacityInputs, loadPackageOptions, DemandFilters } from './operations.service';
import {
    TREND_DAYS_OPTIONS, DEFAULT_TREND_DAYS, MAX_TREND_RANGE_DAYS, resolveTimeZone, todayIn, addDays, daysBetween,
    parseCustomRange, loadDailyDemand, loadDailyCapacity,
} from './operations.trend';
import { assignUnassignedPlans, MAX_ASSIGN_LIMIT } from './operations.assign';
import { parseDaysOff } from './operations.schedule';
import { loadFinishedSeries } from './operations.finished';
import { loadKpiSeries } from './operations.kpi';
import { loadServiceLevel, getServiceTargetDays, setServiceTargetDays, MIN_TARGET_DAYS, MAX_TARGET_DAYS } from './operations.serviceLevel';
import { setCapacityForUnset, setMemberCapacity, setOwnerCapacity, loadCapacityHistory, isWorkspacePerson } from './operations.capacity';

const ACTION_QUERY_TO_POST_ACTION: Record<string, string> = {
    nutrition: 'nutrition-plan',
    workout:   'workout-plan',
};
const FORM_TYPES = ['assessment', 'check-in'];

function isManagerOrOwner(req: Request): boolean {
    return !!req.user && (req.user.isOwner || req.user.role === 'manager');
}

function parseHorizonDays(raw: unknown): number {
    const days = Number(raw);
    return (HORIZON_DAYS_OPTIONS as readonly number[]).includes(days) ? days : DEFAULT_HORIZON_DAYS;
}

// More than any workspace has packages; stops a crafted query from building a huge IN list.
const MAX_PACKAGE_FILTERS = 50;

function parseFilters(query: Request['query']): DemandFilters {
    const filters: DemandFilters = {};
    // `package` may repeat (several packages at once); a single value arrives as a string.
    const rawPackages = Array.isArray(query.package) ? query.package : [query.package];
    const packageNames = rawPackages.filter((name): name is string => typeof name === 'string' && name.length > 0).slice(0, MAX_PACKAGE_FILTERS);
    if (packageNames.length > 0) filters.packageNames = packageNames;
    if (typeof query.action === 'string' && ACTION_QUERY_TO_POST_ACTION[query.action]) {
        filters.postAction = ACTION_QUERY_TO_POST_ACTION[query.action];
    }
    if (typeof query.type === 'string' && FORM_TYPES.includes(query.type)) filters.formType = query.type;
    return filters;
}

// Trainers see only their own row: no colleagues' loads, no team totals.
function projectToSelf(summary: OperationsSummary, userId: string, horizonDays: number, startDate: string) {
    const counted = summary.trainers.find((t) => t.userId === userId);
    const unconfigured = summary.notConfigured.find((m) => m.userId === userId);
    const me = counted
        ?? (unconfigured
            ? buildTrainerRow({ userId, memberId: unconfigured.memberId, name: unconfigured.name, role: unconfigured.role, isOwner: false },
                null, unconfigured.load, horizonDays, { daysOff: unconfigured.daysOff, startDate }, summary.utilization.targetDays)
            : null);
    return { scope: 'self' as const, horizonDays, thresholds: { tightFromPct: TIGHT_FROM_PCT, overloadedAbovePct: OVERLOADED_ABOVE_PCT }, me };
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
    const workspaceId = req.user!.workspaceId;
    const horizonDays = parseHorizonDays(req.query.horizonDays);
    const fullView = isManagerOrOwner(req);
    // The window starts on the viewer's "today", and a person's days off are weekdays on the calendar.
    const startDate = todayIn(resolveTimeZone(req.query.timeZone));

    // forms.read alone is not enough for the team view: the role must be an
    // owner/manager, or one of the roles that produces plans (own row only).
    if (!fullView && !(CAPACITY_ROLES as readonly string[]).includes(req.user!.role)) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const [groups, { members, owner }] = await Promise.all([
            // A trainer's own row is never narrowed by the manager-facing filters.
            loadDemandGroups(workspaceId, fullView ? parseFilters(req.query) : {}),
            loadCapacityInputs(workspaceId),
        ]);
        const targetDays = await getServiceTargetDays(req.user!.workspaceId);
        const summary = buildSummary({ groups, members, owner, horizonDays, startDate, targetDays });

        if (!fullView) return res.json(projectToSelf(summary, req.user!.userId, horizonDays, startDate));
        res.json({
            scope: 'team' as const,
            thresholds: { tightFromPct: TIGHT_FROM_PCT, overloadedAbovePct: OVERLOADED_ABOVE_PCT },
            ...summary,
        });
    } catch (err) {
        next(err);
    }
}

// Daily demand for the area chart. Team-wide numbers, so owner/manager only
// (trainers' own view has no trend).
// The date range both trend endpoints share: a valid custom from/to wins; otherwise the last
// `days` days (a preset) ending today in the viewer's zone.
function parseTrendRange(query: Request['query']):
    | { ok: true; timeZone: string; today: string; range: { from: string; to: string }; days: number }
    | { ok: false; error: string } {
    const timeZone = resolveTimeZone(query.timeZone);
    const today = todayIn(timeZone);
    const custom = parseCustomRange(query.from, query.to, today);
    if ((query.from || query.to) && !custom) {
        return { ok: false, error: `from and to must be valid YYYY-MM-DD dates, from <= to, spanning at most ${MAX_TREND_RANGE_DAYS} days` };
    }
    const requestedDays = Number(query.days);
    const presetDays = (TREND_DAYS_OPTIONS as readonly number[]).includes(requestedDays) ? requestedDays : DEFAULT_TREND_DAYS;
    const range = custom ?? { from: addDays(today, -(presetDays - 1)), to: today };
    return { ok: true, timeZone, today, range, days: daysBetween(range.from, range.to) + 1 };
}

export async function getDemandTrend(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can view demand trends' });

    const parsedRange = parseTrendRange(req.query);
    if (!parsedRange.ok) return res.status(400).json({ error: parsedRange.error });
    const { timeZone, range, days } = parsedRange;

    try {
        const points = await loadDailyDemand(req.user!.workspaceId, range, timeZone, parseFilters(req.query));
        const total = points.reduce((sum, p) => sum + p.count, 0);
        const capacityByDay = await loadDailyCapacity(req.user!.workspaceId, points.map((p) => p.date), timeZone);
        const capacity = await loadCapacityInputs(req.user!.workspaceId);
        const dailyCapacity = capacity.members
            .filter((m) => m.isActive && (CAPACITY_ROLES as readonly string[]).includes(m.role))
            .reduce((sum, m) => sum + (m.dailyCapacity ?? 0), 0) + (capacity.owner.dailyCapacity ?? 0);
        res.json({
            days, from: range.from, to: range.to, timeZone,
            points: points.map((point, i) => ({ ...point, capacity: capacityByDay[i] })),
            total,
            averagePerDay: Math.round((total / days) * 10) / 10,
            // Today's capacity, for reference only: history is not replayed per past day.
            currentDailyCapacity: dailyCapacity,
            // What the chart's package filter can offer.
            filterOptions: await loadPackageOptions(req.user!.workspaceId),
        });
    } catch (err) {
        next(err);
    }
}

// The last two weeks of the headline numbers, for the cards' mini charts and their "vs last week"
// change. Team-wide, so owner/manager only.
export async function getKpiTrend(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can view this' });

    const timeZone = resolveTimeZone(req.query.timeZone);
    try {
        res.json(await loadKpiSeries(req.user!.workspaceId, todayIn(timeZone), timeZone, parseFilters(req.query)));
    } catch (err) {
        next(err);
    }
}

// Plans each team member finished per day. Owner/manager see everyone and the team total; a
// trainer or nutritionist sees only their own row (no colleagues, no team totals), as elsewhere.
export async function getFinishedTrend(req: Request, res: Response, next: NextFunction) {
    const fullView = isManagerOrOwner(req);
    if (!fullView && !(CAPACITY_ROLES as readonly string[]).includes(req.user!.role)) {
        return res.status(403).json({ error: 'Permission denied' });
    }
    const parsedRange = parseTrendRange(req.query);
    if (!parsedRange.ok) return res.status(400).json({ error: parsedRange.error });
    const { timeZone, today, range } = parsedRange;

    try {
        const series = await loadFinishedSeries(req.user!.workspaceId, range, timeZone, today, fullView ? parseFilters(req.query) : {});
        if (fullView) return res.json({ scope: 'team', ...series });
        const me = series.people.find((person) => person.userId === req.user!.userId) ?? null;
        res.json({ scope: 'self', days: series.days, from: series.from, to: series.to, timeZone, me });
    } catch (err) {
        next(err);
    }
}

// Service level: how quickly clients get their plans, against the workspace goal. Team-wide, so
// owner/manager only.
export async function getServiceLevel(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can view the service level' });

    const parsedRange = parseTrendRange(req.query);
    if (!parsedRange.ok) return res.status(400).json({ error: parsedRange.error });
    try {
        res.json(await loadServiceLevel(req.user!.workspaceId, parsedRange.range, parsedRange.timeZone, parseFilters(req.query)));
    } catch (err) {
        next(err);
    }
}

export async function updateServiceTarget(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can change the service goal' });

    const days = (req.body as Record<string, unknown>)?.targetDays;
    if (typeof days !== 'number' || !Number.isInteger(days) || days < MIN_TARGET_DAYS || days > MAX_TARGET_DAYS) {
        return res.status(400).json({ error: `targetDays must be a whole number from ${MIN_TARGET_DAYS} to ${MAX_TARGET_DAYS}` });
    }
    try {
        await setServiceTargetDays(req.user!.workspaceId, days);
        res.json({ targetDays: days });
    } catch (err) {
        next(err);
    }
}

// Owner-level capacity setting, edited from Settings → Team.
export async function getCapacitySettings(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can view capacity settings' });
    try {
        const workspace = await prisma.workspaces.findFirst({
            where:  { id: req.user!.workspaceId },
            select: { owner_daily_plan_capacity: true, owner_days_off: true },
        });
        res.json({ ownerDailyCapacity: workspace?.owner_daily_plan_capacity ?? null, ownerDaysOff: workspace?.owner_days_off ?? [] });
    } catch (err) {
        next(err);
    }
}

// null clears the setting; otherwise a whole number within [0, MAX].
function parseCapacity(raw: unknown): { ok: true; value: number | null } | { ok: false } {
    if (raw === null) return { ok: true, value: null };
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= MAX_DAILY_PLAN_CAPACITY) {
        return { ok: true, value: raw };
    }
    return { ok: false };
}

// daysOff is optional on every edit: absent leaves it unchanged, present must be a valid weekday list.
function parseOptionalDaysOff(body: unknown): { ok: true; value: number[] | undefined } | { ok: false } {
    const raw = (body as Record<string, unknown> | undefined)?.daysOff;
    if (raw === undefined) return { ok: true, value: undefined };
    const parsed = parseDaysOff(raw);
    return parsed ? { ok: true, value: parsed } : { ok: false };
}

const DAYS_OFF_ERROR = 'daysOff must be a list of weekday numbers from 0 (Sunday) to 6 (Saturday), with at least one working day left';

export async function updateMemberCapacity(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can edit capacity' });

    const parsed = parseCapacity((req.body as Record<string, unknown>)?.dailyCapacity);
    if (!parsed.ok) return res.status(400).json({ error: `dailyCapacity must be null or a whole number from 0 to ${MAX_DAILY_PLAN_CAPACITY}` });
    const daysOff = parseOptionalDaysOff(req.body);
    if (!daysOff.ok) return res.status(400).json({ error: DAYS_OFF_ERROR });

    try {
        const result = await setMemberCapacity(req.params.memberId as string, {
            workspaceId: req.user!.workspaceId, newCapacity: parsed.value, newDaysOff: daysOff.value, changedBy: req.user!.userId,
        });
        if (!result) return res.status(404).json({ error: 'Member not found' });
        res.json({ memberId: req.params.memberId, dailyCapacity: parsed.value, daysOff: daysOff.value });
    } catch (err) {
        next(err);
    }
}

export async function updateOwnerCapacity(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can edit capacity' });

    const parsed = parseCapacity((req.body as Record<string, unknown>)?.dailyCapacity);
    if (!parsed.ok) return res.status(400).json({ error: `dailyCapacity must be null or a whole number from 0 to ${MAX_DAILY_PLAN_CAPACITY}` });
    const daysOff = parseOptionalDaysOff(req.body);
    if (!daysOff.ok) return res.status(400).json({ error: DAYS_OFF_ERROR });

    try {
        await setOwnerCapacity({ workspaceId: req.user!.workspaceId, newCapacity: parsed.value, newDaysOff: daysOff.value, changedBy: req.user!.userId });
        res.json({ ownerDailyCapacity: parsed.value, ownerDaysOff: daysOff.value });
    } catch (err) {
        next(err);
    }
}

// "Set one number for everyone who has none": the coach's first-run shortcut. Never overwrites a value.
export async function setCapacityForEveryoneUnset(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can edit capacity' });

    const value = (req.body as Record<string, unknown>)?.dailyCapacity;
    const parsed = parseCapacity(value);
    if (!parsed.ok || parsed.value === null || parsed.value < 1) {
        return res.status(400).json({ error: `dailyCapacity must be a whole number from 1 to ${MAX_DAILY_PLAN_CAPACITY}` });
    }
    const daysOff = parseOptionalDaysOff(req.body);
    if (!daysOff.ok) return res.status(400).json({ error: DAYS_OFF_ERROR });
    try {
        const updated = await setCapacityForUnset(req.user!.workspaceId, parsed.value, req.user!.userId, daysOff.value);
        res.json({ updated, dailyCapacity: parsed.value });
    } catch (err) {
        next(err);
    }
}

// "Hand N of the waiting, unassigned plans to this person" (the dashboard's rebalance suggestion).
export async function assignWaitingPlans(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can assign plans' });

    const { assigneeUserId, limit } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof assigneeUserId !== 'string' || !assigneeUserId) return res.status(400).json({ error: 'assigneeUserId is required' });
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_ASSIGN_LIMIT) {
        return res.status(400).json({ error: `limit must be a whole number from 1 to ${MAX_ASSIGN_LIMIT}` });
    }
    try {
        const result = await assignUnassignedPlans(req.user!.workspaceId, assigneeUserId, limit, req.user!.userId);
        if (!result) return res.status(400).json({ error: 'That person cannot receive plans' });
        res.json(result);
    } catch (err) {
        next(err);
    }
}

// One person's capacity changes, newest first. userId is the person's user id
// (the owner's included), as carried on each dashboard trainer row.
export async function getCapacityHistory(req: Request, res: Response, next: NextFunction) {
    if (!isManagerOrOwner(req)) return res.status(403).json({ error: 'Only the workspace owner or a manager can view capacity history' });

    const userId = req.params.userId as string;
    try {
        if (!(await isWorkspacePerson(req.user!.workspaceId, userId))) return res.status(404).json({ error: 'Person not found' });
        res.json(await loadCapacityHistory(req.user!.workspaceId, userId));
    } catch (err) {
        next(err);
    }
}
