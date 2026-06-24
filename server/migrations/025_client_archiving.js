// Client Deletion & Archiving workflow.
//
// Archiving is a lifecycle state layered OVER the computed subscription status:
// a client with archived_at set reports status "Archived"; otherwise the
// existing computed Active/Frozen/Expired status applies. Deleting a client
// archives it by default — the archive/delete audit columns capture who did
// what and when. Permanent deletion (owner-only) honours the workspace-level
// client_deletion_strategy ('anonymize' = scrub PII, keep analytics | 'hard').
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE clients
            ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS archived_by  TEXT,
            ADD COLUMN IF NOT EXISTS restored_at  TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS restored_by  TEXT,
            ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS deleted_by   TEXT;

        -- Active lists filter on (workspace_id, archived_at IS NULL); the
        -- archived tab filters on (workspace_id, archived_at IS NOT NULL).
        CREATE INDEX IF NOT EXISTS idx_clients_ws_archived
            ON clients (workspace_id, archived_at);

        ALTER TABLE workspaces
            ADD COLUMN IF NOT EXISTS client_deletion_strategy TEXT NOT NULL DEFAULT 'anonymize';
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP INDEX IF EXISTS idx_clients_ws_archived;

        ALTER TABLE clients
            DROP COLUMN IF EXISTS archived_at,
            DROP COLUMN IF EXISTS archived_by,
            DROP COLUMN IF EXISTS restored_at,
            DROP COLUMN IF EXISTS restored_by,
            DROP COLUMN IF EXISTS deleted_at,
            DROP COLUMN IF EXISTS deleted_by;

        ALTER TABLE workspaces
            DROP COLUMN IF EXISTS client_deletion_strategy;
    `);
};
