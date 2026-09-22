// Single source of truth for how an exercise is tracked, mirroring
// server/src/config/exerciseTrackingTypes.ts (no shared client/server
// package exists in this repo — see client/utils/workout.js's header for the
// same duplication-with-comment pattern already established here). Keep the
// two in sync.
//
// Every exercise belongs to one of two categories, set once on the catalog
// exercise (exercise_library.tracking_type) and inherited by every plan/log
// use — it is never overridden per plan instance. Each category has a few
// "base" fields that are always tracked, plus a checklist of optional
// metrics the coach turns on per exercise (tracked_metrics, a string array
// column) — e.g. one Sets & Reps exercise might track tempo + rir, another
// just rir, another neither.
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

export const EXERCISE_CATEGORIES = ["sets_reps", "time_based"];

export const DEFAULT_CATEGORY = "sets_reps";

export const CATEGORY_CONFIG = {
    sets_reps: {
        label: "Sets & Reps",
        fieldOrder: ["reps", "rest_seconds", "tempo", "rir", "rpe"],
        prescribedBaseFields: ["reps", "rest_seconds"],
        loggedBaseFields: ["weight", "reps"],
        selectableMetrics: ["tempo", "rir", "rpe"],
        selectableIsLoggable: false,
    },
    time_based: {
        label: "Time-Based",
        fieldOrder: ["duration_seconds", "distance_km", "incline_percent", "speed_kmh", "rest_seconds"],
        prescribedBaseFields: ["rest_seconds"],
        loggedBaseFields: [],
        selectableMetrics: ["duration_seconds", "distance_km", "incline_percent", "speed_kmh"],
        selectableIsLoggable: true,
    },
};

export const TRACKING_FIELD_META = {
    reps: { label: "Reps" },
    weight: { label: "Weight", unit: "kg" },
    rest_seconds: { label: "Rest", unit: "s" },
    tempo: { label: "Tempo" },
    rir: { label: "RIR" },
    rpe: { label: "RPE", decimals: 1 },
    duration_seconds: { label: "Duration", format: "mmss" },
    distance_km: { label: "Distance", unit: "km", decimals: 2 },
    incline_percent: { label: "Incline", unit: "%", decimals: 1 },
    speed_kmh: { label: "Speed", unit: "km/h", decimals: 1 },
};

/**
 * Resolves an exercise's category, falling back to the pre-feature default.
 * Needed because a coach can add an ad-hoc, catalog-less exercise (no
 * exercise_library_id) that has no category to inherit, and because rows
 * written before this feature shipped may reach here without the field
 * populated.
 */
export function categoryOf(exercise) {
    const type = exercise?.tracking_type;
    return type && EXERCISE_CATEGORIES.includes(type) ? type : DEFAULT_CATEGORY;
}

/** The coach's selected optional metrics for an exercise, validated against its category's checklist. */
export function trackedMetricsOf(exercise) {
    const category = categoryOf(exercise);
    const selectable = CATEGORY_CONFIG[category].selectableMetrics;
    const raw = exercise?.tracked_metrics ?? [];
    return selectable.filter((field) => raw.includes(field));
}

/** Builder columns for an exercise: base prescribed fields + its selected metrics (all metrics are prescribed once chosen), in canonical order. Never includes weight. */
export function prescribedFieldsFor(exercise) {
    const category = categoryOf(exercise);
    const cfg = CATEGORY_CONFIG[category];
    const selected = trackedMetricsOf(exercise);
    return cfg.fieldOrder.filter((field) => cfg.prescribedBaseFields.includes(field) || selected.includes(field));
}

/** Editable/loggable columns during a session: base logged fields + selected metrics that are loggable for this category (time_based's, not sets_reps' tempo/rir/rpe). */
export function loggedFieldsFor(exercise) {
    const category = categoryOf(exercise);
    const cfg = CATEGORY_CONFIG[category];
    // loggedBaseFields can include fields (weight) that aren't in fieldOrder
    // at all — fieldOrder is the *prescribed* canonical order, and weight has
    // no prescribed counterpart. Only the selectable-metric portion needs
    // fieldOrder to preserve display order; the base fields are used as-is.
    const orderedSelected = cfg.selectableIsLoggable
        ? cfg.fieldOrder.filter((field) => trackedMetricsOf(exercise).includes(field))
        : [];
    return [...cfg.loggedBaseFields, ...orderedSelected];
}

/** Prescribed fields shown as a read-only target during logging (in prescribedFieldsFor but not editable) — e.g. tempo/rir/rpe. */
export function targetOnlyFieldsFor(exercise) {
    const logged = loggedFieldsFor(exercise);
    return prescribedFieldsFor(exercise).filter((field) => !logged.includes(field));
}
