// Master Form Templates — global default Assessment & Check-In forms owned by the
// Super Admin. Mirror the workspace-scoped forms / form_questions tables but WITHOUT
// workspace_id: they hold the single global master set. New coach workspaces are seeded
// by cloning these rows into forms / form_questions (see lib/libraryClone.ts), exactly
// like the master_* library tables added in 022_default_libraries.js.
exports.up = (pgm) => {
    const timestamps = {
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    };

    pgm.createTable('master_forms', {
        id:             { type: 'text', primaryKey: true },
        title_en:       { type: 'varchar(255)', notNull: true, default: 'Untitled Form' },
        title_ar:       { type: 'varchar(255)' },
        description_en: { type: 'text' },
        description_ar: { type: 'text' },
        status:         { type: 'varchar(20)', notNull: true, default: 'draft' },
        post_action:    { type: 'text', notNull: true, default: 'nothing' },
        form_type:      { type: 'text', notNull: true, default: 'check-in' },
        ...timestamps,
    });
    pgm.createIndex('master_forms', 'form_type');

    pgm.createTable('master_form_questions', {
        id:             { type: 'text', primaryKey: true },
        master_form_id: { type: 'text', notNull: true, references: 'master_forms', onDelete: 'CASCADE' },
        label_en:       { type: 'text', notNull: true, default: 'Question' },
        label_ar:       { type: 'text' },
        type:           { type: 'varchar(30)', notNull: true, default: 'text' },
        required:       { type: 'boolean', notNull: true, default: false },
        order_index:    { type: 'integer', notNull: true, default: 0 },
        options:        { type: 'jsonb' },
        options_ar:     { type: 'jsonb' },
        placeholder_en: { type: 'text' },
        placeholder_ar: { type: 'text' },
        min_value:      { type: 'integer' },
        max_value:      { type: 'integer' },
        created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });
    pgm.createIndex('master_form_questions', 'master_form_id');
};

exports.down = (pgm) => {
    pgm.dropTable('master_form_questions');
    pgm.dropTable('master_forms');
};
