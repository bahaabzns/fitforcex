// Partial index for the Plans Queue's default view (GET /api/forms/queue?view=need-action): the rows a coach
// still has to act on, newest first. The predicate is the exact "need action" rule getQueue uses
// (QUEUE_NON_ACTION_STATUSES in forms.controller.ts) — keep the two in step, or the planner stops using it.
// It only covers active (non-archived) rows, so reviewed history never bloats it.
//
// Plain CREATE INDEX (not CONCURRENTLY), same reasoning as migration 113: it runs inside node-pg-migrate's
// transaction so a failure leaves nothing half-built. It briefly blocks writes to form_requests while it
// builds, so run it at a quiet time if that table is large in production. IF NOT EXISTS keeps it re-runnable.
//
// Touches exactly: idx_form_requests_ws_need_action.
exports.up = (pgm) => {
    pgm.sql(`
        CREATE INDEX IF NOT EXISTS "idx_form_requests_ws_need_action"
        ON "form_requests" ("workspace_id", "requested_at" DESC)
        WHERE "archived_at" IS NULL
          AND ("status" IS NULL OR "status" NOT IN ('pending', 'scheduled', 'sent', 'reviewed'));
    `);
};

exports.down = (pgm) => {
    pgm.sql(`DROP INDEX IF EXISTS "idx_form_requests_ws_need_action";`);
};
