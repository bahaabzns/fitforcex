import { convertAmount } from "./currency";
import { percentChange } from "../app/components/operations/kpiDeltas";

// Everything the Finance dashboard shows, computed from the workspace's transactions: totals for a
// date range, the same totals for the period right before it, a day-by-day series for both, and
// breakdowns. Pure, so it can be tested without a browser.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_BREAKDOWN_ROWS = 6;
const UNKNOWN_LABEL = "—";

const pad = (n) => String(n).padStart(2, "0");

// The local calendar day as YYYY-MM-DD.
export function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// A payment counts on the day it is dated, falling back to the day it was recorded.
function transactionDate(tx) {
    const parsed = new Date(tx.date ?? tx.createdAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function change(current, previous) {
    const value = percentChange(current, previous);
    if (value === null) return null;
    const rounded = Math.round(value);
    return { unit: "percent", value, direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat" };
}

function totalsFor(rows, toDisplay) {
    let sales = 0;
    let payments = 0;
    let refunds = 0;
    let refundCount = 0;
    for (const tx of rows) {
        if (tx.status === "completed") { sales += toDisplay(tx); payments += 1; }
        else if (tx.status === "refunded") { refunds += toDisplay(tx); refundCount += 1; }
    }
    return { sales, payments, refunds, refundCount, average: payments > 0 ? sales / payments : 0 };
}

function breakdownOf(rows, keyOf, toDisplay) {
    const groups = new Map();
    for (const tx of rows) {
        if (tx.status !== "completed") continue;
        const key = keyOf(tx) || UNKNOWN_LABEL;
        const group = groups.get(key) ?? { key, value: 0, count: 0 };
        group.value += toDisplay(tx);
        group.count += 1;
        groups.set(key, group);
    }
    const ranked = [...groups.values()].sort((a, b) => b.value - a.value);
    if (ranked.length <= MAX_BREAKDOWN_ROWS) return ranked;
    // The long tail is folded into one row so the list stays readable.
    const shown = ranked.slice(0, MAX_BREAKDOWN_ROWS - 1);
    const rest = ranked.slice(MAX_BREAKDOWN_ROWS - 1);
    return [...shown, { key: "__other", other: true, value: rest.reduce((s, g) => s + g.value, 0), count: rest.reduce((s, g) => s + g.count, 0) }];
}

/**
 * @param transactions rows from /api/transactions (demo-client rows are ignored)
 * @param from, to     first and last day of the period, as Dates (inclusive)
 * @param currency     the currency every figure is converted to
 */
export function buildFinanceStats(transactions, { from, to, currency }) {
    const start = startOfDay(from);
    const end = startOfDay(to);
    const days = Math.max(1, Math.round((end - start) / MS_PER_DAY) + 1);
    const previousStart = addDays(start, -days);

    const toDisplay = (tx) => convertAmount(tx.amount, tx.currency, currency);

    const current = [];
    const previous = [];
    const dayIndex = new Map(); // day key -> position within its period
    for (let i = 0; i < days; i += 1) {
        dayIndex.set(dayKey(addDays(start, i)), { period: "current", index: i });
        dayIndex.set(dayKey(addDays(previousStart, i)), { period: "previous", index: i });
    }

    const series = {
        labels: Array.from({ length: days }, (_, i) => dayKey(addDays(start, i))),
        sales: { current: new Array(days).fill(0), previous: new Array(days).fill(0) },
        payments: new Array(days).fill(0),
        refunds: new Array(days).fill(0),
    };

    for (const tx of transactions) {
        if (tx.isDemo) continue;
        const date = transactionDate(tx);
        if (!date) continue;
        const slot = dayIndex.get(dayKey(date));
        if (!slot) continue;
        (slot.period === "current" ? current : previous).push(tx);
        if (tx.status === "completed") series.sales[slot.period][slot.index] += toDisplay(tx);
        if (slot.period === "current") {
            if (tx.status === "completed") series.payments[slot.index] += 1;
            if (tx.status === "refunded") series.refunds[slot.index] += toDisplay(tx);
        }
    }

    // Average per payment, day by day: a day with no payments keeps the last figure instead of dropping to zero.
    const dailyCounts = new Array(days).fill(0);
    for (const tx of current) {
        if (tx.status !== "completed") continue;
        dailyCounts[dayIndex.get(dayKey(transactionDate(tx))).index] += 1;
    }
    let lastAverage = 0;
    series.average = series.sales.current.map((sales, i) => {
        if (dailyCounts[i] > 0) lastAverage = sales / dailyCounts[i];
        return lastAverage;
    });

    const totals = { current: totalsFor(current, toDisplay), previous: totalsFor(previous, toDisplay) };

    return {
        days,
        totals,
        deltas: {
            sales: change(totals.current.sales, totals.previous.sales),
            payments: change(totals.current.payments, totals.previous.payments),
            average: change(totals.current.average, totals.previous.average),
            refunds: change(totals.current.refunds, totals.previous.refunds),
        },
        series,
        breakdown: {
            method: breakdownOf(current, (tx) => tx.paymentMethod, toDisplay),
            package: breakdownOf(current, (tx) => tx.packageVariation, toDisplay),
            currency: breakdownOf(current, (tx) => tx.currency, toDisplay),
        },
        // Exact, unconverted totals per currency for the "original currency" breakdown.
        originalByCurrency: current.reduce((totalsByCurrency, tx) => {
            if (tx.status === "completed") totalsByCurrency[tx.currency] = (totalsByCurrency[tx.currency] ?? 0) + tx.amount;
            return totalsByCurrency;
        }, {}),
        isEmpty: transactions.every((tx) => tx.isDemo),
    };
}

/** A range ending today and covering the last `days` days (today included). */
export function rangeEndingToday(days, now = new Date()) {
    const to = startOfDay(now);
    return { from: addDays(to, -(days - 1)), to };
}
