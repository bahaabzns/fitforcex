// Form Submission Archiving.
//
// Coaches need a way to clear reviewed/actioned check-in and assessment
// submissions out of the active Plans Queue without destroying the
// underlying responses (unlike deleteRequest/cancelQueue, which only ever
// touch pending/scheduled requests that were never submitted). Archiving is
// a reversible marker layered over `status`, mirroring the client
// archived_at/archived_by pattern from 025_client_archiving.js.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE form_requests
            ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS archived_by TEXT;

        -- Active queue filters on (workspace_id, archived_at IS NULL); the
        -- archived view filters on (workspace_id, archived_at IS NOT NULL).
        CREATE INDEX IF NOT EXISTS idx_form_requests_ws_archived
            ON form_requests (workspace_id, archived_at);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP INDEX IF EXISTS idx_form_requests_ws_archived;

        ALTER TABLE form_requests
            DROP COLUMN IF EXISTS archived_at,
            DROP COLUMN IF EXISTS archived_by;
    `);
};
