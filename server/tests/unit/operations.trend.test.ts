import { addDays, buildDailyCapacity, buildDailySeries, daysBetween, isIsoDate, parseCustomRange, resolveTimeZone, todayIn } from '../../src/modules/operations/operations.trend';

describe('addDays', () => {
    test.each([
        ['2026-10-17', -1, '2026-10-16'],
        ['2026-03-01', -1, '2026-02-28'],
        ['2026-01-01', -1, '2025-12-31'],
        ['2028-03-01', -1, '2028-02-29'],
        ['2026-10-17', 0, '2026-10-17'],
    ])('%s %i days -> %s', (start, delta, expected) => {
        expect(addDays(start, delta)).toBe(expected);
    });
});

describe('buildDailySeries', () => {
    test('returns exactly `days` points ending today, filling empty days with zero', () => {
        const series = buildDailySeries([{ date: '2026-10-15', count: 4 }], '2026-10-17', 3);
        expect(series).toEqual([
            { date: '2026-10-15', count: 4 },
            { date: '2026-10-16', count: 0 },
            { date: '2026-10-17', count: 0 },
        ]);
    });

    test('ignores rows outside the window', () => {
        const series = buildDailySeries([{ date: '2026-09-01', count: 9 }], '2026-10-17', 2);
        expect(series.map((p) => p.count)).toEqual([0, 0]);
    });

    test('keeps a continuous axis across a month boundary', () => {
        const series = buildDailySeries([], '2026-03-02', 4);
        expect(series.map((p) => p.date)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    });
});

describe('resolveTimeZone', () => {
    test('keeps a valid IANA zone', () => expect(resolveTimeZone('Africa/Cairo')).toBe('Africa/Cairo'));
    test.each([[undefined], [''], [42], ['Not/AZone'], ["'; DROP TABLE x; --"]])('falls back to UTC for %p', (bad) => {
        expect(resolveTimeZone(bad)).toBe('UTC');
    });
});

describe('buildDailyCapacity', () => {
    const dates = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];
    const person = (overrides = {}) => ({ userId: 'a', joinedDate: null, currentCapacity: 8, currentDaysOff: [], ...overrides });

    test('uses the current value when a person has no history', () => {
        expect(buildDailyCapacity(dates, [person()], [])).toEqual([8, 8, 8, 8]);
    });

    test('a change applies from the day it was made, and earlier days use the previous value', () => {
        const changes = [{ userId: 'a', localDate: '2026-10-12', previous: 5, next: 8, previousDaysOff: [], nextDaysOff: [] }];
        expect(buildDailyCapacity(dates, [person()], changes)).toEqual([5, 5, 8, 8]);
    });

    test('several changes on different days step through each value; the last change on a day wins', () => {
        const changes = [
            { userId: 'a', localDate: '2026-10-11', previous: 4, next: 6, previousDaysOff: [], nextDaysOff: [] },
            { userId: 'a', localDate: '2026-10-13', previous: 6, next: 9, previousDaysOff: [], nextDaysOff: [] },
            { userId: 'a', localDate: '2026-10-13', previous: 9, next: 10, previousDaysOff: [], nextDaysOff: [] },
        ];
        expect(buildDailyCapacity(dates, [person({ currentCapacity: 10 })], changes)).toEqual([4, 6, 6, 10]);
    });

    test('a cleared capacity counts as zero from that day', () => {
        const changes = [{ userId: 'a', localDate: '2026-10-12', previous: 6, next: null, previousDaysOff: [], nextDaysOff: [] }];
        expect(buildDailyCapacity(dates, [person({ currentCapacity: null })], changes)).toEqual([6, 6, 0, 0]);
    });

    // dates fall on Sat 10/10 ... Tue 10/13 -> weekdays 6, 0, 1, 2
    test('a day off counts as zero on that weekday (current schedule, no history)', () => {
        expect(buildDailyCapacity(dates, [person({ currentDaysOff: [6, 0] })], [])).toEqual([0, 0, 8, 8]);
    });

    test('days off are replayed from history: before a change the old days off apply', () => {
        // Off Sat+Sun until 10/12, then off Tue only.
        const changes = [{ userId: 'a', localDate: '2026-10-12', previous: 8, next: 8, previousDaysOff: [6, 0], nextDaysOff: [2] }];
        expect(buildDailyCapacity(dates, [person({ currentDaysOff: [2] })], changes)).toEqual([0, 0, 8, 0]);
    });

    test('a change of both capacity and days off applies from its day', () => {
        const changes = [{ userId: 'a', localDate: '2026-10-11', previous: 4, next: 6, previousDaysOff: [], nextDaysOff: [1] }];
        // 10 Sat: 4 | 11 Sun: 6 | 12 Mon: off | 13 Tue: 6
        expect(buildDailyCapacity(dates, [person({ currentCapacity: 6, currentDaysOff: [1] })], changes)).toEqual([4, 6, 0, 6]);
    });

    test('a person counts as zero until the day they joined', () => {
        expect(buildDailyCapacity(dates, [person({ joinedDate: '2026-10-12' })], [])).toEqual([0, 0, 8, 8]);
    });

    test('sums everyone and keeps each history separate per person', () => {
        const people = [person({ userId: 'a' }), person({ userId: 'b', currentCapacity: 2 })];
        const changes = [{ userId: 'b', localDate: '2026-10-11', previous: 1, next: 2, previousDaysOff: [], nextDaysOff: [] }];
        expect(buildDailyCapacity(dates, people, changes)).toEqual([9, 10, 10, 10]);
    });
});

describe('isIsoDate / daysBetween', () => {
    test.each([['2026-10-17', true], ['2026-02-30', false], ['2026-13-01', false], ['17/10/2026', false], ['', false], [20261017, false]])(
        'isIsoDate(%p) -> %p', (value, expected) => expect(isIsoDate(value)).toBe(expected));
    test('daysBetween counts calendar days across months and leap years', () => {
        expect(daysBetween('2026-10-17', '2026-10-17')).toBe(0);
        expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    });
});

describe('parseCustomRange', () => {
    const today = '2026-10-17';
    test('accepts a valid range', () => expect(parseCustomRange('2026-10-01', '2026-10-10', today)).toEqual({ from: '2026-10-01', to: '2026-10-10' }));
    test('clamps a future end date to today', () => expect(parseCustomRange('2026-10-01', '2027-01-01', today)).toEqual({ from: '2026-10-01', to: today }));
    test.each([
        ['missing end', '2026-10-01', undefined],
        ['bad date', '2026-02-30', '2026-03-05'],
        ['start after end', '2026-10-10', '2026-10-01'],
        ['start in the future', '2026-12-01', '2026-12-05'],
        ['over 366 days', '2025-01-01', '2026-10-17'],
    ])('rejects %s', (_label, from, to) => expect(parseCustomRange(from, to, today)).toBeNull());
    test('allows exactly 366 days', () => expect(parseCustomRange('2025-10-17', today, today)).not.toBeNull());
});

describe('todayIn', () => {
    test('uses the zone to decide the calendar day', () => {
        const instant = new Date('2026-10-16T23:30:00Z');
        expect(todayIn('UTC', instant)).toBe('2026-10-16');
        expect(todayIn('Pacific/Kiritimati', instant)).toBe('2026-10-17'); // UTC+14
    });
});
