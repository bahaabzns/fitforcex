// Question lineage tracking — backfill. Best-effort stitches lineages across
// a form's existing versions by matching (form_id, label_en, order_index),
// earliest version_number first. This is a heuristic, not a guarantee — two
// unrelated questions that happen to land on the same label and order_index
// in different versions of the same form (e.g. one deleted, a different one
// later added in its place) would be incorrectly linked. Where a row has no
// match in an earlier version, it becomes its own root, which is the safe
// failure direction (under-counts a question's history rather than
// misattributing another question's answers to it). See 043 for the schema.
//
// Idempotent: only processes rows where origin_question_id IS NULL, so a
// partial/interrupted run can simply be re-run.
exports.up = async (pgm) => {
    const updateResult = await pgm.db.query(`
        WITH ranked AS (
            SELECT fvq.id,
                   FIRST_VALUE(fvq.id) OVER (
                       PARTITION BY fv.form_id, fvq.label_en, fvq.order_index
                       ORDER BY fv.version_number ASC, fvq.id ASC
                   ) AS root_id
            FROM form_version_questions fvq
            JOIN form_versions fv ON fv.id = fvq.form_version_id
            WHERE fvq.origin_question_id IS NULL
        )
        UPDATE form_version_questions fvq
        SET origin_question_id = ranked.root_id
        FROM ranked
        WHERE fvq.id = ranked.id
    `);

    console.log(`[044_form_version_questions_lineage_backfill] backfilled origin_question_id for ${updateResult.rowCount} row(s)`);

    const { rows: [{ count: stillMissing }] } = await pgm.db.query(
        `SELECT count(*)::int AS count FROM form_version_questions WHERE origin_question_id IS NULL`
    );
    if (Number(stillMissing) > 0) {
        throw new Error(`Lineage backfill incomplete: ${stillMissing} row(s) still missing origin_question_id`);
    }

    await pgm.db.query(`ALTER TABLE form_version_questions ALTER COLUMN origin_question_id SET NOT NULL`);
};

exports.down = async (pgm) => {
    await pgm.db.query(`ALTER TABLE form_version_questions ALTER COLUMN origin_question_id DROP NOT NULL`);
    await pgm.db.query(`UPDATE form_version_questions SET origin_question_id = NULL`);
};
