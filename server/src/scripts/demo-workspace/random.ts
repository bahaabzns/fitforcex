// Deterministic randomness + date helpers shared by the demo-workspace seed, so a re-run
// reproduces the same shape of data instead of a new random mix every time.

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
export const MINUTE = 60_000;

function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SEED = 20261019;
export const rand = mulberry32(SEED);

export const randInt = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
export const randFloat = (min: number, max: number, decimals = 1) => Number((min + rand() * (max - min)).toFixed(decimals));
export const chance = (probability: number) => rand() < probability;
export const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];

export function pickWeighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rand() * total;
    for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
    }
    return entries[entries.length - 1][0];
}

export function pickMany<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    while (out.length < count && pool.length > 0) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
}

/** Midpoint-biased value in [min, max] — a cheap bell curve for heights, weights, etc. */
export function bell(min: number, max: number): number {
    return min + ((rand() + rand() + rand()) / 3) * (max - min);
}

export const NOW = new Date();

/** Calendar date (UTC midnight) `daysAgo` days before today — for `@db.Date` columns. */
export function dateOnly(daysAgo: number): Date {
    return new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() - daysAgo));
}

export const daysAgo = (days: number, extraHours = 0) => new Date(NOW.getTime() - days * DAY - extraHours * HOUR);
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);
export const clampToNow = (date: Date) => (date.getTime() > NOW.getTime() ? new Date(NOW.getTime() - randInt(1, 30) * MINUTE) : date);

/** A working-hours timestamp on the same calendar day as `date`. */
export function withDaytime(date: Date, fromHour = 8, toHour = 22): Date {
    const copy = new Date(date);
    copy.setUTCHours(randInt(fromHour, toHour), randInt(0, 59), randInt(0, 59), 0);
    return copy;
}

export function chunk<T>(rows: readonly T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
    return out;
}

export const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));
