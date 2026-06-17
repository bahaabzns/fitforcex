// Pure helpers for computing stats over logged workout sessions.
// The per-set detail lives in workout_logs.exercises (JSON snapshot); these
// functions operate on that parsed shape and are shared by the client-portal
// and coach (clients) modules. No external dependencies — keep it pure.

export interface LoggedSet {
    set_order:    number;
    weight:       number | null;
    reps:         number | null;
    rir:          number | null;
    rest_seconds: number | null;
    completed:    boolean;
}

export interface LoggedExercise {
    exercise_id:         string;
    exercise_library_id: string | null;
    name:                string;
    note:                string | null;
    sets:                LoggedSet[];
}

export interface WorkoutLogRow {
    id:         string;
    date:       string | Date;
    start_time: string | null;
    end_time:   string | null;
    exercises:  LoggedExercise[];
}

export interface LogSummary {
    duration_seconds: number | null;
    total_volume:     number;
    total_sets:       number;
    exercise_count:   number;
}

export interface ProgressPoint {
    date:         string;
    top_weight:   number;
    est_1rm:      number;
    total_volume: number;
    total_reps:   number;
}

export interface PreviousSet {
    set_order: number;
    weight:    number | null;
    reps:      number | null;
    rir:       number | null;
}

/** A canonical key to identify "the same exercise" across plans/sessions. */
export interface ExerciseKey {
    exercise_id?:         string | null;
    exercise_library_id?: string | null;
    name?:                string | null;
}

export interface LoggedExerciseRef {
    exercise_id:         string;
    exercise_library_id: string | null;
    name:                string;
}

/** Epley estimated 1RM, rounded to one decimal. Returns 0 when not computable. */
export function estimatedOneRepMax(weight: number | null, reps: number | null): number {
    if (weight == null || reps == null || reps <= 0) return 0;
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** True when two exercises should be treated as the same one for history/progress. */
export function matchesExercise(a: ExerciseKey, b: ExerciseKey): boolean {
    if (a.exercise_library_id && b.exercise_library_id) {
        return a.exercise_library_id === b.exercise_library_id;
    }
    if (a.exercise_id && b.exercise_id && a.exercise_id === b.exercise_id) return true;
    if (a.name && b.name) return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
    return false;
}

function completedSets(exercise: LoggedExercise): LoggedSet[] {
    return (exercise.sets ?? []).filter(s => s.completed && s.weight != null && s.reps != null);
}

/** Roll a single logged session up into headline numbers for list views. */
export function summarizeLog(log: WorkoutLogRow): LogSummary {
    const exercises = log.exercises ?? [];
    let totalVolume = 0;
    let totalSets   = 0;

    for (const exercise of exercises) {
        for (const set of completedSets(exercise)) {
            totalVolume += (set.weight as number) * (set.reps as number);
            totalSets   += 1;
        }
    }

    let durationSeconds: number | null = null;
    if (log.start_time && log.end_time) {
        const start = new Date(log.start_time).getTime();
        const end   = new Date(log.end_time).getTime();
        if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
            durationSeconds = Math.round((end - start) / 1000);
        }
    }

    return {
        duration_seconds: durationSeconds,
        total_volume:     Math.round(totalVolume * 10) / 10,
        total_sets:       totalSets,
        exercise_count:   exercises.length,
    };
}

function toDateString(value: string | Date): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/**
 * Time series for one exercise across many sessions, ascending by date.
 * One point per session in which the exercise was performed with completed sets.
 */
export function buildExerciseProgress(logs: WorkoutLogRow[], key: ExerciseKey): ProgressPoint[] {
    const points: ProgressPoint[] = [];

    const ordered = [...logs].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const log of ordered) {
        const exercise = (log.exercises ?? []).find(e => matchesExercise(e, key));
        if (!exercise) continue;

        const sets = completedSets(exercise);
        if (sets.length === 0) continue;

        let topWeight   = 0;
        let estimated1rm = 0;
        let totalVolume = 0;
        let totalReps   = 0;

        for (const set of sets) {
            const weight = set.weight as number;
            const reps   = set.reps as number;
            topWeight    = Math.max(topWeight, weight);
            estimated1rm = Math.max(estimated1rm, estimatedOneRepMax(weight, reps));
            totalVolume += weight * reps;
            totalReps   += reps;
        }

        points.push({
            date:         toDateString(log.date),
            top_weight:   topWeight,
            est_1rm:      estimated1rm,
            total_volume: Math.round(totalVolume * 10) / 10,
            total_reps:   totalReps,
        });
    }

    return points;
}

/**
 * Distinct exercises a client has logged across all sessions (newest name wins),
 * for populating a progress picker. Ordered most-recently-trained first.
 */
export function distinctLoggedExercises(logs: WorkoutLogRow[]): LoggedExerciseRef[] {
    const newestFirst = [...logs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const byKey = new Map<string, LoggedExerciseRef>();
    for (const log of newestFirst) {
        for (const exercise of log.exercises ?? []) {
            const key = exercise.exercise_library_id || exercise.name?.trim().toLowerCase();
            if (!key || byKey.has(key)) continue;
            byKey.set(key, {
                exercise_id:         exercise.exercise_id,
                exercise_library_id: exercise.exercise_library_id,
                name:                exercise.name,
            });
        }
    }
    return Array.from(byKey.values());
}

/**
 * For each exercise the client is about to train, the sets they logged the most
 * recent time they trained it — so the UI can show a "previous" column.
 * Keyed by the *current* exercise_id.
 */
export function extractPreviousSets(
    priorLogs: WorkoutLogRow[],
    exercises: ExerciseKey[]
): Record<string, PreviousSet[]> {
    const newestFirst = [...priorLogs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const previous: Record<string, PreviousSet[]> = {};

    for (const target of exercises) {
        if (!target.exercise_id) continue;
        for (const log of newestFirst) {
            const match = (log.exercises ?? []).find(e => matchesExercise(e, target));
            if (!match) continue;
            previous[target.exercise_id] = (match.sets ?? []).map(s => ({
                set_order: s.set_order,
                weight:    s.weight,
                reps:      s.reps,
                rir:       s.rir,
            }));
            break;
        }
    }

    return previous;
}
