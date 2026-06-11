exports.up = (pgm) => {
    pgm.createTable('threads', {
        id: { type: 'text', primaryKey: true },
        workspace_id: {
            type: 'integer',
            notNull: true,
            references: '"workspaces"(id)',
            onDelete: 'CASCADE',
        },
        client_id: {
            type: 'integer',
            notNull: true,
            references: '"clients"(id)',
            onDelete: 'CASCADE',
        },
        status: { type: 'text', notNull: true, default: "'open'" },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.addConstraint('threads', 'threads_workspace_client_unique', 'UNIQUE (workspace_id, client_id)');
    pgm.createIndex('threads', 'workspace_id');

    pgm.createTable('messages', {
        id: { type: 'text', primaryKey: true },
        thread_id: {
            type: 'text',
            notNull: true,
            references: '"threads"(id)',
            onDelete: 'CASCADE',
        },
        sender_type: { type: 'text', notNull: true },
        sender_id: { type: 'text', notNull: true },
        body: { type: 'text', notNull: true },
        read_by_team_at: { type: 'timestamptz', default: null },
        read_by_client_at: { type: 'timestamptz', default: null },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('messages', 'thread_id');
};

exports.down = (pgm) => {
    pgm.dropTable('messages');
    pgm.dropTable('threads');
};
