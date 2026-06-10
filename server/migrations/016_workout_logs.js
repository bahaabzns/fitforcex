// Stub — this migration was applied directly to the database before the file
// was committed to the repository. node-pg-migrate requires the file to exist
// for its ordering check. The up function will never be called again because
// the migration is already recorded in pgmigrations.
exports.up = (pgm) => {
    pgm.createTable('workout_logs', {
        id:           { type: 'text', primaryKey: true },
        client_id:    { type: 'text', notNull: true, references: '"clients"(id)', onDelete: 'CASCADE' },
        workspace_id: { type: 'text', notNull: true, references: '"workspaces"(id)', onDelete: 'CASCADE' },
        plan_id:      { type: 'text', references: '"training_plans"(id)' },
        day_id:       { type: 'text', references: '"training_days"(id)' },
        day_index:    { type: 'integer' },
        date:         { type: 'date', notNull: true },
        start_time:   { type: 'text' },
        end_time:     { type: 'text' },
        exercises:    { type: 'jsonb', notNull: true, default: "'[]'" },
        notes:        { type: 'text' },
        completed:    { type: 'boolean', notNull: true, default: true },
        created_at:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('workout_logs', ['client_id', 'date']);
    pgm.createIndex('workout_logs', 'client_id');
    pgm.createIndex('workout_logs', 'plan_id');
    pgm.createIndex('workout_logs', 'workspace_id');
};

exports.down = (pgm) => {
    pgm.dropTable('workout_logs');
};
