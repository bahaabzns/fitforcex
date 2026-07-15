/**
 * Shared date-range/preset helpers for AreaChart-backed metric views (client
 * portal transformation, coach client overview/transformation, coach
 * dashboard). Centralized here after the same block was copy-pasted across
 * three pages — see CLAUDE.md B3 (extract on the 3rd copy).
 */

import { today, getLocalTimeZone } from "@internationalized/date";

export const tz = getLocalTimeZone();

export function toStartOfDay(calDate) {
    return calDate.toDate(tz);
}

export function toEndOfDay(calDate) {
    const d = calDate.toDate(tz);
    d.setHours(23, 59, 59, 999);
    return d;
}

export function filterByRange(history, startDate, endDate) {
    return history.filter(h => {
        const t = new Date(h.date).getTime();
        if (startDate && t < startDate.getTime()) return false;
        if (endDate && t > endDate.getTime()) return false;
        return true;
    });
}

export function rangeForDays(days) {
    const end = today(tz);
    return { start: end.subtract({ days }), end };
}

export const PRESETS = [
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
    { label: "6m",  days: 180 },
    { label: "All", days: null },
];

export function deltaInfo(history) {
    const nums = history.map(h => parseFloat(h.value)).filter(v => !isNaN(v));
    if (nums.length < 2) return null;
    return { first: nums[0], last: nums[nums.length - 1], delta: nums[nums.length - 1] - nums[0] };
}
