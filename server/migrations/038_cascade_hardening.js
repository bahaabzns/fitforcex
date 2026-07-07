// Forms Versioning Phase 4 — harden the three CASCADE FKs that caused the
// original "deleting a form silently deletes client history" bug (see
// docs/forms-architecture-investigation.md "Why Delete Breaks History").
//
// The application-layer guard added in Phase 0 (deleteForm returns 409 when
// the form has any form_requests) is the primary, user-friendly control.
// These RESTRICT constraints are the structural backstop underneath it —
// defense in depth for any code path (a script, an admin tool, a future
// engineer) that bypasses the controller and issues a raw delete. A
// RESTRICT fires as a normal foreign-key-violation error, not a silent
// no-op or a cascade.
//
// form_requests -> form_responses stays CASCADE (unchanged, never part of
// the bug: cancelQueue/deleteRequest only ever delete pending/scheduled
// requests, which by definition have zero responses yet).
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE form_requests DROP CONSTRAINT form_requests_form_id_fkey;
        ALTER TABLE form_requests
            ADD CONSTRAINT form_requests_form_id_fkey
            FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE RESTRICT;

        ALTER TABLE check_in_schedules DROP CONSTRAINT check_in_schedules_form_id_fkey;
        ALTER TABLE check_in_schedules
            ADD CONSTRAINT check_in_schedules_form_id_fkey
            FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE RESTRICT;

        ALTER TABLE package_default_forms DROP CONSTRAINT package_default_forms_form_id_fkey;
        ALTER TABLE package_default_forms
            ADD CONSTRAINT package_default_forms_form_id_fkey
            FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE RESTRICT;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE form_requests DROP CONSTRAINT form_requests_form_id_fkey;
        ALTER TABLE form_requests
            ADD CONSTRAINT form_requests_form_id_fkey
            FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;

        ALTER TABLE check_in_schedules DROP CONSTRAINT check_in_schedules_form_id_fkey;
        ALTER TABLE check_in_schedules
            ADD CONSTRAINT check_in_schedules_form_id_fkey
            FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;

        ALTER TABLE package_default_forms DROP CONSTRAINT package_default_forms_form_id_fkey;
        ALTER TABLE package_default_forms
            ADD CONSTRAINT package_default_forms_form_id_fkey
            FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE;
    `);
};
