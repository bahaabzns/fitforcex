exports.up = (pgm) => {
    pgm.createTable('password_reset_tokens', {
        id: { type: 'text', primaryKey: true },
        user_id: {
            type: 'text',
            notNull: true,
            references: '"users"(id)',
            onDelete: 'CASCADE',
        },
        code: { type: 'text', notNull: true },
        expires_at: { type: 'timestamptz', notNull: true },
        used_at: { type: 'timestamptz', default: null },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    });

    pgm.createIndex('password_reset_tokens', 'user_id');
};

exports.down = (pgm) => {
    pgm.dropTable('password_reset_tokens');
};
