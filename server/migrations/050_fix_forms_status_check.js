// Migration drift fix — `forms.status` carries a CHECK constraint that was
// never captured in this migration history (added directly against the DB
// at some point, presumably when only 'draft'/'active' existed). Forms
// Versioning Phase 5 added the 'archived' status to the app layer
// (normalizeStatus in forms.controller.ts) without a matching migration, so
// every archive attempt has been failing with a 23514 constraint violation
// ever since — the coach-facing symptom was Archive/Delete "not working".
// Realigns the DB constraint with FORM_STATUSES = ['draft','active','archived'].
exports.up = async (pgm) => {
    await pgm.db.query(`
        -- Pre-existing rows using the old pre-rename 'published' status
        -- (see seed-chats-forms.ts) would otherwise fail the constraint below.
        UPDATE forms SET status = 'active' WHERE status = 'published';

        ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_status_check;
        ALTER TABLE forms ADD CONSTRAINT forms_status_check
            CHECK (status IN ('draft', 'active', 'archived'));
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_status_check;
    `);
};
