import { buildSummary, statusFor, statusByGoal, DemandGroup, MemberInput } from '../../src/modules/operations/operations.aggregate';

// A Wednesday, so "today" is a normal working day unless a test says otherwise.
const START = '2026-10-14';
const GOAL = 2;   // service goal, in days
const OWNER = { userId: 'owner', name: 'Olivia Owner', dailyCapacity: null as number | null, daysOff: [] as number[] };

function group(overrides: Partial<DemandGroup>): DemandGroup {
    return {
        assignedTo: null, packageName: 'Gold', postAction: 'nutrition-plan', formType: 'check-in',
        bucket: 'need', count: 1, oldestSubmittedAt: null, over1d: 0, over3d: 0, over7d: 0,
        ...overrides,
    };
}

function member(overrides: Partial<MemberInput>): MemberInput {
    return { memberId: `mem-${overrides.userId ?? 'm1'}`, userId: 'm1', name: 'Tina Trainer', role: 'trainer', isActive: true, dailyCapacity: 5, daysOff: [], ...overrides };
}

describe('statusFor', () => {
    test.each([
        [null, null], [0, 'healthy'], [79.9, 'healthy'], [80, 'tight'], [100, 'tight'], [100.1, 'overloaded'],
    ])('%s%% -> %s', (pct, expected) => {
        expect(statusFor(pct as number | null)).toBe(expected);
    });
});

describe('buildSummary', () => {
    test('counts only need-action plan-producing items in headline demand; review-only is separate', () => {
        const summary = buildSummary({
            groups: [
                group({ count: 4 }),
                group({ count: 3, postAction: 'workout-plan', formType: 'assessment' }),
                group({ count: 2, postAction: 'nothing' }),
                group({ count: 9, bucket: 'incoming' }),
            ],
            members: [member({})], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.demand).toEqual({ total: 7, unassigned: 7, reviewOnly: 2, incoming: 9 });
        expect(summary.breakdown.byAction).toEqual({ nutrition: 4, workout: 3 });
        expect(summary.breakdown.byType).toEqual({ assessment: 3, checkIn: 4 });
    });

    test('unassigned items count toward demand but not toward any trainer load', () => {
        const summary = buildSummary({
            groups: [group({ count: 6 }), group({ count: 2, assignedTo: 'm1' })],
            members: [member({ dailyCapacity: 10 })], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.demand.total).toBe(8);
        expect(summary.demand.unassigned).toBe(6);
        expect(summary.trainers[0].load.total).toBe(2);
        expect(summary.unassigned.load.total).toBe(6);
    });

    test('utilization and gap use capacity x horizon days; the status follows the service goal, not the window', () => {
        const groups = [group({ count: 12, assignedTo: 'm1' })];
        const members = [member({ dailyCapacity: 4 })];

        const oneDay = buildSummary({ groups, members, owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL });
        expect(oneDay.utilization).toMatchObject({ pct: 300, gap: -8, status: 'overloaded' });

        const threeDays = buildSummary({ groups, members, owner: OWNER, horizonDays: 3, startDate: START, targetDays: GOAL });
        expect(threeDays.utilization).toMatchObject({ pct: 100, gap: 0, status: 'overloaded' });

        const sevenDays = buildSummary({ groups, members, owner: OWNER, horizonDays: 7, startDate: START, targetDays: GOAL });
        expect(sevenDays.utilization.status).toBe('overloaded');
        expect(sevenDays.utilization.gap).toBe(16);
    });

    test('members with NULL capacity are listed as not configured and excluded from totals', () => {
        const summary = buildSummary({
            groups: [group({ count: 3, assignedTo: 'm2' })],
            members: [member({ userId: 'm1', dailyCapacity: 5 }), member({ userId: 'm2', name: 'Nora', dailyCapacity: null })],
            owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.capacity.total).toBe(5);
        expect(summary.trainers.map((t) => t.userId)).toEqual(['m1']);
        expect(summary.notConfigured).toEqual([{ userId: 'm2', memberId: 'mem-m2', name: 'Nora', role: 'trainer', daysOff: [], load: { total: 3, nutrition: 3, workout: 0 } }]);
        expect(summary.otherAssigned).toBe(0);
    });

    test('inactive members and receptionist/viewer roles never count; their assigned work surfaces as otherAssigned', () => {
        const summary = buildSummary({
            groups: [group({ count: 2, assignedTo: 'gone' }), group({ count: 1, assignedTo: 'rec' })],
            members: [
                member({ userId: 'gone', isActive: false }),
                member({ userId: 'rec', role: 'receptionist' }),
                member({ userId: 'v', role: 'viewer' }),
            ],
            owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.capacity.total).toBe(0);
        expect(summary.trainers).toEqual([]);
        expect(summary.otherAssigned).toBe(3);
    });

    test('zero total capacity yields null utilization and gap, never Infinity', () => {
        const summary = buildSummary({ groups: [group({ count: 5 })], members: [], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL });
        expect(summary.utilization).toEqual({ pct: null, gap: null, status: null, daysToClear: null, targetDays: GOAL });
    });

    test('owner counts as a trainer row only when owner capacity is set', () => {
        const withoutOwner = buildSummary({ groups: [], members: [], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL });
        expect(withoutOwner.trainers).toHaveLength(0);

        const withOwner = buildSummary({
            groups: [group({ count: 2, assignedTo: 'owner' })],
            members: [member({})], owner: { ...OWNER, dailyCapacity: 4 }, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(withOwner.capacity.total).toBe(9);
        expect(withOwner.trainers[0]).toMatchObject({ userId: 'owner', isOwner: true, utilizationPct: 50 });
    });

    test('merges package buckets, keeps null as "no package", and tracks aging', () => {
        const old = new Date('2026-01-01T00:00:00Z');
        const summary = buildSummary({
            groups: [
                group({ count: 2, packageName: 'Gold', oldestSubmittedAt: new Date('2026-02-01T00:00:00Z'), over1d: 2 }),
                group({ count: 1, packageName: 'Gold', postAction: 'workout-plan', over7d: 1, over3d: 1, over1d: 1, oldestSubmittedAt: old }),
                group({ count: 5, packageName: null }),
            ],
            members: [], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.breakdown.byPackage).toEqual([{ package: null, count: 5 }, { package: 'Gold', count: 3 }]);
        expect(summary.aging).toEqual({ oldestSubmittedAt: old.toISOString(), over1d: 3, over3d: 1, over7d: 1 });
    });

    test('rows expose per-action capacity placeholders so phase 2 can fill them without a shape change', () => {
        const summary = buildSummary({ groups: [], members: [member({})], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL });
        expect(summary.trainers[0].capacity).toEqual({ total: 5, inHorizon: 5, byAction: { nutrition: null, workout: null } });
        expect(summary.capacity.byAction).toEqual({ nutrition: null, workout: null });
    });

    // ── days off ──────────────────────────────────────────────
    // START is Wed 2026-10-14. Weekdays: 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat.

    test('a person on a day off today has no capacity today and no percentage for a 1-day window', () => {
        const summary = buildSummary({
            groups: [group({ count: 4, assignedTo: 'm1' })],
            members: [member({ dailyCapacity: 10, daysOff: [3] })], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.trainers[0]).toMatchObject({ workingDaysInHorizon: 0, capacity: { total: 10, inHorizon: 0 }, utilizationPct: null, clearDays: 2, status: 'tight' });
        expect(summary.capacity).toMatchObject({ total: 10, inHorizon: 0, today: 0 });
        expect(summary.utilization).toMatchObject({ pct: null, gap: null });
    });

    test('a 7-day window counts only the days someone works', () => {
        // Fri + Sat off: works 5 of any 7 days, so 10/day = 50 over the week.
        const summary = buildSummary({
            groups: [group({ count: 25, assignedTo: 'm1' })],
            members: [member({ dailyCapacity: 10, daysOff: [5, 6] })], owner: OWNER, horizonDays: 7, startDate: START, targetDays: GOAL,
        });
        expect(summary.trainers[0]).toMatchObject({ workingDaysInHorizon: 5, utilizationPct: 50, daysOff: [5, 6] });
        expect(summary.capacity.inHorizon).toBe(50);
        // Half the week's capacity is used, but with Fri + Sat off the 25 plans still take 5 calendar days: over the 2-day goal.
        expect(summary.utilization).toMatchObject({ pct: 50, gap: 25, daysToClear: 5, status: 'overloaded' });
    });

    test('team capacity today and on average both honour days off', () => {
        const summary = buildSummary({
            groups: [],
            members: [member({ userId: 'a', dailyCapacity: 7, daysOff: [3] }), member({ userId: 'b', dailyCapacity: 7, daysOff: [] })],
            owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.capacity.today).toBe(7);                 // only b works on Wednesday
        expect(summary.capacity.averagePerDay).toBe(13);        // 7*6/7 + 7
    });

    test('days to clear simulates the real week, skipping days off', () => {
        // 10/day, off Thu + Fri: Wed 10, Thu 0, Fri 0, Sat 10, Sun 10 -> 25 plans need 5 calendar days.
        const summary = buildSummary({
            groups: [group({ count: 25 })],
            members: [member({ dailyCapacity: 10, daysOff: [4, 5] })], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.utilization.daysToClear).toBe(5);
    });

    test('the owner days off apply too', () => {
        const summary = buildSummary({
            groups: [], members: [], owner: { ...OWNER, dailyCapacity: 4, daysOff: [3] }, horizonDays: 3, startDate: START, targetDays: GOAL,
        });
        expect(summary.trainers[0]).toMatchObject({ isOwner: true, workingDaysInHorizon: 2, capacity: { inHorizon: 8 } });
    });

    // ── status follows the service goal ───────────────────────
    // Wed 10/14 start; one person, 10 plans/day, works every day, so N plans take ceil(N / 10) days to clear.
    const withDemand = (count: number, targetDays = GOAL) => buildSummary({
        groups: [group({ count })], members: [member({ dailyCapacity: 10 })], owner: OWNER, horizonDays: 1, startDate: START, targetDays,
    });

    test('clearing everything within well under the goal is on track', () => {
        // 10 plans = 1 day, goal 2 days -> 50% of the goal
        expect(withDemand(10).utilization).toMatchObject({ daysToClear: 1, targetDays: 2, status: 'healthy' });
    });

    test('clearing it takes up to the goal is almost full; beyond it is too much work', () => {
        expect(withDemand(20).utilization).toMatchObject({ daysToClear: 2, status: 'tight' });       // exactly the goal
        expect(withDemand(21).utilization).toMatchObject({ daysToClear: 3, status: 'overloaded' });  // one day over
    });

    test('a backlog larger than one day of capacity is not "too much work" by itself', () => {
        // 18 plans vs 10/day: the old one-day rule called this overloaded (180%); against a 2-day goal it is fine.
        expect(withDemand(18).utilization).toMatchObject({ pct: 180, daysToClear: 2, status: 'tight' });
        expect(withDemand(18, 5).utilization.status).toBe('healthy');
    });

    test('a longer goal tolerates a longer backlog, a shorter goal does not', () => {
        expect(withDemand(30, 7).utilization.status).toBe('healthy');
        expect(withDemand(30, 1).utilization.status).toBe('overloaded');
    });

    test('nothing waiting is on track; no capacity at all has no status to give', () => {
        expect(withDemand(0).utilization.status).toBe('healthy');
        const noCapacity = buildSummary({ groups: [group({ count: 5 })], members: [], owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL });
        expect(noCapacity.utilization.status).toBeNull();
    });

    test('each person is judged on how long their own assigned plans would take against the goal', () => {
        const summary = buildSummary({
            groups: [group({ count: 6, assignedTo: 'a' }), group({ count: 25, assignedTo: 'b' })],
            members: [member({ userId: 'a', dailyCapacity: 10 }), member({ userId: 'b', dailyCapacity: 10 })],
            owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        const byId = Object.fromEntries(summary.trainers.map((t) => [t.userId, t]));
        expect(byId.a).toMatchObject({ clearDays: 1, status: 'healthy' });
        expect(byId.b).toMatchObject({ clearDays: 3, status: 'overloaded' });
    });

    test('days off lengthen how long it takes, and so the status', () => {
        // 20 plans at 10/day takes 2 days, but off on Thursday it takes 3 (Wed, Fri, Sat).
        const summary = buildSummary({
            groups: [group({ count: 20, assignedTo: 'a' })], members: [member({ userId: 'a', dailyCapacity: 10, daysOff: [4] })],
            owner: OWNER, horizonDays: 1, startDate: START, targetDays: GOAL,
        });
        expect(summary.trainers[0]).toMatchObject({ clearDays: 3, status: 'overloaded' });
        expect(summary.utilization).toMatchObject({ daysToClear: 3, status: 'overloaded' });
    });

    test('statusByGoal maps the ratio of clear-time to goal onto the same bands', () => {
        expect(statusByGoal(null, 2)).toBeNull();
        expect(statusByGoal(0, 2)).toBe('healthy');
        expect(statusByGoal(1, 2)).toBe('healthy');   // 50%
        expect(statusByGoal(2, 5)).toBe('healthy');   // 40%
        expect(statusByGoal(4, 5)).toBe('tight');     // 80%
        expect(statusByGoal(5, 5)).toBe('tight');     // 100%
        expect(statusByGoal(6, 5)).toBe('overloaded');
    });
});
