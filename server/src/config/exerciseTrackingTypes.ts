// Single source of truth for how an exercise is tracked. Mirrored verbatim in
// client/utils/exerciseTrackingTypes.js (no shared client/server package
// exists in this repo — see that file's header, and
// server/src/utils/workoutLogStats.ts / client/utils/workout.js for the same
// duplication pattern already established here). Keep the two in sync.
//
// Every exercise belongs to one of two categories, set once on the catalog
// exercise (exercise_library / master_exercise_library.tracking_type) and
// inherited by every plan/log use — it is never overridden per plan
// instance. Each category has a few "base" fields that are always tracked,
// plus a checklist of optional metrics the coach turns on per exercise
// (tracked_metrics, a string array column) — e.g. one Sets & Reps exercise
// might track tempo + rir, another just rir, another neither.
//
// A field can be *prescribed* (a training_sets column the coach sets as a
// target in the builder), *logged* (a workout_logs.exercises[].sets[] field
// a client types in while performing), or both. Weight, for example, has
// never had a prescribed counterpart (training_sets has no weight column) —
// it's logged-only. Conversely tempo/rir/rpe are prescribed targets a client
// only ever *sees* while logging (read-only), never types in themselves;
// duration/distance/incline/speed are the opposite of that — a coach sets a
// target AND a client logs what they actually did, the same field serving
// both roles (mirroring how reps/weight already work for Sets & Reps).

export type ExerciseCategory = 'sets_reps' | 'time_based';

export const EXERCISE_CATEGORIES: ExerciseCategory[] = ['sets_reps', 'time_based'];

export const DEFAULT_CATEGORY: ExerciseCategory = 'sets_reps';

export type TrackingField =
    | 'reps'
    | 'weight'
    | 'rest_seconds'
    | 'tempo'
    | 'rir'
    | 'rpe'
    | 'duration_seconds'
    | 'distance_km'
    | 'incline_percent'
    | 'speed_kmh';

interface CategoryDefinition {
    label: string;
    /** Canonical display order for every field this category can show (base + all possible selectable metrics). */
    fieldOrder: TrackingField[];
    /** Always prescribed (shown as a builder column) — not part of the coach's checklist. */
    prescribedBaseFields: TrackingField[];
    /** Always logged/editable during a session — not part of the coach's checklist. */
    loggedBaseFields: TrackingField[];
    /** The metrics a coach can individually turn on for a given exercise via tracked_metrics; always prescribed once selected. */
    selectableMetrics: TrackingField[];
    /** When true, a selected metric is also editable/loggable during a session (duration/distance/...); when false, it's a read-only target shown alongside the log (tempo/rir/rpe). */
    selectableIsLoggable: boolean;
}

export const CATEGORY_CONFIG: Record<ExerciseCategory, CategoryDefinition> = {
    sets_reps: {
        label: 'Sets & Reps',
        fieldOrder: ['reps', 'rest_seconds', 'tempo', 'rir', 'rpe'],
        prescribedBaseFields: ['reps', 'rest_seconds'],
        loggedBaseFields: ['weight', 'reps'],
        selectableMetrics: ['tempo', 'rir', 'rpe'],
        selectableIsLoggable: false,
    },
    time_based: {
        label: 'Time-Based',
        fieldOrder: ['duration_seconds', 'distance_km', 'incline_percent', 'speed_kmh', 'rest_seconds'],
        prescribedBaseFields: ['rest_seconds'],
        loggedBaseFields: [],
        selectableMetrics: ['duration_seconds', 'distance_km', 'incline_percent', 'speed_kmh'],
        selectableIsLoggable: true,
    },
};

interface TrackingFieldMeta {
    label: string;
    unit?: string;
    /** Decimal places to display; omitted for integer/free-text fields. */
    decimals?: number;
    /** 'mmss' renders the value as a duration clock instead of a plain number. */
    format?: 'mmss';
}

export const TRACKING_FIELD_META: Record<TrackingField, TrackingFieldMeta> = {
    reps: { label: 'Reps' },
    weight: { label: 'Weight', unit: 'kg' },
    rest_seconds: { label: 'Rest', unit: 's' },
    tempo: { label: 'Tempo' },
    rir: { label: 'RIR' },
    rpe: { label: 'RPE', decimals: 1 },
    duration_seconds: { label: 'Duration', format: 'mmss' },
    distance_km: { label: 'Distance', unit: 'km', decimals: 2 },
    incline_percent: { label: 'Incline', unit: '%', decimals: 1 },
    speed_kmh: { label: 'Speed', unit: 'km/h', decimals: 1 },
};

/**
 * Resolves an exercise's category, falling back to the pre-feature default.
 * Needed because training_exercises.exercise_library_id is nullable — a
 * coach can add an ad-hoc, catalog-less exercise that has no category to
 * inherit — and because rows written before this feature shipped may reach
 * here without the field populated.
 */
export function categoryOf(exercise: { tracking_type?: string | null } | null | undefined): ExerciseCategory {
    const type = exercise?.tracking_type;
    return type && (EXERCISE_CATEGORIES as string[]).includes(type) ? (type as ExerciseCategory) : DEFAULT_CATEGORY;
}

/** The coach's selected optional metrics for an exercise, validated against its category's checklist. */
export function trackedMetricsOf(exercise: { tracking_type?: string | null; tracked_metrics?: string[] | null } | null | undefined): TrackingField[] {
    const category = categoryOf(exercise);
    const selectable = CATEGORY_CONFIG[category].selectableMetrics;
    const raw = exercise?.tracked_metrics ?? [];
    return selectable.filter((field) => raw.includes(field));
}

/** Builder columns for an exercise: base prescribed fields + its selected metrics (all metrics are prescribed once chosen), in canonical order. Never includes weight. */
export function prescribedFieldsFor(exercise: { tracking_type?: string | null; tracked_metrics?: string[] | null } | null | undefined): TrackingField[] {
    const category = categoryOf(exercise);
    const cfg = CATEGORY_CONFIG[category];
    const selected = trackedMetricsOf(exercise);
    return cfg.fieldOrder.filter((field) => cfg.prescribedBaseFields.includes(field) || selected.includes(field));
}

/** Editable/loggable columns during a session: base logged fields + selected metrics that are loggable for this category (time_based's, not sets_reps' tempo/rir/rpe). */
export function loggedFieldsFor(exercise: { tracking_type?: string | null; tracked_metrics?: string[] | null } | null | undefined): TrackingField[] {
    const category = categoryOf(exercise);
    const cfg = CATEGORY_CONFIG[category];
    const selected = cfg.selectableIsLoggable ? trackedMetricsOf(exercise) : [];
    return cfg.fieldOrder.filter((field) => cfg.loggedBaseFields.includes(field) || selected.includes(field));
}

/** Prescribed fields shown as a read-only target during logging (in prescribedFieldsFor but not editable) — e.g. tempo/rir/rpe. */
export function targetOnlyFieldsFor(exercise: { tracking_type?: string | null; tracked_metrics?: string[] | null } | null | undefined): TrackingField[] {
    const logged = loggedFieldsFor(exercise);
    return prescribedFieldsFor(exercise).filter((field) => !logged.includes(field));
}
