import { percentChange } from "../app/components/operations/kpiDeltas";

// Trend lines and "vs last week" changes for the transaction summary cards. Pure, so it can be tested
// without a browser.

const TREND_DAYS = 14;
const WEEK = 7;

const pad = (n) => String(n).padStart(2, "0");

// The local calendar day a date falls on, as YYYY-MM-DD (people read "today" in their own time zone).
export function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * One point per day for the last `days` days (oldest first, ending today): the sum of `valueOf(row)`
 * over the rows dated that day (the transaction date, else when it was recorded). Days with nothing are 0,
 * so the line is continuous. Rows outside the window or without a usable date are ignored.
 */
export function dailySeries(rows, valueOf, { days = TREND_DAYS, now = new Date(), dateOf = (row) => row.date ?? row.createdAt } = {}) {
    const totals = new Map();
    for (let back = days - 1; back >= 0; back -= 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
        totals.set(dayKey(day), 0);
    }
    for (const row of rows) {
        const created = new Date(dateOf(row));
        if (Number.isNaN(created.getTime())) continue;
        const key = dayKey(created);
        if (totals.has(key)) totals.set(key, totals.get(key) + valueOf(row));
    }
    return [...totals].map(([date, value]) => ({ date, value }));
}

/**
 * The last 7 days against the 7 days before them, as the card's change: { unit, value, direction }, or
 * null when there is nothing before to compare with (a change from zero is not a percentage).
 */
export function weekOverWeekDelta(series) {
    if (series.length < WEEK * 2) return null;
    const total = (slice) => slice.reduce((sum, point) => sum + point.value, 0);
    const change = percentChange(total(series.slice(-WEEK)), total(series.slice(-WEEK * 2, -WEEK)));
    if (change === null) return null;
    const rounded = Math.round(change);
    return { unit: "percent", value: change, direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat" };
}
