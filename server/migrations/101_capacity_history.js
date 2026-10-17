// Append-only log of every daily-plan-capacity change, per person, so the
// dashboard can show who changed what and when (and a later trend chart can
// replay capacity over time). Rows are never updated or deleted by the app.
//
// user_id deliberately has no FK: history must outlive a removed member.
// previous_capacity / new_capacity are NULL when capacity was unset / cleared.
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "capacity_history" (
            "id"                TEXT PRIMARY KEY,
            "workspace_id"      TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
            "user_id"           TEXT NOT NULL,
            "previous_capacity" INTEGER,
            "new_capacity"      INTEGER,
            "changed_by"        TEXT,
            "changed_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "capacity_history_ws_user_changed_idx"
            ON "capacity_history"("workspace_id", "user_id", "changed_at" DESC);
    `);
};

exports.down = (pgm) => {
    pgm.sql(`DROP TABLE IF EXISTS "capacity_history";`);
};
