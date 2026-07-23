// Client-side workout math, mirroring server/src/utils/workoutLogStats.ts so the
// UI can compute live totals (e.g. while logging) without a round-trip.

/** Epley estimated 1RM, rounded to one decimal. Returns 0 when not computable. */
export function estimatedOneRepMax(weight, reps) {
    if (weight == null || reps == null || reps <= 0) return 0;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Sum of weight × reps over completed sets of a list of logged exercises. */
export function totalVolume(exercises) {
    let volume = 0;
    for (const exercise of exercises ?? []) {
        for (const set of exercise.sets ?? []) {
            if (set.completed && set.weight != null && set.reps != null) {
                volume += set.weight * set.reps;
            }
        }
    }
    return Math.round(volume * 10) / 10;
}

/** Count of completed sets across a list of logged exercises. */
export function completedSetCount(exercises) {
    let count = 0;
    for (const exercise of exercises ?? []) {
        for (const set of exercise.sets ?? []) {
            if (set.completed) count += 1;
        }
    }
    return count;
}

/** Seconds → compact human string: "1h 05m", "45m 12s", "0:42". Returns "—" for null. */
export function formatDuration(seconds) {
    if (seconds == null || Number.isNaN(seconds)) return "—";
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const mins  = Math.floor((total % 3600) / 60);
    const secs  = total % 60;

    if (hours > 0) return `${hours}h ${String(mins).padStart(2, "0")}m`;
    if (mins > 0)  return `${mins}m ${String(secs).padStart(2, "0")}s`;
    return `${secs}s`;
}

/** MM:SS countdown formatting for the rest timer. */
export function formatClock(seconds) {
    const total = Math.max(0, Math.round(seconds ?? 0));
    const mins  = Math.floor(total / 60);
    const secs  = total % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

// The training builder seeds a new set's tempo with "-" as a placeholder
// (see handleAddExercise/handleAddMultipleExercises in useTrainingPlan.js) —
// it reads as "not filled in" the same as null/"", so treat all three as
// blank when deciding whether a coach actually entered a tempo.
export function hasTempoValue(tempo) {
    const trimmed = tempo?.trim();
    return Boolean(trimmed) && trimmed !== "-";
}

/** RIR (Int?) has no placeholder sentinel like tempo — null is the only "not set" state. */
export function hasRirValue(rir) {
    return rir != null;
}
