// Working-day arithmetic for capacity. Weekdays follow JS/Postgres: 0 = Sunday ... 6 = Saturday.
// Everything works on plain YYYY-MM-DD calendar dates (UTC midnight), so the result does not depend
// on the server's time zone: callers decide which calendar date "today" is for the viewer.

export const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function weekdayOf(isoDate: string): number {
    return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

export function addDaysTo(isoDate: string, delta: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
}

export function isWorkingDay(isoDate: string, daysOff: readonly number[]): boolean {
    return !daysOff.includes(weekdayOf(isoDate));
}

// How many of the `days` days starting at `startDate` the person works.
export function workingDaysInWindow(startDate: string, days: number, daysOff: readonly number[]): number {
    let working = 0;
    for (let i = 0; i < days; i++) if (isWorkingDay(addDaysTo(startDate, i), daysOff)) working++;
    return working;
}

// Accepts only an array of distinct weekday numbers; returns it sorted, or null if invalid.
// All seven days off is rejected: it would silently remove the person from the team total.
export function parseDaysOff(raw: unknown): number[] | null {
    if (!Array.isArray(raw)) return null;
    if (!raw.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) return null;
    const unique = [...new Set(raw as number[])].sort((a, b) => a - b);
    return unique.length >= 7 ? null : unique;
}

export const sameDays = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((day, i) => day === b[i]);

export interface ScheduledCapacity { dailyCapacity: number; daysOff: readonly number[] }

// Capacity the whole team has on one calendar date (people on a day off contribute nothing).
export function teamCapacityOn(isoDate: string, people: readonly ScheduledCapacity[]): number {
    return people.reduce((sum, person) => sum + (isWorkingDay(isoDate, person.daysOff) ? person.dailyCapacity : 0), 0);
}

const MAX_SIMULATED_DAYS = 365;

// How many calendar days, counting from `startDate`, it takes the team to finish `demand` plans
// at its real day-by-day capacity (days off included). Null when it never could (no capacity, or
// more than a year). Zero demand takes zero days.
export function daysToClear(demand: number, startDate: string, people: readonly ScheduledCapacity[]): number | null {
    if (demand <= 0) return 0;
    let remaining = demand;
    for (let day = 0; day < MAX_SIMULATED_DAYS; day++) {
        remaining -= teamCapacityOn(addDaysTo(startDate, day), people);
        if (remaining <= 0) return day + 1;
    }
    return null;
}

// Average plans per calendar day over a normal week, e.g. 10/day with two days off is 7.14/day.
export function averageDailyCapacity(people: readonly ScheduledCapacity[]): number {
    return people.reduce((sum, person) => sum + person.dailyCapacity * (7 - person.daysOff.length) / 7, 0);
}
