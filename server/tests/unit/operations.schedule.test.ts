import {
    averageDailyCapacity, daysToClear, isWorkingDay, parseDaysOff, sameDays, teamCapacityOn, weekdayOf, workingDaysInWindow,
} from '../../src/modules/operations/operations.schedule';

// 2026-10-14 is a Wednesday (3).
describe('weekdayOf / isWorkingDay', () => {
    test('maps dates to weekdays, Sunday = 0', () => {
        expect(weekdayOf('2026-10-14')).toBe(3);
        expect(weekdayOf('2026-10-18')).toBe(0);
        expect(weekdayOf('2026-10-17')).toBe(6);
    });
    test('a day off is not a working day', () => {
        expect(isWorkingDay('2026-10-16', [5, 6])).toBe(false);
        expect(isWorkingDay('2026-10-15', [5, 6])).toBe(true);
    });
});

describe('workingDaysInWindow', () => {
    test('counts working days from the start date, across a week boundary', () => {
        expect(workingDaysInWindow('2026-10-14', 7, [5, 6])).toBe(5);
        expect(workingDaysInWindow('2026-10-14', 3, [5, 6])).toBe(2);   // Wed, Thu work; Fri off
        expect(workingDaysInWindow('2026-10-14', 1, [3])).toBe(0);
        expect(workingDaysInWindow('2026-10-14', 7, [])).toBe(7);
    });
});

describe('parseDaysOff', () => {
    test('accepts a list of weekdays, de-duplicates and sorts it', () => {
        expect(parseDaysOff([6, 5, 5])).toEqual([5, 6]);
        expect(parseDaysOff([])).toEqual([]);
    });
    test.each([[undefined], [null], ['5'], [[7]], [[-1]], [[1.5]], [['5']], [[0, 1, 2, 3, 4, 5, 6]]])('rejects %p', (bad) => {
        expect(parseDaysOff(bad)).toBeNull();
    });
});

describe('sameDays', () => {
    test('compares sorted lists', () => {
        expect(sameDays([5, 6], [5, 6])).toBe(true);
        expect(sameDays([5], [5, 6])).toBe(false);
        expect(sameDays([], [])).toBe(true);
    });
});

describe('teamCapacityOn / averageDailyCapacity', () => {
    const people = [{ dailyCapacity: 10, daysOff: [5, 6] }, { dailyCapacity: 4, daysOff: [] }];
    test('sums only the people working that date', () => {
        expect(teamCapacityOn('2026-10-14', people)).toBe(14);
        expect(teamCapacityOn('2026-10-16', people)).toBe(4);
    });
    test('averages over a week', () => {
        expect(averageDailyCapacity(people)).toBeCloseTo(10 * 5 / 7 + 4, 5);
    });
});

describe('daysToClear', () => {
    test('zero demand takes zero days', () => expect(daysToClear(0, '2026-10-14', [])).toBe(0));
    test('no capacity at all never clears', () => expect(daysToClear(5, '2026-10-14', [])).toBeNull());
    test('someone who works one weekday still clears, just later', () => {
        // Works Mondays only, 10/day: 25 plans need Mondays Oct 19, Oct 26, Nov 2 (the 20th calendar day from Wed Oct 14).
        expect(daysToClear(25, '2026-10-14', [{ dailyCapacity: 10, daysOff: [0, 2, 3, 4, 5, 6] }])).toBe(20);
    });
    test('finishes on the day capacity first covers demand', () => {
        expect(daysToClear(10, '2026-10-14', [{ dailyCapacity: 10, daysOff: [] }])).toBe(1);
        expect(daysToClear(11, '2026-10-14', [{ dailyCapacity: 10, daysOff: [] }])).toBe(2);
    });
});
