// Forms Versioning — Release-Readiness Review fix. Every foreign key column
// this project either introduced or retargeted needs an index per the
// project's own convention (CLAUDE.md §10: "Index every foreign key and
// every column you filter or look up by"). Two were missing entirely
// (current_version_id, form_version_id); three more are FK columns whose
// *constraint* this project's migrations rewrote (037's retarget, 038's
// cascade hardening) without adding the index that should have gone with it.
//
// Scope note: forms.workspace_id, form_requests.workspace_id/client_id, and
// check_in_schedules.workspace_id are also unindexed FK columns, but they
// pre-date this project and were never touched by any Forms Versioning
// migration — left alone here and logged to DEBT.md instead, to keep this
// migration scoped to what this project actually introduced or modified.
exports.up = (pgm) => {
    // Named explicitly in the review: the two brand-new FK columns.
    pgm.createIndex('forms', 'current_version_id');
    pgm.createIndex('form_requests', 'form_version_id');

    // form_responses.question_id — migration 037 retargeted this FK's
    // constraint (form_questions -> form_version_questions) but never
    // indexed it; it's the join column for every historical-answer read
    // path (getRequestsByClient, getQueue, buildTransformationPayload,
    // submitFormRequest's metric lookup).
    pgm.createIndex('form_responses', 'question_id');

    // check_in_schedules.form_id / form_requests.form_id — migration 038
    // rewrote these FKs' ON DELETE behavior (CASCADE -> RESTRICT); the
    // RESTRICT check itself scans the referencing table for matching rows
    // on every attempted forms delete, which is exactly what an index
    // speeds up.
    pgm.createIndex('check_in_schedules', 'form_id');
    pgm.createIndex('form_requests', 'form_id');
};

exports.down = (pgm) => {
    pgm.dropIndex('form_requests', 'form_id');
    pgm.dropIndex('check_in_schedules', 'form_id');
    pgm.dropIndex('form_responses', 'question_id');
    pgm.dropIndex('form_requests', 'form_version_id');
    pgm.dropIndex('forms', 'current_version_id');
};
