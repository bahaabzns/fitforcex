// Stub — this migration was applied directly to the database before the file
// was committed to the repository. node-pg-migrate requires the file to exist
// for its ordering check. The up function will never be called again because
// the migration is already recorded in pgmigrations.
exports.up = (pgm) => {
    pgm.createTable('client_observations', {
        id:           { type: 'text', primaryKey: true },
        client_id:    { type: 'text', notNull: true, references: '"clients"(id)', onDelete: 'CASCADE' },
        workspace_id: { type: 'text', notNull: true, references: '"workspaces"(id)', onDelete: 'CASCADE' },
        author_id:    { type: 'text', references: '"users"(id)' },
        content:      { type: 'text', notNull: true },
        created_at:   { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('client_observations', 'client_id');
    pgm.createIndex('client_observations', 'workspace_id');
};

exports.down = (pgm) => {
    pgm.dropTable('client_observations');
};
