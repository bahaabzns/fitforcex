import { describe, test, expect } from 'vitest';
import { describeWorkload, findMostRoom } from './workloadInsights';

const load = (total) => ({ total, nutrition: total, workout: 0 });
const row = (userId, name, capacity, loadTotal) => ({
    userId, name, capacity: { total: capacity, inHorizon: capacity }, load: load(loadTotal),
});

function summary(overrides = {}) {
    return {
        horizonDays: 1,
        demand: { total: 20, unassigned: 0, reviewOnly: 0, incoming: 0 },
        capacity: { total: 30, averagePerDay: 30, countedTrainers: 2 },
        utilization: { pct: 66.7, gap: 10, status: 'healthy', daysToClear: 1, targetDays: 2 },
        trainers: [row('a', 'Ana', 10, 8), row('b', 'Ben', 20, 12)],
        notConfigured: [],
        unassigned: { load: load(0) },
        otherAssigned: 0,
        ...overrides,
    };
}

const noCapacity = {
    capacity: { total: 0, averagePerDay: 0, countedTrainers: 0 },
    utilization: { pct: null, gap: null, status: null, daysToClear: null },
    trainers: [],
};

describe('describeWorkload headline', () => {
    test('says nothing is waiting when demand is zero', () => {
        expect(describeWorkload(summary({ demand: { total: 0, unassigned: 0 } })).headline.key).toBe('summaryNothingWaiting');
    });

    test('asks the coach to set limits when no capacity is counted', () => {
        const result = describeWorkload(summary(noCapacity));
        expect(result.headline).toEqual({ key: 'summaryNoCapacity', values: { waiting: 20 } });
    });

    test('uses the server days-to-clear (days off included) and the average daily capacity', () => {
        expect(describeWorkload(summary()).headline.values).toEqual({ waiting: 20, capacity: 30, days: 1 });
        const withDaysOff = summary({
            demand: { total: 61, unassigned: 0 },
            capacity: { total: 30, averagePerDay: 21.4, countedTrainers: 2 },
            utilization: { pct: 100, gap: 0, status: 'tight', daysToClear: 4 },
        });
        expect(describeWorkload(withDaysOff).headline.values).toEqual({ waiting: 61, capacity: 21, days: 4 });
    });

    test('falls back to the no-capacity message when the team could never clear the work', () => {
        const never = summary({ utilization: { pct: null, gap: null, status: null, daysToClear: null } });
        expect(describeWorkload(never).headline.key).toBe('summaryNoCapacity');
    });
});

describe('describeWorkload busiest person', () => {
    test('names the person with the most plans when there are several people', () => {
        expect(describeWorkload(summary()).busiest).toEqual({ userId: 'b', name: 'Ben', load: 12 });
    });

    test('includes people who have no limit set', () => {
        const result = describeWorkload(summary({ notConfigured: [{ userId: 'c', name: 'Cy', load: load(30) }] }));
        expect(result.busiest.name).toBe('Cy');
    });

    test('is omitted for a one-person team, where naming them adds nothing', () => {
        expect(describeWorkload(summary({ trainers: [row('a', 'Ana', 10, 8)] })).busiest).toBeNull();
    });
});

describe('describeWorkload hints', () => {
    test('overloaded points at the queue', () => {
        const result = describeWorkload(summary({ utilization: { pct: 150, gap: -10, status: 'overloaded', daysToClear: 3, targetDays: 2 } }));
        expect(result.hints[0]).toEqual({ key: 'hintOverloaded', values: { days: 2 }, action: 'openQueue' });
    });

    test('tight and healthy give their own advice', () => {
        expect(describeWorkload(summary({ utilization: { status: 'tight', daysToClear: 2, targetDays: 2 } })).hints[0]).toMatchObject({ key: 'hintTight', values: { days: 2 } });
        expect(describeWorkload(summary()).hints[0]).toMatchObject({ key: 'hintHealthy', values: { days: 2 } });
    });

    test('unassigned plans offer to assign them to the person with the most room', () => {
        const result = describeWorkload(summary({ demand: { total: 20, unassigned: 9 }, unassigned: { load: load(9) } }));
        const hint = result.hints.find((h) => h.key === 'hintUnassigned');
        expect(hint.action).toBe('assign');
        expect(hint.assign).toMatchObject({ userId: 'b', name: 'Ben', room: 8, canTake: 8 });
    });

    test('with nobody having room, unassigned plans just link to the list', () => {
        const full = summary({
            demand: { total: 50, unassigned: 4 }, unassigned: { load: load(4) },
            trainers: [row('a', 'Ana', 10, 10), row('b', 'Ben', 20, 25)],
        });
        expect(describeWorkload(full).hints.find((h) => h.key === 'hintUnassigned').action).toBe('openUnassigned');
    });

    test('mentions team members who have no limit set', () => {
        const result = describeWorkload(summary({ notConfigured: [{ userId: 'c', name: 'Cy', load: load(0) }] }));
        expect(result.hints.at(-1)).toEqual({ key: 'hintSetLimits', values: { count: 1 } });
    });

    test('gives no status hint before any capacity is configured', () => {
        expect(describeWorkload(summary(noCapacity)).hints).toEqual([]);
    });
});

describe('findMostRoom', () => {
    test('measures room over the window using what each person can really finish in it', () => {
        const three = summary({
            horizonDays: 3,
            trainers: [
                { ...row('a', 'Ana', 10, 8), capacity: { total: 10, inHorizon: 30 } },
                { ...row('b', 'Ben', 20, 12), capacity: { total: 20, inHorizon: 40 } },   // a day off in the window
            ],
        });
        expect(findMostRoom(three)).toMatchObject({ userId: 'b', room: 28 });
    });

    test('a person who is off for the whole window has no room, however high their limit', () => {
        const off = summary({ trainers: [{ ...row('a', 'Ana', 10, 0), capacity: { total: 10, inHorizon: 0 } }] });
        expect(findMostRoom(off)).toBeNull();
    });

    test('skips people with no capacity, or who are already full', () => {
        const none = summary({ trainers: [row('a', 'Ana', 5, 5), { ...row('z', 'Zed', null, 0), capacity: { total: null, inHorizon: null } }] });
        expect(findMostRoom(none)).toBeNull();
    });

    test('canTake never exceeds the unassigned plans', () => {
        const few = summary({ unassigned: { load: load(3) } });
        expect(findMostRoom(few).canTake).toBe(3);
    });
});
