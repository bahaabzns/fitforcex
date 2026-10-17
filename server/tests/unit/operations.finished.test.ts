import { buildFinishedSeries } from '../../src/modules/operations/operations.finished';

const dates = ['2026-10-12', '2026-10-13', '2026-10-14'];
const people = [
    { userId: 'a', name: 'Ana', role: 'trainer', isOwner: false },
    { userId: 'b', name: 'Ben', role: 'nutritionist', isOwner: false },
];
const capacities = new Map([['a', [5, 5, 0]], ['b', [3, 3, 3]]]);

function build(rows: Array<{ userId: string | null; date: string; count: number }>) {
    return buildFinishedSeries({ rows, people, dates, capacityByUser: capacities, today: '2026-10-14' });
}

describe('buildFinishedSeries', () => {
    test('counts plans per person per day and totals them', () => {
        const result = build([
            { userId: 'a', date: '2026-10-12', count: 4 },
            { userId: 'a', date: '2026-10-14', count: 2 },
            { userId: 'b', date: '2026-10-13', count: 1 },
        ]);
        const ana = result.people.find((p) => p.userId === 'a')!;
        expect(ana.points.map((p) => p.count)).toEqual([4, 0, 2]);
        expect(ana).toMatchObject({ total: 6, averagePerDay: 2, today: 2 });
        expect(result.team.total).toBe(7);
        expect(result.team.points.map((p) => p.count)).toEqual([4, 1, 2]);
    });

    test('carries each person capacity per day, and sums it for the team', () => {
        const result = build([]);
        expect(result.people.find((p) => p.userId === 'a')!.points.map((p) => p.capacity)).toEqual([5, 5, 0]);
        expect(result.team.points.map((p) => p.capacity)).toEqual([8, 8, 3]);
    });

    test('keeps people with nothing finished in the list, busiest first', () => {
        const result = build([{ userId: 'b', date: '2026-10-13', count: 3 }]);
        expect(result.people.map((p) => p.userId)).toEqual(['b', 'a']);
        expect(result.people[1].total).toBe(0);
    });

    test('work credited to nobody or to someone not on the team stays in the team total as unattributed', () => {
        const result = build([
            { userId: null, date: '2026-10-12', count: 2 },
            { userId: 'gone', date: '2026-10-13', count: 5 },
        ]);
        expect(result.unattributed.total).toBe(7);
        expect(result.team.total).toBe(7);
        expect(result.people.every((p) => p.total === 0)).toBe(true);
    });

    test('ignores rows outside the requested dates', () => {
        const result = build([{ userId: 'a', date: '2026-09-01', count: 9 }]);
        expect(result.team.total).toBe(0);
    });

    test('today is zero when today is not inside the range', () => {
        const result = buildFinishedSeries({ rows: [{ userId: 'a', date: '2026-10-12', count: 3 }], people, dates, capacityByUser: capacities, today: '2027-01-01' });
        expect(result.people.find((p) => p.userId === 'a')!.today).toBe(0);
    });
});
