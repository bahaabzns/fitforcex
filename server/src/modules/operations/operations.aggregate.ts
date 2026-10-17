import {
    TIGHT_FROM_PCT, OVERLOADED_ABOVE_PCT, CAPACITY_ROLES, LoadStatus, PlanAction,
} from './operations.constants';
import { averageDailyCapacity, daysToClear, teamCapacityOn, workingDaysInWindow } from './operations.schedule';

// One row per (assignee, package, action, type, bucket) from the SQL aggregate.
export interface DemandGroup {
    assignedTo:  string | null;
    packageName: string | null;
    postAction:  string;                 // 'nutrition-plan' | 'workout-plan' | 'nothing'
    formType:    string;                 // 'assessment' | 'check-in'
    bucket:      'need' | 'incoming';
    count:       number;
    oldestSubmittedAt: Date | null;
    over1d: number;
    over3d: number;
    over7d: number;
}

export interface MemberInput {
    memberId: string;   // workspace_members.id, the key capacity edits use
    userId: string;
    name:   string;
    role:   string;
    isActive: boolean;
    dailyCapacity: number | null;
    daysOff: number[];   // weekdays (0 = Sunday ... 6 = Saturday) this person does not work
}

export interface OwnerInput {
    userId: string;
    name:   string;
    dailyCapacity: number | null;
    daysOff: number[];
}

export interface Load { total: number; nutrition: number; workout: number }

const emptyLoad = (): Load => ({ total: 0, nutrition: 0, workout: 0 });

// The team (or a person) is judged against the SERVICE GOAL, not against one day of capacity: how many
// days would it take to clear everything waiting, compared with the goal for finishing a plan. Beyond
// the goal is "overloaded"; from TIGHT_FROM_PCT of it is "tight". Null when it could never be cleared
// (no capacity), so the dashboard asks for limits instead of guessing.
export function statusByGoal(daysToClearAll: number | null, targetDays: number): LoadStatus | null {
    if (daysToClearAll === null) return null;
    return statusFor((daysToClearAll / targetDays) * 100);
}

export function statusFor(pct: number | null): LoadStatus | null {
    if (pct === null) return null;
    if (pct > OVERLOADED_ABOVE_PCT) return 'overloaded';
    if (pct >= TIGHT_FROM_PCT) return 'tight';
    return 'healthy';
}

// `capacityInWindow` is what the person (or team) can finish in the whole window, days off
// already taken out. Null when that is zero, rather than dividing by it.
function pctOf(load: number, capacityInWindow: number | null): number | null {
    if (!capacityInWindow) return null;
    return Math.round((load / capacityInWindow) * 1000) / 10;
}

// Capacity is an object (not a bare number) so per-action capacity can be added
// in phase 2 without changing the response shape: byAction stays null until then.
function capacityOf(total: number | null, inHorizon: number | null) {
    return { total, inHorizon, byAction: { nutrition: null as number | null, workout: null as number | null } };
}

export function buildTrainerRow(
    who: { userId: string; memberId: string | null; name: string; role: string; isOwner: boolean },
    capacity: number | null, load: Load, horizonDays: number,
    schedule: { daysOff: number[]; startDate: string },
    targetDays: number,
) {
    const workingDaysInHorizon = workingDaysInWindow(schedule.startDate, horizonDays, schedule.daysOff);
    const inHorizon = capacity === null ? null : capacity * workingDaysInHorizon;
    const utilizationPct = pctOf(load.total, inHorizon);
    // How long this person would take to clear their own assigned plans, day by day with their days off.
    const clearDays = capacity === null ? null
        : daysToClear(load.total, schedule.startDate, [{ dailyCapacity: capacity, daysOff: schedule.daysOff }]);
    return {
        ...who,
        capacity: capacityOf(capacity, inHorizon),
        daysOff: schedule.daysOff,
        workingDaysInHorizon,
        load,
        utilizationPct,
        clearDays,
        status: statusByGoal(clearDays, targetDays),
    };
}

export type TrainerRow = ReturnType<typeof buildTrainerRow>;

export const actionOf = (postAction: string): PlanAction | null =>
    postAction === 'nutrition-plan' ? 'nutrition' : postAction === 'workout-plan' ? 'workout' : null;

export interface BuildArgs {
    groups:      DemandGroup[];
    members:     MemberInput[];
    owner:       OwnerInput;
    horizonDays: number;
    startDate:   string;   // today (YYYY-MM-DD) in the viewer's zone: the first day of the window
    targetDays:  number;   // the workspace service goal: finish a plan within this many days
}

// Pure (no I/O) so the arithmetic is unit-testable without a database.
export function buildSummary({ groups, members, owner, horizonDays, startDate, targetDays }: BuildArgs) {
    const need = groups.filter((g) => g.bucket === 'need');

    // ── demand ────────────────────────────────────────────
    const demand = { total: 0, unassigned: 0, reviewOnly: 0 };
    const byAction = { nutrition: 0, workout: 0 };
    const byType = { assessment: 0, checkIn: 0 };
    const byPackageMap = new Map<string | null, number>();
    const aging = { oldestSubmittedAt: null as Date | null, over1d: 0, over3d: 0, over7d: 0 };
    const loadByUser = new Map<string, Load>();
    const unassignedLoad = emptyLoad();

    for (const g of need) {
        const action = actionOf(g.postAction);
        if (!action) { demand.reviewOnly += g.count; continue; }

        demand.total += g.count;
        byAction[action] += g.count;
        if (g.formType === 'assessment') byType.assessment += g.count; else byType.checkIn += g.count;
        byPackageMap.set(g.packageName, (byPackageMap.get(g.packageName) ?? 0) + g.count);
        aging.over1d += g.over1d; aging.over3d += g.over3d; aging.over7d += g.over7d;
        if (g.oldestSubmittedAt && (!aging.oldestSubmittedAt || g.oldestSubmittedAt < aging.oldestSubmittedAt)) {
            aging.oldestSubmittedAt = g.oldestSubmittedAt;
        }

        const target = g.assignedTo ? (loadByUser.get(g.assignedTo) ?? emptyLoad()) : unassignedLoad;
        target.total += g.count;
        target[action] += g.count;
        if (g.assignedTo) loadByUser.set(g.assignedTo, target); else demand.unassigned += g.count;
    }

    const incoming = groups
        .filter((g) => g.bucket === 'incoming' && actionOf(g.postAction))
        .reduce((sum, g) => sum + g.count, 0);

    // ── capacity ──────────────────────────────────────────
    const eligible = members.filter((m) => m.isActive && (CAPACITY_ROLES as readonly string[]).includes(m.role));
    const counted = eligible.filter((m) => m.dailyCapacity !== null);
    const notConfigured = eligible.filter((m) => m.dailyCapacity === null);

    const trainers: TrainerRow[] = counted.map((m) =>
        buildTrainerRow({ userId: m.userId, memberId: m.memberId, name: m.name, role: m.role, isOwner: false },
            m.dailyCapacity, loadByUser.get(m.userId) ?? emptyLoad(), horizonDays, { daysOff: m.daysOff, startDate }, targetDays));
    if (owner.dailyCapacity !== null) {
        trainers.unshift(buildTrainerRow({ userId: owner.userId, memberId: null, name: owner.name, role: 'owner', isOwner: true },
            owner.dailyCapacity, loadByUser.get(owner.userId) ?? emptyLoad(), horizonDays, { daysOff: owner.daysOff, startDate }, targetDays));
    }

    const capacityTotal = trainers.reduce((sum, t) => sum + (t.capacity.total ?? 0), 0);

    // Work assigned to someone who is neither a counted row nor "not configured"
    // (inactive, removed, wrong role, uncounted owner) is still demand: surfaced, not dropped.
    const accountedIds = new Set([...trainers.map((t) => t.userId), ...notConfigured.map((m) => m.userId)]);
    let otherAssigned = 0;
    for (const [userId, load] of loadByUser) if (!accountedIds.has(userId)) otherAssigned += load.total;

    // Team capacity honours each person's days off, both over the window and for "a normal day".
    const schedule = trainers.map((t) => ({ dailyCapacity: t.capacity.total ?? 0, daysOff: t.daysOff }));
    const capacityInHorizon = trainers.reduce((sum, t) => sum + (t.capacity.inHorizon ?? 0), 0);
    const utilizationPct = pctOf(demand.total, capacityInHorizon);

    return {
        horizonDays,
        owner: { userId: owner.userId, name: owner.name },
        demand: { ...demand, incoming },
        breakdown: {
            byPackage: [...byPackageMap].map(([packageName, count]) => ({ package: packageName, count }))
                .sort((a, b) => b.count - a.count),
            byAction,
            byType,
        },
        aging: { ...aging, oldestSubmittedAt: aging.oldestSubmittedAt?.toISOString() ?? null },
        capacity: {
            total: capacityTotal,
            inHorizon: capacityInHorizon,
            today: teamCapacityOn(startDate, schedule),
            averagePerDay: Math.round(averageDailyCapacity(schedule) * 10) / 10,
            countedTrainers: trainers.length,
            byAction: { nutrition: null as number | null, workout: null as number | null },
        },
        utilization: {
            pct: utilizationPct,
            gap: capacityInHorizon > 0 ? capacityInHorizon - demand.total : null,
            status: statusByGoal(daysToClear(demand.total, startDate, schedule), targetDays),
            targetDays,
            // Calendar days to finish everything waiting at the team's real day-by-day capacity (null: never).
            daysToClear: daysToClear(demand.total, startDate, schedule),
        },
        trainers,
        notConfigured: notConfigured.map((m) => ({
            userId: m.userId, memberId: m.memberId, name: m.name, role: m.role, daysOff: m.daysOff,
            load: loadByUser.get(m.userId) ?? emptyLoad(),
        })),
        unassigned: { load: unassignedLoad },
        otherAssigned,
    };
}

export type OperationsSummary = ReturnType<typeof buildSummary>;
