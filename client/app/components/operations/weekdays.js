// Weekday helpers for days off. Numbers match the server: 0 = Sunday ... 6 = Saturday.

export const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

// 2023-01-01 was a Sunday, so day `dow` is Jan 1 + dow. Formatted in UTC so the result
// never depends on the browser's time zone.
export function weekdayLabel(locale, dow, style = "short") {
    return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + dow)));
}

// "Fri, Sat", or an empty string when the person works every day.
export function formatDaysOff(locale, daysOff) {
    return [...(daysOff ?? [])].sort((a, b) => a - b).map((dow) => weekdayLabel(locale, dow)).join(", ");
}

export const sameDaysOff = (a, b) => {
    const left = [...(a ?? [])].sort((x, y) => x - y);
    const right = [...(b ?? [])].sort((x, y) => x - y);
    return left.length === right.length && left.every((day, i) => day === right[i]);
};
