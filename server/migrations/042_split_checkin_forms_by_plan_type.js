// Package Lifecycle — Package Variation default check-in forms split by plan
// type. The single 'checkin' kind mixed Nutrition and Training check-ins
// together, so the Configure Activation modal had no way to pre-select only
// the forms relevant to the plan type being activated. Replaced with two
// kinds, 'checkin-nutrition' and 'checkin-training', matching the same
// post_action-driven compatibility rule already used to filter the
// activation modal's form list (form_type = 'check-in', post_action =
// 'nutrition-plan' | 'workout-plan'). See
// docs/package-lifecycle-implementation-plan.md §12.2/§12.3.
//
// Backfill: an existing 'checkin' row is reclassified by its form's
// post_action. A row whose form's post_action is neither 'nutrition-plan'
// nor 'workout-plan' (ambiguous — e.g. 'nothing') is duplicated into BOTH
// new kinds rather than dropped or arbitrarily assigned, so no existing
// package default is silently lost for either plan type.
const { createId } = require('@paralleldrive/cuid2');

exports.up = async (pgm) => {
    // Constraint dropped first — the backfill below transitions rows through
    // intermediate states the old ('assessment', 'checkin') constraint would
    // reject; the new constraint is (re)added once every row is final.
    await pgm.db.query(`ALTER TABLE package_default_forms DROP CONSTRAINT IF EXISTS package_default_forms_kind_check;`);

    await pgm.db.query(`
        UPDATE package_default_forms pdf
        SET kind = 'checkin-nutrition'
        FROM forms f
        WHERE pdf.form_id = f.id AND pdf.kind = 'checkin' AND f.post_action = 'nutrition-plan';

        UPDATE package_default_forms pdf
        SET kind = 'checkin-training'
        FROM forms f
        WHERE pdf.form_id = f.id AND pdf.kind = 'checkin' AND f.post_action = 'workout-plan';
    `);

    const { rows: ambiguous } = await pgm.db.query(`
        SELECT pdf.id, pdf.package_variation_id, pdf.form_id, pdf.sort_order, pdf.created_at
        FROM package_default_forms pdf
        WHERE pdf.kind = 'checkin'
    `);
    for (const row of ambiguous) {
        await pgm.db.query(
            `INSERT INTO package_default_forms (id, package_variation_id, form_id, kind, sort_order, created_at)
             VALUES ($1, $2, $3, 'checkin-training', $4, $5)`,
            [createId(), row.package_variation_id, row.form_id, row.sort_order, row.created_at]
        );
        await pgm.db.query(
            `UPDATE package_default_forms SET kind = 'checkin-nutrition' WHERE id = $1`,
            [row.id]
        );
    }
    console.log(`[042_split_checkin_forms_by_plan_type] reclassified default forms; ${ambiguous.length} ambiguous row(s) duplicated into both kinds`);

    await pgm.db.query(`
        ALTER TABLE package_default_forms DROP CONSTRAINT IF EXISTS package_default_forms_kind_check;
        ALTER TABLE package_default_forms
            ADD CONSTRAINT package_default_forms_kind_check
                CHECK (kind IN ('assessment', 'checkin-nutrition', 'checkin-training'));
    `);

    const { rows: [{ count: remaining }] } = await pgm.db.query(
        `SELECT count(*)::int AS count FROM package_default_forms WHERE kind = 'checkin'`
    );
    if (Number(remaining) > 0) {
        throw new Error(`Backfill incomplete: ${remaining} package_default_forms row(s) still have kind = 'checkin'`);
    }
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE package_default_forms DROP CONSTRAINT IF EXISTS package_default_forms_kind_check;
        ALTER TABLE package_default_forms
            ADD CONSTRAINT package_default_forms_kind_check
                CHECK (kind IN ('assessment', 'checkin'));

        UPDATE package_default_forms SET kind = 'checkin' WHERE kind IN ('checkin-nutrition', 'checkin-training');
    `);
};
