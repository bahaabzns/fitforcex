// "vs last week" changes for the KPI cards, from the last 14 daily points
// ({ waiting, capacity, fullPct } per day, oldest first). Pure, so it can be tested without a browser.

const WEEK = 7;

export function percentChange(now, before) {
    if (before === null || before === undefined || before === 0 || now === null || now === undefined) return null;
    return ((now - before) / Math.abs(before)) * 100;
}

const direction = (value) => (value > 0 ? "up" : value < 0 ? "down" : "flat");
const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

// Plans waiting now against the same number a week ago.
export function waitingDelta(points) {
    if (points.length <= WEEK) return null;
    const change = percentChange(points.at(-1).waiting, points.at(-1 - WEEK).waiting);
    return change === null ? null : { unit: "percent", value: change, direction: direction(Math.round(change)) };
}

// Average daily capacity over the last 7 days against the 7 days before them (so days off average out).
export function capacityDelta(points) {
    if (points.length < WEEK * 2) return null;
    const last = average(points.slice(-WEEK).map((p) => p.capacity));
    const before = average(points.slice(-WEEK * 2, -WEEK).map((p) => p.capacity));
    const change = percentChange(last, before);
    return change === null ? null : { unit: "percent", value: change, direction: direction(Math.round(change)) };
}

// Plans finished in the last 7 days against the 7 days before them.
export function finishedDelta(points) {
    if (points.length < WEEK * 2) return null;
    const total = (slice) => slice.reduce((sum, p) => sum + p.finished, 0);
    const change = percentChange(total(points.slice(-WEEK)), total(points.slice(-WEEK * 2, -WEEK)));
    return change === null ? null : { unit: "percent", value: change, direction: direction(Math.round(change)) };
}

// How full the team is, now against a week ago: a difference in percentage points, not a percent of a percent.
export function fullnessDelta(points) {
    if (points.length <= WEEK) return null;
    const now = points.at(-1).fullPct;
    const before = points.at(-1 - WEEK).fullPct;
    if (now === null || before === null) return null;
    const diff = now - before;
    return { unit: "points", value: diff, direction: direction(Math.round(diff)) };
}

// Is this change good news? For waiting plans and how full the team is, going down is good; for
// capacity, going up is good. "flat" is neutral.
export function deltaTone(delta, goodDirection) {
    if (!delta || delta.direction === "flat") return "neutral";
    return delta.direction === goodDirection ? "good" : "bad";
}
