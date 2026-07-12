// Question lineage tracking — schema only (see 044 for the backfill).
// A persistent identity for a question across every version fork it
// survives. Forking (forms.service.ts's forkVersion) clones every question
// into fresh ids with no persisted link back to the row it was cloned from,
// so "this question's full answer history" was previously unknowable once a
// form had been edited after being assigned — a query scoped to only the
// current version's question id silently missed every answer submitted
// against earlier versions. See docs/forms-versioning-implementation-plan.md
// and the "Track as Metric" feature this unblocks
// (server/src/modules/forms/forms.controller.ts).
//
// `origin_question_id` is self-referencing: a brand-new question points at
// its own id (the root of its own lineage); a forked clone copies its
// source's origin_question_id forward (see forkVersion), so every row born
// from the same original question — across any number of forks — shares one
// origin_question_id, in O(1) per fork rather than needing to walk a chain.
// Nullable here (columns need to exist before 044 can backfill them); 044
// sets it NOT NULL once every row has a value.
exports.up = (pgm) => {
    pgm.addColumns('form_version_questions', {
        origin_question_id: { type: 'text', references: 'form_version_questions', onDelete: 'SET NULL' },
    });
    pgm.createIndex('form_version_questions', 'origin_question_id');
};

exports.down = (pgm) => {
    pgm.dropColumns('form_version_questions', ['origin_question_id']);
};
