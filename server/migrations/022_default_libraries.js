// Default Libraries — global master tables owned by the Super Admin.
// New coach workspaces are seeded by cloning these rows (see lib/libraryClone.ts).
// These tables are NOT workspace-scoped: they hold the single global master set.
exports.up = (pgm) => {
    const timestamps = {
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    };

    // ── Training ───────────────────────────────────────────────────────────────
    pgm.createTable('master_exercise_muscle_groups', {
        id:      { type: 'text', primaryKey: true },
        name_en: { type: 'text', notNull: true },
        name_ar: { type: 'text' },
        ...timestamps,
    });
    pgm.createIndex('master_exercise_muscle_groups', 'name_en', { unique: true });

    pgm.createTable('master_exercise_equipments', {
        id:      { type: 'text', primaryKey: true },
        name_en: { type: 'text', notNull: true },
        name_ar: { type: 'text' },
        ...timestamps,
    });
    pgm.createIndex('master_exercise_equipments', 'name_en', { unique: true });

    pgm.createTable('master_exercise_library', {
        id:              { type: 'text', primaryKey: true },
        name_en:         { type: 'text', notNull: true },
        name_ar:         { type: 'text' },
        muscle_group:    { type: 'text' },
        equipment:       { type: 'text' },
        youtube_url:     { type: 'text' },
        video_path:      { type: 'text' },
        thumbnail_path:  { type: 'text' },
        instructions_en: { type: 'text' },
        instructions_ar: { type: 'text' },
        ...timestamps,
    });
    pgm.createIndex('master_exercise_library', 'name_en');
    pgm.createIndex('master_exercise_library', 'muscle_group');

    // ── Nutrition ──────────────────────────────────────────────────────────────
    pgm.createTable('master_food_categories', {
        id:      { type: 'text', primaryKey: true },
        name_en: { type: 'varchar(100)', notNull: true },
        name_ar: { type: 'varchar(100)' },
        ...timestamps,
    });
    pgm.createIndex('master_food_categories', 'name_en', { unique: true });

    pgm.createTable('master_food_items', {
        id:                   { type: 'text', primaryKey: true },
        name_en:              { type: 'varchar(255)', notNull: true },
        name_ar:              { type: 'varchar(255)' },
        food_category:        { type: 'text' },
        serving_size:         { type: 'decimal' },
        serving_unit:         { type: 'text' },
        calories_per_serving: { type: 'decimal', notNull: true, default: 0 },
        protein_per_serving:  { type: 'decimal', notNull: true, default: 0 },
        carbs_per_serving:    { type: 'decimal', notNull: true, default: 0 },
        fats_per_serving:     { type: 'decimal', notNull: true, default: 0 },
        ...timestamps,
    });
    pgm.createIndex('master_food_items', 'name_en');
    pgm.createIndex('master_food_items', 'food_category');

    // ── Workspace clone status (drives the onboarding screen) ────────────────────
    // Existing workspaces already have data, so they default to 'ready'.
    pgm.addColumn('workspaces', {
        clone_status: { type: 'text', notNull: true, default: 'ready' },
        clone_error:  { type: 'text' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('workspaces', ['clone_status', 'clone_error']);
    pgm.dropTable('master_food_items');
    pgm.dropTable('master_food_categories');
    pgm.dropTable('master_exercise_library');
    pgm.dropTable('master_exercise_equipments');
    pgm.dropTable('master_exercise_muscle_groups');
};
