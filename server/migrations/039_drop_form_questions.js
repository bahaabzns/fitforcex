// Forms Versioning Phase 4 — final legacy retirement. form_questions has
// received zero reads and zero writes since Phase 2 shipped (write path)
// and Phase 3 shipped (read path); every row it ever held was copied,
// id-preserving, into form_version_questions by migration 036. This is
// the one genuinely irreversible migration in the whole Forms Versioning
// project (see docs/forms-versioning-implementation-plan.md, Phase 4 Risks).
//
// Production rollout note: this migration should only run after the bake
// period called for in the implementation plan's Release Strategy (R6),
// and only once a verified, restorable backup of form_questions has been
// taken independently of this migration's own `down`. `down` recreates
// the table shape and FKs but cannot restore rows — Postgres does not
// version dropped table data.
exports.up = (pgm) => {
    pgm.dropTable('form_questions');
};

exports.down = (pgm) => {
    pgm.createTable('form_questions', {
        id:             { type: 'text', primaryKey: true },
        form_id:        { type: 'text', notNull: true, references: 'forms', onDelete: 'CASCADE' },
        label_en:       { type: 'text', notNull: true, default: 'Question' },
        type:           { type: 'varchar(30)', notNull: true, default: 'text' },
        required:       { type: 'boolean', notNull: true, default: false },
        order_index:    { type: 'integer', notNull: true, default: 0 },
        options:        { type: 'jsonb' },
        placeholder_en: { type: 'text' },
        min_value:      { type: 'integer' },
        max_value:      { type: 'integer' },
        created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
        label_ar:       { type: 'text' },
        placeholder_ar: { type: 'text' },
        options_ar:     { type: 'jsonb' },
        metric_id:      { type: 'text', references: 'metrics', onDelete: 'SET NULL' },
    });
    pgm.createIndex('form_questions', 'metric_id');
};
