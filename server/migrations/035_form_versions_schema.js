// Forms Versioning Phase 1 — schema foundation (additive only, no behavior
// change yet). See docs/forms-versioning-architecture-decision.md and
// docs/forms-versioning-implementation-plan.md.
//
// `form_versions` — an immutable-once-sealed snapshot of a form's question
// set. Exactly one version is "current" per form at any time, tracked via
// forms.current_version_id (not a status column here — see the ADR
// addendum on why a single FK pointer beats a per-row status enum).
//
// `form_version_questions` — mirrors form_questions' shape exactly (kept
// shape-for-shape so read-path cutover in Phase 3 needs no response-shape
// changes), scoped to a version instead of a form.
exports.up = (pgm) => {
    pgm.createTable('form_versions', {
        id:             { type: 'text', primaryKey: true },
        form_id:        { type: 'text', notNull: true, references: 'forms', onDelete: 'CASCADE' },
        version_number: { type: 'integer', notNull: true },
        sealed_at:      { type: 'timestamptz' }, // NULL = still an editable draft
        created_by:     { type: 'text' },        // user id; NULL for system/scheduler-triggered forks (no FK — mirrors form_requests.assigned_to's existing unconstrained-actor-id convention)
        change_note:    { type: 'text' },        // reserved for a future manual-publish UI; unused in v1
        created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.addConstraint('form_versions', 'uq_form_versions_form_version_number', {
        unique: ['form_id', 'version_number'],
    });
    pgm.createIndex('form_versions', 'form_id');

    pgm.createTable('form_version_questions', {
        id:              { type: 'text', primaryKey: true },
        form_version_id: { type: 'text', notNull: true, references: 'form_versions', onDelete: 'CASCADE' },
        label_en:        { type: 'text', notNull: true, default: 'Question' },
        label_ar:        { type: 'text' },
        type:            { type: 'varchar(30)', notNull: true, default: 'text' },
        required:        { type: 'boolean', notNull: true, default: false },
        order_index:     { type: 'integer', notNull: true, default: 0 },
        options:         { type: 'jsonb' },
        options_ar:      { type: 'jsonb' },
        placeholder_en:  { type: 'text' },
        placeholder_ar:  { type: 'text' },
        min_value:       { type: 'integer' },
        max_value:       { type: 'integer' },
        metric_id:       { type: 'text', references: 'metrics', onDelete: 'SET NULL' },
        created_at:      { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.createIndex('form_version_questions', 'form_version_id');
    pgm.createIndex('form_version_questions', 'metric_id');

    // Nullable during migration (backfilled in 036) — enforced as "always
    // set" at the application layer from Phase 2 onward, not at the DB
    // level, to avoid a chicken-and-egg NOT NULL constraint here.
    pgm.addColumns('forms', {
        current_version_id: { type: 'text', references: 'form_versions', onDelete: 'SET NULL' },
    });
    pgm.addColumns('form_requests', {
        form_version_id: { type: 'text', references: 'form_versions', onDelete: 'SET NULL' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('form_requests', ['form_version_id']);
    pgm.dropColumns('forms', ['current_version_id']);
    pgm.dropTable('form_version_questions');
    pgm.dropTable('form_versions');
};
