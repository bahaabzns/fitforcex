// "Auto-assign this client to the same agent next time" rules for the Plans Queue.
// One rule = one client + one plan type (nutrition-plan / workout-plan) -> one agent, so a client's
// nutrition and workout forms can go to different people.
//
// Rows are never deleted: turning a rule off stamps disabled_at / disabled_by / disabled_reason, and
// re-enabling (or moving to another agent) inserts a new row. The table is its own audit trail; the
// current rule is the row with disabled_at IS NULL. The partial unique index enforces "at most one
// current rule per client + plan type" even if two managers tick the box at the same moment.
//
// agent_user_id / enabled_by / disabled_by deliberately have no FK: history must outlive a removed
// member (same convention as form_requests.assigned_to and capacity_history).
// last_skipped_at / last_skip_reason: set when a submission could not use the rule (agent
// inactive or no longer a plan-producing role), so the manager's panel can say why.
//
// Touches exactly:
//   table client_auto_assign
//   index client_auto_assign_active_uniq   unique (workspace_id, client_id, plan_type) where disabled_at is null
//   index client_auto_assign_agent_idx     (workspace_id, agent_user_id) where disabled_at is null
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "client_auto_assign" (
            "id"               TEXT PRIMARY KEY,
            "workspace_id"     TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
            "client_id"        TEXT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
            "plan_type"        TEXT NOT NULL CHECK ("plan_type" IN ('nutrition-plan', 'workout-plan')),
            "agent_user_id"    TEXT NOT NULL,
            "enabled_by"       TEXT,
            "enabled_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "disabled_at"      TIMESTAMPTZ(6),
            "disabled_by"      TEXT,
            "disabled_reason"  TEXT,
            "last_skipped_at"  TIMESTAMPTZ(6),
            "last_skip_reason" TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "client_auto_assign_active_uniq"
            ON "client_auto_assign"("workspace_id", "client_id", "plan_type") WHERE "disabled_at" IS NULL;
        CREATE INDEX IF NOT EXISTS "client_auto_assign_agent_idx"
            ON "client_auto_assign"("workspace_id", "agent_user_id") WHERE "disabled_at" IS NULL;
    `);
};

exports.down = (pgm) => {
    pgm.sql(`DROP TABLE IF EXISTS "client_auto_assign";`);
};
