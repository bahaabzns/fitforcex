import { buildServiceLevel } from '../../src/modules/operations/operations.serviceLevel';

const dates = ['2026-10-12', '2026-10-13', '2026-10-14'];
const people = [
    { userId: 'a', name: 'Ana', role: 'trainer', isOwner: false },
    { userId: 'b', name: 'Ben', role: 'nutritionist', isOwner: false },
];
const noOpen = { open: 0, overdue: 0, longestHours: 0 };

function build(rows: Array<{ userId: string | null; date: string; hours: number }>, targetDays = 2, open = noOpen) {
    return buildServiceLevel({ rows, people, dates, targetDays, open });
}

describe('buildServiceLevel', () => {
    test('a plan is on time when the client waited no longer than the goal (inclusive)', () => {
        const result = build([
            { userId: 'a', date: '2026-10-12', hours: 47 },
            { userId: 'a', date: '2026-10-12', hours: 48 },    // exactly 2 days: still on time
            { userId: 'a', date: '2026-10-12', hours: 48.1 },
        ]);
        expect(result).toMatchObject({ finished: 3, onTime: 2, onTimePct: 66.7, targetDays: 2 });
    });

    test('reports average and median turnaround in hours', () => {
        const result = build([
            { userId: 'a', date: '2026-10-12', hours: 2 },
            { userId: 'a', date: '2026-10-13', hours: 4 },
            { userId: 'b', date: '2026-10-13', hours: 30 },
        ]);
        expect(result.averageHours).toBe(12);
        expect(result.medianHours).toBe(4);
    });

    test('the median of an even number of plans is the middle pair average', () => {
        expect(build([{ userId: 'a', date: '2026-10-12', hours: 2 }, { userId: 'a', date: '2026-10-12', hours: 6 }]).medianHours).toBe(4);
    });

    test('nothing finished gives null percentages and averages, never NaN', () => {
        const result = build([]);
        expect(result).toMatchObject({ finished: 0, onTimePct: null, averageHours: null, medianHours: null });
        expect(result.daily.every((d) => d.onTimePct === null)).toBe(true);
    });

    test('daily points follow the finish day, with a per-day on-time percentage', () => {
        const result = build([
            { userId: 'a', date: '2026-10-12', hours: 10 },
            { userId: 'a', date: '2026-10-12', hours: 100 },
            { userId: 'a', date: '2026-10-14', hours: 5 },
        ]);
        expect(result.daily.map((d) => [d.finished, d.onTimePct])).toEqual([[2, 50], [0, null], [1, 100]]);
    });

    test('each person gets their own on-time numbers, busiest first, quiet people kept', () => {
        const result = build([
            { userId: 'b', date: '2026-10-12', hours: 10 },
            { userId: 'b', date: '2026-10-13', hours: 90 },
        ]);
        expect(result.people.map((p) => p.userId)).toEqual(['b', 'a']);
        expect(result.people[0]).toMatchObject({ finished: 2, onTime: 1, onTimePct: 50 });
        expect(result.people[1]).toMatchObject({ finished: 0, onTimePct: null });
    });

    test('work credited to nobody or to someone off the team counts overall but is listed as unattributed', () => {
        const result = build([
            { userId: null, date: '2026-10-12', hours: 1 },
            { userId: 'gone', date: '2026-10-13', hours: 1 },
        ]);
        expect(result.finished).toBe(2);
        expect(result.unattributed.finished).toBe(2);
        expect(result.people.every((p) => p.finished === 0)).toBe(true);
    });

    test('ignores rows outside the dates', () => {
        expect(build([{ userId: 'a', date: '2026-09-01', hours: 1 }]).finished).toBe(0);
    });

    test('passes through the plans waiting now, rounded', () => {
        const result = build([], 2, { open: 9, overdue: 4, longestHours: 130.26 });
        expect(result.waiting).toEqual({ open: 9, overdue: 4, longestHours: 130.3 });
    });

    test('a different goal moves the on-time line', () => {
        const rows = [{ userId: 'a', date: '2026-10-12', hours: 30 }];
        expect(build(rows, 1).onTimePct).toBe(0);
        expect(build(rows, 2).onTimePct).toBe(100);
    });
});
