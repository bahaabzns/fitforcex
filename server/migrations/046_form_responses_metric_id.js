// Same drift class this project already hit twice (see 041, 045):
// schema.prisma declares form_responses.metric_id — added alongside
// form_version_questions.metric_id (035) so submitFormRequest could
// denormalize the answered question's metric onto its response row — but
// no migration ever created the column. clientPortal.controller.ts's
// submitFormRequest has been writing metric_id in its createMany() since
// that feature shipped, which is why every client-portal form submission
// 500s with "column metric_id does not exist" on any database that only
// ran committed migrations (prod), while a database that got the column
// via an out-of-band `prisma db push` (local dev) never showed the bug.
exports.up = (pgm) => {
    // ifNotExists: mirrors 045 — some databases may already have this
    // column from the out-of-band push; this migration must still be a
    // no-op there instead of erroring.
    pgm.addColumns('form_responses', {
        metric_id: { type: 'text', references: 'metrics', onDelete: 'SET NULL' },
    }, { ifNotExists: true });

    pgm.createIndex('form_responses', 'metric_id', { ifNotExists: true });
    pgm.createIndex('form_responses', ['request_id', 'metric_id'], { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropIndex('form_responses', ['request_id', 'metric_id'], { ifExists: true });
    pgm.dropIndex('form_responses', 'metric_id', { ifExists: true });
    pgm.dropColumns('form_responses', ['metric_id']);
};
