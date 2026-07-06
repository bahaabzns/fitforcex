// Package Lifecycle, Phase 3b/4 — recurring check-in schedule rows, created
// at plan activation (Phase 3b) and dispatched by a cron extension (Phase 4).
// See docs/package-lifecycle-implementation-plan.md, Phase 4.

exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE IF NOT EXISTS check_in_schedules (
            id                TEXT PRIMARY KEY,
            workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
            form_id           TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
            interval_days     INT NOT NULL,
            next_due_at       TIMESTAMPTZ NOT NULL,
            source_plan_type  TEXT NOT NULL CHECK (source_plan_type IN ('nutrition', 'training')),
            source_plan_id    TEXT NOT NULL,
            paused_at         TIMESTAMPTZ,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_checkin_sched_due ON check_in_schedules (next_due_at) WHERE paused_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_checkin_sched_client ON check_in_schedules (client_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`DROP TABLE IF EXISTS check_in_schedules;`);
};
