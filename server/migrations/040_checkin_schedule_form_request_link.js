// Package Lifecycle bug fix — check-in schedules created at plan activation
// were invisible in Plans Queue until their due date, because they lived
// only in check_in_schedules (no status field, never queried by the queue)
// and were bridged to form_requests solely by an hourly cron that fired at
// cycle_end_at. Activation now creates the form_requests row (status
// 'scheduled') immediately, and check_in_schedules keeps only enough of a
// link back to it to support restart/extend re-targeting the due date and
// to let the dispatch tick flip status without creating a duplicate row.
// See docs/package-lifecycle-implementation-plan.md and the RCA in the
// forms-versioning branch history for the full trace.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE check_in_schedules
            ADD COLUMN IF NOT EXISTS form_request_id TEXT REFERENCES form_requests(id) ON DELETE SET NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_sched_form_request ON check_in_schedules (form_request_id) WHERE form_request_id IS NOT NULL;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP INDEX IF EXISTS idx_checkin_sched_form_request;
        ALTER TABLE check_in_schedules DROP COLUMN IF EXISTS form_request_id;
    `);
};
