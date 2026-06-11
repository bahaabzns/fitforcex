exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash  TEXT NOT NULL UNIQUE,
            expires_at  TIMESTAMPTZ NOT NULL,
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            revoked_at  TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id    ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query('DROP TABLE IF EXISTS user_sessions');
};
