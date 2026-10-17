// Who finished a plan request, so the Team Workload dashboard can show each team member's
// finished plans per day. Set when a request becomes 'reviewed' (marked done in the Plans Queue,
// or closed out by activating a plan); cleared if the review is undone. NULL on older rows,
// which the dashboard credits to the assignee instead. No FK: the history must outlive a
// removed member (same convention as assigned_to).
//
// The partial index serves the dashboard's "finished in a date range" query.
//
// Touches exactly:
//   form_requests.action_taken_by   text NULL
//   index form_requests_ws_action_taken_idx on (workspace_id, action_taken_at) where action_taken_at is not null
exports.up = (pgm) => {
    pgm.sql(`
        ALTER TABLE "form_requests" ADD COLUMN IF NOT EXISTS "action_taken_by" TEXT;
        CREATE INDEX IF NOT EXISTS "form_requests_ws_action_taken_idx"
            ON "form_requests"("workspace_id", "action_taken_at") WHERE "action_taken_at" IS NOT NULL;
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        DROP INDEX IF EXISTS "form_requests_ws_action_taken_idx";
        ALTER TABLE "form_requests" DROP COLUMN IF EXISTS "action_taken_by";
    `);
};
