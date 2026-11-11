// Upgrade funnel tracking: one row per step a coach takes toward upgrading (shown → click →
// plan_selected → checkout_started → paid), tagged with the button/surface that started it.
//
// Touches exactly:
//   upgrade_events (new table + indexes)
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "upgrade_events" (
            "id"           TEXT PRIMARY KEY,
            "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
            "user_id"      TEXT,
            "event_type"   TEXT NOT NULL,
            "source"       TEXT NOT NULL,
            "plan_id"      TEXT,
            "variation_id" TEXT,
            "payment_id"   TEXT,
            "return_to"    TEXT,
            "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "upgrade_events_workspace_id_idx" ON "upgrade_events" ("workspace_id");
        CREATE INDEX IF NOT EXISTS "upgrade_events_source_event_type_idx" ON "upgrade_events" ("source", "event_type");
        CREATE INDEX IF NOT EXISTS "upgrade_events_created_at_idx" ON "upgrade_events" ("created_at");
        CREATE INDEX IF NOT EXISTS "upgrade_events_payment_id_idx" ON "upgrade_events" ("payment_id");
    `);
};

exports.down = (pgm) => {
    pgm.sql(`DROP TABLE IF EXISTS "upgrade_events";`);
};
