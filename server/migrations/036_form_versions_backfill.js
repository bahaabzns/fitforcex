// Forms Versioning Phase 1 — backfill. For every existing form, create a
// "version 1" that is a byte-for-byte copy of its current form_questions,
// point forms.current_version_id at it, and pin every existing
// form_requests row to it.
//
// form_version_questions rows REUSE the source form_questions.id (this is
// a brand-new, empty table, so there is no collision risk) rather than
// minting new ids — this means form_responses.question_id needs zero
// remapping: it already points at valid rows in the new table the moment
// this migration finishes. See docs/forms-versioning-implementation-plan.md
// Phase 1 for the id-preserving-vs-remapping decision this resolves.
//
// Idempotent: only processes forms where current_version_id IS NULL, so a
// partial/interrupted run can simply be re-run.
const { createId } = require('@paralleldrive/cuid2');

exports.up = async (pgm) => {
    const { rows: forms } = await pgm.db.query(
        `SELECT id FROM forms WHERE current_version_id IS NULL`
    );

    let migrated = 0;
    for (const form of forms) {
        const versionId = createId();

        const { rows: earliestRows } = await pgm.db.query(
            `SELECT MIN(requested_at) AS earliest FROM form_requests WHERE form_id = $1`,
            [form.id]
        );
        const sealedAt = earliestRows[0]?.earliest ?? null;

        await pgm.db.query(
            `INSERT INTO form_versions (id, form_id, version_number, sealed_at, created_by, created_at)
             VALUES ($1, $2, 1, $3, NULL, NOW())`,
            [versionId, form.id, sealedAt]
        );

        // form_questions never had a metric_id column — metrics is a newer
        // concept than the legacy question rows, so there's nothing to
        // carry over; every backfilled row starts with no metric linked.
        await pgm.db.query(
            `INSERT INTO form_version_questions
                (id, form_version_id, label_en, label_ar, type, required, order_index,
                 options, options_ar, placeholder_en, placeholder_ar, min_value, max_value,
                 metric_id, created_at)
             SELECT id, $1, label_en, label_ar, type, required, order_index,
                    options, options_ar, placeholder_en, placeholder_ar, min_value, max_value,
                    NULL::text, created_at
             FROM form_questions WHERE form_id = $2`,
            [versionId, form.id]
        );

        await pgm.db.query(`UPDATE forms SET current_version_id = $1 WHERE id = $2`, [versionId, form.id]);
        await pgm.db.query(
            `UPDATE form_requests SET form_version_id = $1 WHERE form_id = $2 AND form_version_id IS NULL`,
            [versionId, form.id]
        );

        migrated++;
    }

    console.log(`[036_form_versions_backfill] backfilled ${migrated} form(s)`);

    // Validation — fail the migration loudly rather than leave a silently
    // incomplete backfill.
    const { rows: [{ count: formsMissing }] } = await pgm.db.query(
        `SELECT count(*)::int AS count FROM forms WHERE current_version_id IS NULL`
    );
    const { rows: [{ count: requestsMissing }] } = await pgm.db.query(
        `SELECT count(*)::int AS count FROM form_requests WHERE form_version_id IS NULL`
    );
    if (Number(formsMissing) > 0) {
        throw new Error(`Backfill incomplete: ${formsMissing} form(s) still missing current_version_id`);
    }
    if (Number(requestsMissing) > 0) {
        throw new Error(`Backfill incomplete: ${requestsMissing} form_requests row(s) still missing form_version_id`);
    }
};

exports.down = async (pgm) => {
    await pgm.db.query(`UPDATE form_requests SET form_version_id = NULL`);
    await pgm.db.query(`UPDATE forms SET current_version_id = NULL`);
    await pgm.db.query(`DELETE FROM form_version_questions`);
    await pgm.db.query(`DELETE FROM form_versions`);
};
