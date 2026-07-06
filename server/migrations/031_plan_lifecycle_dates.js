// Package Lifecycle, Phase 3 — nutrition/training plans get a real duration
// and end date. See docs/package-lifecycle-implementation-plan.md, Phase 3.
//
// Additive/nullable only. Existing active plans simply have cycle_days/
// cycle_end_at = NULL until their next activation or edit (§16.3 of the plan) --
// the builder omits the remaining-days stat row in that case, never showing a
// misleading placeholder.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE nutrition_plans
            ADD COLUMN IF NOT EXISTS cycle_days INT,
            ADD COLUMN IF NOT EXISTS cycle_end_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS review_notified_at TIMESTAMPTZ;

        ALTER TABLE training_plans
            ADD COLUMN IF NOT EXISTS cycle_days INT,
            ADD COLUMN IF NOT EXISTS cycle_end_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS review_notified_at TIMESTAMPTZ;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_plans
            DROP COLUMN IF EXISTS review_notified_at,
            DROP COLUMN IF EXISTS cycle_end_at,
            DROP COLUMN IF EXISTS cycle_days;

        ALTER TABLE nutrition_plans
            DROP COLUMN IF EXISTS review_notified_at,
            DROP COLUMN IF EXISTS cycle_end_at,
            DROP COLUMN IF EXISTS cycle_days;
    `);
};
