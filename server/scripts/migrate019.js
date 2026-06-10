/**
 * Migration 019 — user_sessions table
 * Adds JWT token revocation support: stores a hash of every issued token.
 * Safe to re-run: uses IF NOT EXISTS.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    const client = await pool.connect();
    try {
        console.log('Applying migration 019: user_sessions table…');
        await client.query(`
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
        console.log('  → done');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
