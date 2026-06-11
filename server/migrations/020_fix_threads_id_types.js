/**
 * Migration 020 — Fix threads table ID types
 *
 * Migration 014 created threads.workspace_id and threads.client_id as INTEGER,
 * inconsistent with the TEXT primary key strategy used by all other tables
 * (workout_logs, client_observations, password_reset_tokens, etc.).
 *
 * This migration drops the integer FK constraints, converts both columns to TEXT,
 * and restores the unique constraint and index.
 */

exports.up = async (pgm) => {
    await pgm.db.query(`
        -- Drop FK constraints added by migration 014
        ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_workspace_id_fkey;
        ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_client_id_fkey;

        -- Drop the unique constraint (references the columns being altered)
        ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_workspace_client_unique;

        -- Drop the index on workspace_id (will be recreated)
        DROP INDEX IF EXISTS threads_workspace_id_index;

        -- Convert both FK columns to TEXT
        ALTER TABLE threads ALTER COLUMN workspace_id TYPE TEXT;
        ALTER TABLE threads ALTER COLUMN client_id    TYPE TEXT;

        -- Restore the unique constraint
        ALTER TABLE threads
            ADD CONSTRAINT threads_workspace_client_unique
            UNIQUE (workspace_id, client_id);

        -- Restore the index
        CREATE INDEX threads_workspace_id_index ON threads (workspace_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_workspace_client_unique;
        DROP INDEX IF EXISTS threads_workspace_id_index;

        ALTER TABLE threads ALTER COLUMN workspace_id TYPE INTEGER USING workspace_id::integer;
        ALTER TABLE threads ALTER COLUMN client_id    TYPE INTEGER USING client_id::integer;

        ALTER TABLE threads
            ADD CONSTRAINT threads_workspace_client_unique
            UNIQUE (workspace_id, client_id);

        CREATE INDEX threads_workspace_id_index ON threads (workspace_id);
    `);
};
