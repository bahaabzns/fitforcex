// Package Lifecycle — check-in forms become one-shot: sent exactly once, at
// the plan's cycle_end_at, rather than on a recurring interval. A configured
// interval no longer means anything (there is only ever one occurrence), so
// interval_days is dropped from both the package-level defaults and the
// per-activation schedule rows. See docs/package-lifecycle-implementation-plan.md.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE package_default_forms DROP COLUMN IF EXISTS interval_days;
        ALTER TABLE check_in_schedules DROP COLUMN IF EXISTS interval_days;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE package_default_forms ADD COLUMN IF NOT EXISTS interval_days INT;
        ALTER TABLE check_in_schedules ADD COLUMN IF NOT EXISTS interval_days INT NOT NULL DEFAULT 1;
    `);
};
