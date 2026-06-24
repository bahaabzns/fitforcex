exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id             TEXT PRIMARY KEY,
            workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            recipient_type TEXT NOT NULL,                      -- 'user' | 'client'
            recipient_id   TEXT NOT NULL,
            type           TEXT NOT NULL,                      -- event key, e.g. 'message.received'
            importance     TEXT NOT NULL DEFAULT 'info',       -- 'info' | 'actionable' | 'alert'
            title          TEXT NOT NULL,
            body           TEXT,
            entity_type    TEXT,                               -- what the event is about, e.g. 'thread'
            entity_id      TEXT,
            actor_type     TEXT,                               -- 'user' | 'client' | 'system'
            actor_id       TEXT,
            metadata       JSONB,
            read_at        TIMESTAMPTZ,
            created_at     TIMESTAMPTZ DEFAULT NOW()
        );

        -- The hot path: a recipient's bell, newest first, and the unread filter.
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient
            ON notifications (recipient_type, recipient_id, read_at, created_at DESC);

        -- Tenant-scoped browsing / pruning.
        CREATE INDEX IF NOT EXISTS idx_notifications_workspace
            ON notifications (workspace_id, created_at DESC);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS notifications;
    `);
};
