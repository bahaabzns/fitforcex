// Package Lifecycle, Phase 4 — review_offset_days is snapshotted onto the
// plan at activation time (same pattern as cycle_days), so the daily
// review-due check reads a stable value instead of re-resolving the
// client's *current* package live (which could have changed since
// activation). See docs/package-lifecycle-implementation-plan.md, Phase 4.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS review_offset_days INT;
        ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS review_offset_days INT;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_plans DROP COLUMN IF EXISTS review_offset_days;
        ALTER TABLE nutrition_plans DROP COLUMN IF EXISTS review_offset_days;
    `);
};
