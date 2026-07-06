// The database relation is named `package_variations`, but the API contract (request
// bodies and the client) uses `variations`. These helpers re-shape package rows at the
// response boundary so the relation is always exposed as `variations`. Each variation's
// `package_default_forms` relation (Package Lifecycle Phase 1) is likewise reshaped to
// `defaultForms`, with the joined form's titles flattened onto each entry.

type RawDefaultForm = {
    form_id: string;
    kind: string;
    interval_days: number | null;
    sort_order: number;
    forms?: { id: string; title_en: string; title_ar: string | null } | null;
};

function serializeDefaultForm(f: RawDefaultForm) {
    return {
        formId: f.form_id,
        kind: f.kind,
        intervalDays: f.interval_days,
        sortOrder: f.sort_order,
        titleEn: f.forms?.title_en ?? null,
        titleAr: f.forms?.title_ar ?? null,
    };
}

type RawVariation = {
    package_default_forms?: RawDefaultForm[];
    nutrition_cycle_days?: number | null;
    training_cycle_days?: number | null;
    review_offset_days?: number | null;
    plan_update_mode?: string;
};

/**
 * Reshapes one variation row. The three new *_cycle_days/offset fields are
 * exposed in camelCase (nutritionCycleDays, etc.) rather than left as
 * snake_case passthrough, because the frontend round-trips an unmodified
 * sibling variation straight from a GET response back into the next PUT
 * request body when only one variation in the array actually changed —
 * casing must match on both sides or these defaults would silently reset
 * to null on every unrelated sibling edit.
 */
function serializeVariation<V extends RawVariation>(v: V) {
    const { package_default_forms, nutrition_cycle_days, training_cycle_days, review_offset_days, plan_update_mode, ...rest } = v;
    return {
        ...rest,
        nutritionCycleDays: nutrition_cycle_days ?? null,
        trainingCycleDays: training_cycle_days ?? null,
        reviewOffsetDays: review_offset_days ?? null,
        planUpdateMode: plan_update_mode ?? 'extend',
        defaultForms: (package_default_forms ?? []).map(serializeDefaultForm),
    };
}

/**
 * Renames a package row's `package_variations` relation to `variations`.
 * Returns null when given null (e.g. a not-found lookup).
 */
export function serializePackage<T extends { package_variations?: unknown }>(
    pkg: T | null,
) {
    if (!pkg) return null;
    const { package_variations, ...rest } = pkg;
    const variations = (package_variations ?? []) as Array<Record<string, unknown> & { package_default_forms?: RawDefaultForm[] }>;
    return {
        ...rest,
        variations: variations.map(serializeVariation),
    };
}

/** Serializes a list of package rows. */
export function serializePackages<T extends { package_variations?: unknown }>(pkgs: T[]) {
    return pkgs.map((pkg) => serializePackage(pkg)!);
}
