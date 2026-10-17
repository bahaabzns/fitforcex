import { buildKpiSeries } from '../../src/modules/operations/operations.kpi';

const dates = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
const noneFinished = new Array(10).fill(0);

describe('buildKpiSeries', () => {
    test('carries waiting and capacity per day, aligned with the dates', () => {
        const series = buildKpiSeries(dates, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(series).toHaveLength(10);
        expect(series[0]).toMatchObject({ date: '2026-10-01', waiting: 5, capacity: 10 });
        expect(series[9]).toMatchObject({ date: '2026-10-10', waiting: 14, capacity: 10, finished: 9 });
    });

    test('how full compares the backlog with the average capacity of the 7 days to that day', () => {
        // Capacity 10 on weekdays, 0 on two weekend days: the 7-day average is smoother than the raw day.
        const capacity = [10, 10, 10, 10, 10, 0, 0, 10, 10, 10];
        const waiting = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
        const series = buildKpiSeries(dates, waiting, capacity, noneFinished);
        // Day 7 (index 6): window = days 1..7 -> (10*5 + 0 + 0) / 7
        expect(series[6].fullPct).toBeCloseTo((10 / (50 / 7)) * 100, 1);
        // A weekend day does not read as "infinitely full" even though its own capacity is 0.
        expect(series[5].fullPct).not.toBeNull();
    });

    test('uses a shorter window at the start of the series', () => {
        const series = buildKpiSeries(dates, new Array(10).fill(5), new Array(10).fill(10), noneFinished);
        expect(series[0].fullPct).toBe(50);
    });

    test('is null when the team had no capacity at all in the window', () => {
        const series = buildKpiSeries(dates, new Array(10).fill(5), new Array(10).fill(0), noneFinished);
        expect(series.every((p) => p.fullPct === null)).toBe(true);
    });
});
