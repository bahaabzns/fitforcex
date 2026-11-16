import { describe, it, expect } from "vitest";
import { dailySeries, dayKey, weekOverWeekDelta } from "./transactionTrends";

const NOW = new Date(2026, 10, 11, 15, 0); // 11 Nov 2026, local time
const daysAgo = (n, hour = 10) => new Date(2026, 10, 11 - n, hour).toISOString();
const amountOf = (row) => row.amount;

describe("dailySeries", () => {
    it("returns 14 days, oldest first, ending today", () => {
        const series = dailySeries([], amountOf, { now: NOW });
        expect(series).toHaveLength(14);
        expect(series[13].date).toBe(dayKey(NOW));
        expect(series[0].date).toBe("2026-10-29");
    });

    it("adds up everything created on the same day and leaves empty days at zero", () => {
        const rows = [
            { createdAt: daysAgo(0), amount: 100 },
            { createdAt: daysAgo(0, 18), amount: 50 },
            { createdAt: daysAgo(2), amount: 30 },
        ];
        const series = dailySeries(rows, amountOf, { now: NOW });
        expect(series[13].value).toBe(150);
        expect(series[11].value).toBe(30);
        expect(series[12].value).toBe(0);
    });

    it("ignores rows outside the window and rows without a usable date", () => {
        const rows = [
            { createdAt: daysAgo(20), amount: 999 },
            { createdAt: "not a date", amount: 999 },
            { createdAt: undefined, amount: 999 },
        ];
        const total = dailySeries(rows, amountOf, { now: NOW }).reduce((sum, point) => sum + point.value, 0);
        expect(total).toBe(0);
    });
});

describe("weekOverWeekDelta", () => {
    const flat = (value) => Array.from({ length: 14 }, (_, i) => ({ date: String(i), value: i < 7 ? value.before : value.after }));

    it("reports a rise as a percentage", () => {
        expect(weekOverWeekDelta(flat({ before: 100, after: 150 }))).toMatchObject({ unit: "percent", direction: "up", value: 50 });
    });

    it("reports a drop and no change", () => {
        expect(weekOverWeekDelta(flat({ before: 200, after: 100 })).direction).toBe("down");
        expect(weekOverWeekDelta(flat({ before: 100, after: 100 })).direction).toBe("flat");
    });

    it("has nothing to say when the earlier week was empty or the series is short", () => {
        expect(weekOverWeekDelta(flat({ before: 0, after: 100 }))).toBeNull();
        expect(weekOverWeekDelta([{ date: "x", value: 1 }])).toBeNull();
    });
});
