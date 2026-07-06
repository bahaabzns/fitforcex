/**
 * Shared Observations taxonomy — canonical values must match the backend's
 * allow-lists exactly (server/src/modules/clients/clients.controller.ts).
 * Display labels are translated per-locale (see the clientObservations
 * category/severity keys in messages/*.json); the values below are the wire
 * format sent to the API and must never be localized.
 */

export const OBSERVATION_CATEGORIES = ['General', 'Technique', 'Adherence', 'Nutrition', 'Injury/Pain', 'Mindset'];
export const OBSERVATION_SEVERITIES = ['Low', 'Medium', 'High'];

const CATEGORY_KEY = {
    General:        'categoryGeneral',
    Technique:      'categoryTechnique',
    Adherence:      'categoryAdherence',
    Nutrition:      'categoryNutrition',
    'Injury/Pain':  'categoryInjury',
    Mindset:        'categoryMindset',
};

/** @param {string} category @param {(key: string) => string} t */
export function categoryLabel(category, t) {
    const key = CATEGORY_KEY[category];
    return key ? t(key) : category;
}

const SEVERITY_KEY = { Low: 'severityLow', Medium: 'severityMedium', High: 'severityHigh' };

/** @param {string|null|undefined} severity @param {(key: string) => string} t */
export function severityLabel(severity, t) {
    const key = SEVERITY_KEY[severity];
    return key ? t(key) : null;
}

/** HeroUI Chip `color` for a severity value — undefined severity gets no chip at all. */
export function severityChipColor(severity) {
    if (severity === 'High') return 'danger';
    if (severity === 'Medium') return 'warning';
    if (severity === 'Low') return 'success';
    return 'default';
}

/**
 * Small status-dot background class for the compact card — same literal
 * palette this app already uses for severity (no --color-warning/--color-success
 * custom properties exist, only --color-destructive is a defined semantic
 * token), as a single dot rather than a full border/chip so severity reads
 * as present without dominating the row (see the Training builder's
 * save-status StatusDot for the same "small dot, not a chip" idiom).
 */
export function severityDotClass(severity) {
    if (severity === 'High')   return 'bg-destructive';
    if (severity === 'Medium') return 'bg-yellow-500';
    if (severity === 'Low')    return 'bg-green-500';
    return 'bg-transparent';
}
