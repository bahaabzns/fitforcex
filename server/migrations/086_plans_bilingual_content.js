// Arabic translations for the public pricing section, editable from the admin panel.
//
// Deliberately NOT following migration 012's rename-to-`_en` convention here — `plans`/
// `billing_discounts`/`addons` text columns (display_name, subtitle, cta_text,
// features_header, features_subheader, features, label, save_label) are already read
// unprefixed across a couple dozen call sites (billing.controller.ts, admin.controller.ts,
// plans.controller.ts, and every client page that shows a plan name). Renaming all of them to
// `_en` for symmetry with 012 would touch all of that for zero functional gain — the
// unprefixed column unambiguously means "the English/default value" as long as `_ar` is the
// only other language that will ever exist. Just add the nullable Arabic counterpart instead;
// same fallback behavior (blank Arabic → English shows) as everywhere else.
exports.up = (pgm) => {
    pgm.addColumn('plans', {
        display_name_ar:     { type: 'text' },
        subtitle_ar:          { type: 'text' },
        cta_text_ar:          { type: 'text' },
        features_header_ar:   { type: 'text' },
        features_subheader_ar:{ type: 'text' },
        // Parallel array mirroring `features` (Json) — same precedent as form_questions.options_ar.
        features_ar:          { type: 'jsonb' },
    });

    pgm.addColumn('billing_discounts', {
        label_ar:      { type: 'text' },
        save_label_ar: { type: 'text' },
    });

    pgm.addColumn('addons', {
        label_ar: { type: 'text' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('addons', ['label_ar']);
    pgm.dropColumn('billing_discounts', ['label_ar', 'save_label_ar']);
    pgm.dropColumn('plans', [
        'display_name_ar', 'subtitle_ar', 'cta_text_ar',
        'features_header_ar', 'features_subheader_ar', 'features_ar',
    ]);
};
