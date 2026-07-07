// Forms Versioning Phase 2 — retarget form_responses.question_id's FK from
// form_questions to form_version_questions.
//
// This was originally planned for Phase 4, but Phase 2's write path (the
// same release as this migration) stops creating rows in form_questions
// entirely — every new question lives only in form_version_questions from
// here on. Any new form_responses row created after that point would fail
// its FK check against the old target, so the constraint has to move now,
// not two phases later. See docs/forms-versioning-implementation-plan.md,
// Step 1 addendum.
//
// Zero data movement: migration 036's id-preserving backfill already
// guarantees every existing form_responses.question_id value exists in
// form_version_questions under the same id.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE form_responses DROP CONSTRAINT form_responses_question_id_fkey;
        ALTER TABLE form_responses
            ADD CONSTRAINT form_responses_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES form_version_questions(id) ON DELETE CASCADE;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE form_responses DROP CONSTRAINT form_responses_question_id_fkey;
        ALTER TABLE form_responses
            ADD CONSTRAINT form_responses_question_id_fkey
            FOREIGN KEY (question_id) REFERENCES form_questions(id) ON DELETE CASCADE;
    `);
};
