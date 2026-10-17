import { describe, test, expect } from 'vitest';
import { capacityDelta, deltaTone, finishedDelta, fullnessDelta, percentChange, waitingDelta } from './kpiDeltas';

const days = (n, make) => Array.from({ length: n }, (_, i) => make(i));

describe('percentChange', () => {
    test('computes the change relative to the earlier value', () => {
        expect(percentChange(15, 10)).toBe(50);
        expect(percentChange(5, 10)).toBe(-50);
    });
    test('is null when there is nothing to compare against', () => {
        expect(percentChange(5, 0)).toBeNull();
        expect(percentChange(5, null)).toBeNull();
        expect(percentChange(null, 5)).toBeNull();
    });
});

describe('waitingDelta', () => {
    test('compares today with the same day last week', () => {
        const points = days(14, (i) => ({ waiting: i === 6 ? 20 : i === 13 ? 10 : 0 }));
        expect(waitingDelta(points)).toEqual({ unit: 'percent', value: -50, direction: 'down' });
    });
    test('needs more than a week of points', () => {
        expect(waitingDelta(days(7, () => ({ waiting: 1 })))).toBeNull();
    });
    test('is null when a week ago there was nothing waiting', () => {
        expect(waitingDelta(days(14, (i) => ({ waiting: i === 13 ? 4 : 0 })))).toBeNull();
    });
    test('reports flat when nothing moved', () => {
        expect(waitingDelta(days(14, () => ({ waiting: 5 })))).toMatchObject({ value: 0, direction: 'flat' });
    });
});

describe('capacityDelta', () => {
    test('compares the average of the last 7 days with the 7 days before, so days off average out', () => {
        // Previous week averages 10 (incl. two zero days), last week averages 12.
        const previous = [10, 10, 10, 10, 10, 0, 0].map((capacity) => ({ capacity: capacity * 14 / 10 }));
        const last = [12, 12, 12, 12, 12, 12, 12].map((capacity) => ({ capacity }));
        const result = capacityDelta([...previous, ...last]);
        expect(result.direction).toBe('up');
        expect(result.value).toBeCloseTo(((12 - 10) / 10) * 100, 5);
    });
    test('needs two full weeks', () => {
        expect(capacityDelta(days(13, () => ({ capacity: 5 })))).toBeNull();
    });
});

describe('finishedDelta', () => {
    test('compares the plans finished in the last 7 days with the 7 days before', () => {
        const points = days(14, (i) => ({ finished: i < 7 ? 2 : 3 }));   // 14 then 21
        expect(finishedDelta(points)).toEqual({ unit: 'percent', value: 50, direction: 'up' });
    });
    test('is null with under two weeks of history, or when nothing was finished the week before', () => {
        expect(finishedDelta(days(13, () => ({ finished: 1 })))).toBeNull();
        expect(finishedDelta(days(14, (i) => ({ finished: i < 7 ? 0 : 4 })))).toBeNull();
    });
});

describe('fullnessDelta', () => {
    test('is a difference in percentage points', () => {
        const points = days(14, (i) => ({ fullPct: i === 6 ? 80 : i === 13 ? 100 : 50 }));
        expect(fullnessDelta(points)).toEqual({ unit: 'points', value: 20, direction: 'up' });
    });
    test('is null when either end has no value', () => {
        expect(fullnessDelta(days(14, (i) => ({ fullPct: i === 13 ? null : 50 })))).toBeNull();
    });
});

describe('deltaTone', () => {
    test('going down is good for waiting plans, up is bad', () => {
        expect(deltaTone({ direction: 'down' }, 'down')).toBe('good');
        expect(deltaTone({ direction: 'up' }, 'down')).toBe('bad');
    });
    test('going up is good for capacity and finished plans', () => {
        expect(deltaTone({ direction: 'up' }, 'up')).toBe('good');
    });
    test('flat or missing is neutral', () => {
        expect(deltaTone({ direction: 'flat' }, 'up')).toBe('neutral');
        expect(deltaTone(null, 'up')).toBe('neutral');
    });
});
