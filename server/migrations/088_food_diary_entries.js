// Food Diary — one row per client per calendar day, a snapshot of that day's
// assigned food items plus how much of each the client says they ate.
// Snapshotted (not a live FK into nutrition_meal_items) for the same reason
// workout_logs snapshots exercises — see the model's doc comment in schema.prisma.
exports.up = (pgm) => {
    pgm.createTable('food_diary_entries', {
        id:             { type: 'text', primaryKey: true },
        client_id:      { type: 'text', notNull: true, references: 'clients', onDelete: 'CASCADE' },
        workspace_id:   { type: 'text', notNull: true, references: 'workspaces', onDelete: 'CASCADE' },
        plan_id:        { type: 'text' },
        cycle_id:       { type: 'text' },
        date:           { type: 'date', notNull: true },
        items:          { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
        total_calories: { type: 'decimal' },
        total_protein:  { type: 'decimal' },
        total_carbs:    { type: 'decimal' },
        total_fats:     { type: 'decimal' },
        goal_calories:  { type: 'integer' },
        goal_protein:   { type: 'integer' },
        goal_carbs:     { type: 'integer' },
        goal_fats:      { type: 'integer' },
        created_at:     { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at:     { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.addConstraint('food_diary_entries', 'food_diary_entries_client_id_date_key', {
        unique: ['client_id', 'date'],
    });
    pgm.createIndex('food_diary_entries', ['client_id', 'date']);
    pgm.createIndex('food_diary_entries', 'workspace_id');
};

exports.down = (pgm) => {
    pgm.dropTable('food_diary_entries');
};
