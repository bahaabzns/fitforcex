import {
    estimatedOneRepMax,
    matchesExercise,
    summarizeLog,
    buildExerciseProgress,
    extractPreviousSets,
    distinctLoggedExercises,
    type WorkoutLogRow,
} from '../../src/utils/workoutLogStats';

function set(order: number, weight: number | null, reps: number | null, completed = true) {
    return { set_order: order, weight, reps, rir: null, rpe: null, rest_seconds: null, completed };
}

// A completed duration-tracked set (e.g. a plank hold) has no weight/reps at
// all — see exerciseTrackingTypes.ts. completedSets() must still count it.
function durationSet(order: number, durationSeconds: number | null, completed = true) {
    return { set_order: order, weight: null, reps: null, rir: null, rpe: null, rest_seconds: null, duration_seconds: durationSeconds, completed };
}

const benchLog: WorkoutLogRow = {
    id:         'log1',
    date:       '2026-06-01',
    start_time: '2026-06-01T10:00:00.000Z',
    end_time:   '2026-06-01T10:45:00.000Z',
    exercises: [
        { exercise_id: 'a', exercise_library_id: 'lib1', name: 'Bench Press', note: null, sets: [set(1, 60, 10), set(2, 60, 8), set(3, 60, 8, false)] },
        { exercise_id: 'b', exercise_library_id: 'lib2', name: 'Squat', note: null, sets: [set(1, 100, 5)] },
    ],
};

describe('estimatedOneRepMax', () => {
    test('uses the Epley formula rounded to one decimal', () => {
        expect(estimatedOneRepMax(60, 10)).toBe(80);       // 60 * (1 + 10/30)
        expect(estimatedOneRepMax(65, 8)).toBe(82.3);      // 65 * 1.2666…
    });
    test('returns 0 when not computable', () => {
        expect(estimatedOneRepMax(null, 10)).toBe(0);
        expect(estimatedOneRepMax(60, 0)).toBe(0);
        expect(estimatedOneRepMax(60, null)).toBe(0);
    });
});

describe('matchesExercise', () => {
    test('matches on library id first', () => {
        expect(matchesExercise({ exercise_library_id: 'x', exercise_id: '1' }, { exercise_library_id: 'x', exercise_id: '2' })).toBe(true);
    });
    test('falls back to exercise id, then name', () => {
        expect(matchesExercise({ exercise_id: '1' }, { exercise_id: '1' })).toBe(true);
        expect(matchesExercise({ name: 'Bench Press' }, { name: 'bench press' })).toBe(true);
        expect(matchesExercise({ name: 'Bench' }, { name: 'Squat' })).toBe(false);
    });
});

describe('summarizeLog', () => {
    test('sums volume over completed sets only and computes duration', () => {
        const summary = summarizeLog(benchLog);
        expect(summary.total_volume).toBe(1580);   // 600 + 480 + 500
        expect(summary.total_sets).toBe(3);          // incomplete set excluded
        expect(summary.exercise_count).toBe(2);
        expect(summary.duration_seconds).toBe(2700); // 45 minutes
    });
    test('duration is null when timestamps are missing', () => {
        expect(summarizeLog({ ...benchLog, end_time: null }).duration_seconds).toBeNull();
    });

    // Regression test: completedSets() used to require weight AND reps to be
    // non-null before a set counted as "completed" at all, which silently
    // dropped duration/cardio-tracked sets (weight/reps are always null for
    // those) from total_sets, volume, and every other stat. A completed set
    // must count toward total_sets/exercise_count regardless of its tracking
    // type — only the weight×reps volume math is skipped when either is null.
    test('counts a completed duration-tracked set (no weight/reps) toward total_sets, without crashing on volume', () => {
        const plankLog: WorkoutLogRow = {
            id: 'log3', date: '2026-06-15', start_time: null, end_time: null,
            exercises: [
                { exercise_id: 'p', exercise_library_id: 'lib3', name: 'Plank', note: null, sets: [durationSet(1, 45), durationSet(2, 45), durationSet(3, 30, false)] },
            ],
        };
        const summary = summarizeLog(plankLog);
        expect(summary.total_sets).toBe(2);      // 2 completed, 1 not — same "completed only" rule as weight-based sets
        expect(summary.total_volume).toBe(0);    // no weight/reps to compute volume from
        expect(summary.exercise_count).toBe(1);
    });

    test('mixed session: weight-based volume is unaffected by a duration-tracked exercise alongside it', () => {
        const mixedLog: WorkoutLogRow = {
            ...benchLog,
            exercises: [
                ...benchLog.exercises,
                { exercise_id: 'p', exercise_library_id: 'lib3', name: 'Plank', note: null, sets: [durationSet(1, 45)] },
            ],
        };
        const summary = summarizeLog(mixedLog);
        expect(summary.total_volume).toBe(1580); // unchanged from the weight-only benchLog case
        expect(summary.total_sets).toBe(4);      // 3 weight-based + 1 duration-based completed set
        expect(summary.exercise_count).toBe(3);
    });
});

describe('buildExerciseProgress', () => {
    test('returns one ascending point per session that includes the exercise', () => {
        const later: WorkoutLogRow = {
            id: 'log2', date: '2026-06-08', start_time: null, end_time: null,
            exercises: [{ exercise_id: 'c', exercise_library_id: 'lib1', name: 'Bench Press', note: null, sets: [set(1, 65, 8), set(2, 65, 6)] }],
        };
        const series = buildExerciseProgress([later, benchLog], { exercise_library_id: 'lib1' });
        expect(series).toHaveLength(2);
        expect(series[0].date).toBe('2026-06-01');
        expect(series[0].top_weight).toBe(60);
        expect(series[0].total_volume).toBe(1080);
        expect(series[1].date).toBe('2026-06-08');
        expect(series[1].top_weight).toBe(65);
        expect(series[1].est_1rm).toBe(82.3);
    });
    test('skips sessions without the exercise', () => {
        expect(buildExerciseProgress([benchLog], { exercise_library_id: 'missing' })).toHaveLength(0);
    });
    test('skips a session where the only completed sets are duration-tracked (no weight/reps to chart)', () => {
        const plankOnly: WorkoutLogRow = {
            id: 'log4', date: '2026-06-20', start_time: null, end_time: null,
            exercises: [{ exercise_id: 'p', exercise_library_id: 'lib3', name: 'Plank', note: null, sets: [durationSet(1, 45)] }],
        };
        expect(buildExerciseProgress([plankOnly], { exercise_library_id: 'lib3' })).toHaveLength(0);
    });
});

describe('extractPreviousSets', () => {
    test('returns the most recent prior sets keyed by current exercise id', () => {
        const previous = extractPreviousSets([benchLog], [{ exercise_id: 'current', exercise_library_id: 'lib1', name: 'Bench Press' }]);
        expect(previous.current).toHaveLength(3);
        expect(previous.current[0]).toEqual({ set_order: 1, weight: 60, reps: 10, rir: null, rpe: null });
    });
    test('omits exercises with no prior log', () => {
        const previous = extractPreviousSets([benchLog], [{ exercise_id: 'current', exercise_library_id: 'never', name: 'Deadlift' }]);
        expect(previous.current).toBeUndefined();
    });
});

describe('distinctLoggedExercises', () => {
    test('dedupes by library id, newest session first', () => {
        const older: WorkoutLogRow = {
            id: 'log0', date: '2026-05-01', start_time: null, end_time: null,
            exercises: [{ exercise_id: 'z', exercise_library_id: 'lib1', name: 'Bench Press', note: null, sets: [set(1, 50, 10)] }],
        };
        const result = distinctLoggedExercises([benchLog, older]);
        expect(result.map(e => e.exercise_library_id)).toEqual(['lib1', 'lib2']);
    });
});
