// Turns the Operations summary into the plain-language guidance shown at the top of the
// Team Workload tab. Pure (no React, no i18n): it returns message KEYS plus parameters, and
// the component translates them, so the same logic serves English and Arabic.

// Starting number offered when a coach has not set anyone's daily limit yet.
export const SUGGESTED_DAILY_CAPACITY = 5;

function peopleWithLoad(summary) {
    return [
        ...summary.trainers.map((row) => ({ userId: row.userId, name: row.name, load: row.load.total })),
        ...summary.notConfigured.map((row) => ({ userId: row.userId, name: row.name, load: row.load.total })),
    ];
}

// The counted person with the most spare room, and how many waiting plans they could take.
// Room is measured over the selected window using what each person can really finish in it
// (their days off already taken out by the server).
export function findMostRoom(summary) {
    let best = null;
    for (const row of summary.trainers) {
        if (row.capacity.inHorizon === null || row.capacity.inHorizon === undefined) continue;
        const room = row.capacity.inHorizon - row.load.total;
        if (room > 0 && (!best || room > best.room)) best = { userId: row.userId, name: row.name, room };
    }
    if (!best) return null;
    return { ...best, canTake: Math.min(best.room, summary.unassigned.load.total) };
}

export function describeWorkload(summary) {
    const waiting = summary.demand.total;
    // "A day" here is an average calendar day: days off are spread across the week by the server.
    const averagePerDay = summary.capacity.averagePerDay;
    const hasCapacity = summary.capacity.countedTrainers > 0 && averagePerDay > 0;
    const daysToClear = summary.utilization.daysToClear;

    let headline;
    if (waiting === 0) {
        headline = { key: "summaryNothingWaiting", values: {} };
    } else if (!hasCapacity || daysToClear === null || daysToClear === undefined) {
        headline = { key: "summaryNoCapacity", values: { waiting } };
    } else {
        headline = {
            key: "summaryNormal",
            values: { waiting, capacity: Math.max(1, Math.round(averagePerDay)), days: Math.max(1, daysToClear) },
        };
    }

    const busiest = peopleWithLoad(summary).filter((p) => p.load > 0).sort((a, b) => b.load - a.load)[0] ?? null;
    const showBusiest = !!busiest && waiting > 0 && summary.trainers.length + summary.notConfigured.length > 1;

    // Ordered by how much the coach should care: the first hint is the main thing to do.
    const mostRoom = findMostRoom(summary);
    const hints = [];
    const status = summary.utilization.status;
    const unassigned = summary.demand.unassigned;

    const goal = { days: summary.utilization.targetDays };
    if (status === "overloaded") hints.push({ key: "hintOverloaded", values: goal, action: "openQueue" });
    else if (status === "tight") hints.push({ key: "hintTight", values: goal });
    else if (status === "healthy") hints.push({ key: "hintHealthy", values: goal });

    if (unassigned > 0) {
        if (mostRoom && mostRoom.canTake > 0) {
            hints.push({ key: "hintUnassigned", values: { count: unassigned }, action: "assign", assign: mostRoom });
        } else {
            hints.push({ key: "hintUnassigned", values: { count: unassigned }, action: "openUnassigned" });
        }
    }
    if (summary.notConfigured.length > 0 && hasCapacity) {
        hints.push({ key: "hintSetLimits", values: { count: summary.notConfigured.length } });
    }

    return { headline, busiest: showBusiest ? busiest : null, hints, mostRoom };
}
