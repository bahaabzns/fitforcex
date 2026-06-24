exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE IF NOT EXISTS subscription_access_policies (
            id                         TEXT PRIMARY KEY,
            workspace_id               TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            package_id                 TEXT REFERENCES packages(id) ON DELETE CASCADE,
            scope                      TEXT NOT NULL,
            keep_portal_access         BOOLEAN NOT NULL DEFAULT TRUE,
            view_training_plans        BOOLEAN NOT NULL DEFAULT TRUE,
            view_nutrition_plans       BOOLEAN NOT NULL DEFAULT TRUE,
            view_progress_history      BOOLEAN NOT NULL DEFAULT TRUE,
            view_assessments           BOOLEAN NOT NULL DEFAULT TRUE,
            view_checkins              BOOLEAN NOT NULL DEFAULT TRUE,
            allow_messaging            BOOLEAN NOT NULL DEFAULT FALSE,
            allow_submit_checkins      BOOLEAN NOT NULL DEFAULT FALSE,
            allow_booking_appointments BOOLEAN NOT NULL DEFAULT FALSE,
            allow_download_files       BOOLEAN NOT NULL DEFAULT FALSE,
            grace_period_days          INTEGER NOT NULL DEFAULT 0,
            created_at                 TIMESTAMPTZ DEFAULT NOW(),
            updated_at                 TIMESTAMPTZ DEFAULT NOW()
        );

        -- One global policy per (workspace, scope); package_id IS NULL marks the global default.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_policy_global
            ON subscription_access_policies (workspace_id, scope)
            WHERE package_id IS NULL;

        -- One override per (workspace, package, scope).
        CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_policy_package
            ON subscription_access_policies (workspace_id, package_id, scope)
            WHERE package_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_sub_policy_workspace ON subscription_access_policies (workspace_id);
        CREATE INDEX IF NOT EXISTS idx_sub_policy_package   ON subscription_access_policies (package_id);

        CREATE TABLE IF NOT EXISTS subscription_status_audit (
            id            TEXT PRIMARY KEY,
            workspace_id  TEXT NOT NULL,
            client_id     TEXT,
            actor_type    TEXT NOT NULL,
            actor_user_id TEXT,
            event_type    TEXT NOT NULL,
            from_status   TEXT,
            to_status     TEXT,
            metadata      JSONB,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sub_audit_workspace ON subscription_status_audit (workspace_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sub_audit_client    ON subscription_status_audit (client_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS subscription_status_audit;
        DROP TABLE IF EXISTS subscription_access_policies;
    `);
};
