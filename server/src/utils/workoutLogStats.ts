// Pure helpers for computing stats over logged workout sessions.
// The per-set detail lives in workout_logs.exercises (JSON snapshot); these
// functions operate on that parsed shape and are shared by the client-portal
// and coach (clients) modules. No external dependencies — keep it pure.

export interface LoggedSet {
    set_order:        number;
    weight:           number | null;
    reps:             number | null;
    rir:              number | null;
    rpe:              number | null;
    rest_seconds:     number | null;
    duration_seconds: number | null;
    distance_km:      number | null;
    incline_percent:  number | null;
    speed_kmh:        number | null;
    completed:        boolean;
}

export interface LoggedExercise {
    exercise_id:         string;
    exercise_library_id: string | null;
    name:                string;
    note:                string | null;
    // Snapshotted at submission time (see loggedExerciseSchema in
    // clientPortal.controller.ts) rather than re-derived from the catalog
    // exercise later, since a coach can change tracking_type/tracked_metrics
    // after the fact.
    tracking_type?:      string | null;
    tracked_metrics?:    string[] | null;
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
    set_order:        number;
    weight:           number | null;
    reps:             number | null;
    rir:              number | null;
    rpe:              number | null;
    duration_seconds: number | null;
    distance_km:      number | null;
    incline_percent:  number | null;
    speed_kmh:        number | null;
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

// ─── Coach insights ──────────────────────────────────────────────────────────

export interface PersonalRecords {
    heaviest_weight: { value: number; date: string } | null;
    best_set:        { weight: number; reps: number; rir: number | null; date: string } | null;
    highest_volume:  { value: number; date: string } | null;
    est_1rm:         { value: number; date: string } | null;
}

export interface CoachInsights {
    strength_change_pct:       number | null;
    strength_change_weeks:     number;
    total_sessions:            number;
    is_plateau:                boolean;
    plateau_sessions_checked:  number;
    consistency_pct:           number | null;
}

export interface RecentSession {
    date:     string;
    best_set: { weight: number; reps: number; rir: number | null } | null;
    note:     string | null;
}

/**
 * All-time personal records for one exercise derived from workout logs.
 * heaviest_weight / est_1rm / highest_volume come from progressPoints (already
 * aggregated per session); best_set (max single-set volume) requires raw logs.
 */
export function computePersonalRecords(
    logs: WorkoutLogRow[],
    key: ExerciseKey,
    progressPoints: ProgressPoint[],
): PersonalRecords {
    if (progressPoints.length === 0) {
        return { heaviest_weight: null, best_set: null, highest_volume: null, est_1rm: null };
    }

    let hwPoint  = progressPoints[0];
    let ermPoint = progressPoints[0];
    let volPoint = progressPoints[0];
    for (const p of progressPoints) {
        if (p.top_weight   > hwPoint.top_weight)   hwPoint  = p;
        if (p.est_1rm      > ermPoint.est_1rm)      ermPoint = p;
        if (p.total_volume > volPoint.total_volume) volPoint = p;
    }

    let bestSet: { weight: number; reps: number; rir: number | null; date: string } | null = null;
    for (const log of logs) {
        const exercise = (log.exercises ?? []).find(e => matchesExercise(e, key));
        if (!exercise) continue;
        for (const set of completedSets(exercise)) {
            const vol = (set.weight as number) * (set.reps as number);
            if (!bestSet || vol > bestSet.weight * bestSet.reps) {
                bestSet = { weight: set.weight as number, reps: set.reps as number, rir: set.rir, date: toDateString(log.date) };
            }
        }
    }

    return {
        heaviest_weight: { value: hwPoint.top_weight,   date: hwPoint.date },
        est_1rm:         { value: ermPoint.est_1rm,      date: ermPoint.date },
        highest_volume:  { value: volPoint.total_volume, date: volPoint.date },
        best_set:        bestSet,
    };
}

/**
 * Aggregated coaching signals: strength trend, plateau detection, consistency.
 * Compares the most recent 4-week window against the prior 4-week window for trend.
 * Consistency = % of the last 8 calendar weeks in which the exercise appeared at least once.
 */
export function computeCoachInsights(progressPoints: ProgressPoint[]): CoachInsights {
    const total        = progressPoints.length;
    const now          = Date.now();
    const MS_PER_WEEK  = 7 * 24 * 60 * 60 * 1000;

    const recentCutoff = new Date(now - 4 * MS_PER_WEEK);
    const olderCutoff  = new Date(now - 8 * MS_PER_WEEK);
    const recent = progressPoints.filter(p => new Date(p.date) >= recentCutoff);
    const older  = progressPoints.filter(p => new Date(p.date) >= olderCutoff && new Date(p.date) < recentCutoff);

    let strengthChangePct: number | null = null;
    if (recent.length >= 1 && older.length >= 1) {
        const recentAvg = recent.reduce((s, p) => s + p.est_1rm, 0) / recent.length;
        const olderAvg  = older.reduce((s,  p) => s + p.est_1rm, 0) / older.length;
        if (olderAvg > 0) strengthChangePct = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
    }

    const PLATEAU_N = 4;
    let isPlateauDetected = false;
    if (progressPoints.length >= PLATEAU_N) {
        const last   = progressPoints.slice(-PLATEAU_N).map(p => p.est_1rm).filter(v => v > 0);
        const maxVal = Math.max(...last);
        const minVal = Math.min(...last);
        isPlateauDetected = last.length === PLATEAU_N && maxVal > 0 && (maxVal - minVal) / maxVal < 0.03;
    }

    const CONSISTENCY_WEEKS = 8;
    const weeksWithSession = Array.from({ length: CONSISTENCY_WEEKS }, (_, i) => {
        const weekEnd   = new Date(now - i * MS_PER_WEEK);
        const weekStart = new Date(now - (i + 1) * MS_PER_WEEK);
        return progressPoints.some(p => { const d = new Date(p.date); return d >= weekStart && d < weekEnd; });
    }).filter(Boolean).length;

    return {
        strength_change_pct:      strengthChangePct,
        strength_change_weeks:    8,
        total_sessions:           total,
        is_plateau:               isPlateauDetected,
        plateau_sessions_checked: PLATEAU_N,
        consistency_pct:          total > 0 ? Math.round((weeksWithSession / CONSISTENCY_WEEKS) * 100) : null,
    };
}

/** Last N sessions in which the exercise appeared, newest first, with the best set per session. */
export function extractRecentSessions(logs: WorkoutLogRow[], key: ExerciseKey, limit = 10): RecentSession[] {
    const sorted = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const sessions: RecentSession[] = [];
    for (const log of sorted) {
        const exercise = (log.exercises ?? []).find(e => matchesExercise(e, key));
        if (!exercise) continue;
        const sets = completedSets(exercise);
        let bestSet: { weight: number; reps: number; rir: number | null } | null = null;
        for (const set of sets) {
            const vol = (set.weight as number) * (set.reps as number);
            if (!bestSet || vol > bestSet.weight * bestSet.reps) {
                bestSet = { weight: set.weight as number, reps: set.reps as number, rir: set.rir };
            }
        }
        sessions.push({ date: toDateString(log.date), best_set: bestSet, note: exercise.note ?? null });
        if (sessions.length >= limit) break;
    }
    return sessions;
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
                set_order:        s.set_order,
                weight:           s.weight,
                reps:             s.reps,
                rir:              s.rir,
                rpe:              s.rpe,
                duration_seconds: s.duration_seconds,
                distance_km:      s.distance_km,
                incline_percent:  s.incline_percent,
                speed_kmh:        s.speed_kmh,
            }));
            break;
        }
    }

    return previous;
}
