// Admin WhatsApp follow-up log: one row per message/call the admin records against a coach's workspace.
// The "next follow-up" of the NEWEST entry is the coach's pending reminder, so no separate reminders table.
//
// Touches exactly:
//   admin_follow_ups (new)
//   index admin_follow_ups_workspace_followed_idx  (history, newest first)
//   index admin_follow_ups_next_on_idx             (due-today / overdue lookups)
//   index admin_follow_ups_deleted_at_idx
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "admin_follow_ups" (
            "id"                  TEXT PRIMARY KEY,
            "workspace_id"        TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
            "followed_up_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
            "sent_note"           TEXT NOT NULL,
            "reply_note"          TEXT,
            "next_follow_up_on"   DATE,
            "created_by_admin_id" TEXT,
            "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
            "deleted_at"          TIMESTAMPTZ
        );
    `);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "admin_follow_ups_workspace_followed_idx" ON "admin_follow_ups" ("workspace_id", "followed_up_at");`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "admin_follow_ups_next_on_idx" ON "admin_follow_ups" ("next_follow_up_on");`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "admin_follow_ups_deleted_at_idx" ON "admin_follow_ups" ("deleted_at");`);
};

exports.down = (pgm) => {
    pgm.sql(`DROP TABLE IF EXISTS "admin_follow_ups";`);
};
