import { describe, it, expect } from "vitest";
import { buildFinanceStats, rangeEndingToday } from "./financeStats";

const TODAY = new Date(2026, 10, 11, 15, 0); // 11 Nov 2026
const at = (daysAgo, hour = 12) => new Date(2026, 10, 11 - daysAgo, hour).toISOString();

function tx(overrides) {
    return { amount: 100, currency: "EGP", status: "completed", paymentMethod: "Cash", packageVariation: "Gold", date: at(0), isDemo: false, ...overrides };
}

const stats = (rows, days = 7, currency = "EGP") => buildFinanceStats(rows, { ...rangeEndingToday(days, TODAY), currency });

describe("rangeEndingToday", () => {
    it("covers the last N days, today included", () => {
        const { from, to } = rangeEndingToday(7, TODAY);
        expect(to.getDate()).toBe(11);
        expect(from.getDate()).toBe(5);
    });
});

describe("buildFinanceStats totals", () => {
    it("adds up completed payments as sales and counts them", () => {
        const result = stats([tx({ amount: 100 }), tx({ amount: 300, date: at(2) })]);
        expect(result.totals.current).toMatchObject({ sales: 400, payments: 2, average: 200 });
    });

    it("keeps refunds out of sales and totals them separately", () => {
        const result = stats([tx({ amount: 500 }), tx({ amount: 80, status: "refunded" })]);
        expect(result.totals.current.sales).toBe(500);
        expect(result.totals.current.refunds).toBe(80);
        expect(result.totals.current.refundCount).toBe(1);
    });

    it("ignores demo-client payments, other statuses and payments outside both periods", () => {
        const result = stats([
            tx({ amount: 999, isDemo: true }),
            tx({ amount: 999, status: "pending" }),
            tx({ amount: 999, date: at(40) }),
            tx({ amount: 50 }),
        ]);
        expect(result.totals.current.sales).toBe(50);
        expect(result.totals.previous.sales).toBe(0);
    });

    it("converts every payment into the chosen currency", () => {
        const result = stats([tx({ amount: 10, currency: "USD" }), tx({ amount: 505, currency: "EGP" })], 7, "USD");
        expect(result.totals.current.sales).toBeCloseTo(20, 5); // 10 USD + 505 EGP / 50.5
    });

    it("dates a payment by its transaction date, not when it was recorded", () => {
        const result = stats([tx({ amount: 70, date: at(1), createdAt: at(0) })]);
        expect(result.series.sales.current[5]).toBe(70); // yesterday is index 5 of 7
        expect(result.series.sales.current[6]).toBe(0);
    });
});

describe("buildFinanceStats comparison", () => {
    it("compares with the period of the same length right before", () => {
        const result = stats([tx({ amount: 150 }), tx({ amount: 100, date: at(8) })]);
        expect(result.totals.previous.sales).toBe(100);
        expect(result.deltas.sales).toMatchObject({ direction: "up", value: 50 });
    });

    it("has no percentage when the previous period was empty", () => {
        const result = stats([tx({ amount: 150 })]);
        expect(result.deltas.sales).toBeNull();
    });

    it("lines the two periods up day by day", () => {
        const result = stats([tx({ amount: 10, date: at(0) }), tx({ amount: 7, date: at(7) })]);
        expect(result.series.sales.current[6]).toBe(10);
        expect(result.series.sales.previous[6]).toBe(7);
        expect(result.series.labels).toHaveLength(7);
    });
});

describe("buildFinanceStats breakdowns", () => {
    it("ranks payment methods by sales", () => {
        const result = stats([tx({ paymentMethod: "Cash", amount: 100 }), tx({ paymentMethod: "Visa", amount: 300 }), tx({ paymentMethod: "Cash", amount: 50 })]);
        expect(result.breakdown.method.map(row => [row.key, row.value, row.count])).toEqual([["Visa", 300, 1], ["Cash", 150, 2]]);
    });

    it("folds a long tail of packages into one Other row", () => {
        const rows = Array.from({ length: 9 }, (_, i) => tx({ packageVariation: `Pkg ${i}`, amount: 100 - i }));
        const packages = stats(rows).breakdown.package;
        expect(packages).toHaveLength(6);
        expect(packages.at(-1)).toMatchObject({ other: true, count: 4 });
    });

    it("keeps exact per-currency totals alongside the converted ranking", () => {
        const result = stats([tx({ amount: 10, currency: "USD" }), tx({ amount: 20, currency: "USD" })]);
        expect(result.originalByCurrency).toEqual({ USD: 30 });
    });

    it("reports an empty workspace", () => {
        expect(stats([]).isEmpty).toBe(true);
        expect(stats([tx({ isDemo: true })]).isEmpty).toBe(true);
        expect(stats([tx({})]).isEmpty).toBe(false);
    });
});
