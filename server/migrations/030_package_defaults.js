// Package Lifecycle, Phase 1 — package variations become the configuration
// surface for plan cycle length, plan-update behavior, and default forms.
// See docs/package-lifecycle-implementation-plan.md, Phase 1.
//
// Every new column is nullable (or has a safe default) and additive: a
// package with nothing configured behaves exactly as before this migration.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE package_variations
            ADD COLUMN IF NOT EXISTS nutrition_cycle_days INT,
            ADD COLUMN IF NOT EXISTS training_cycle_days INT,
            ADD COLUMN IF NOT EXISTS review_offset_days INT,
            ADD COLUMN IF NOT EXISTS plan_update_mode TEXT NOT NULL DEFAULT 'extend';

        ALTER TABLE package_variations
            DROP CONSTRAINT IF EXISTS package_variations_plan_update_mode_check;
        ALTER TABLE package_variations
            ADD CONSTRAINT package_variations_plan_update_mode_check
                CHECK (plan_update_mode IN ('restart', 'extend'));

        CREATE TABLE IF NOT EXISTS package_default_forms (
            id                    TEXT PRIMARY KEY,
            package_variation_id  TEXT NOT NULL REFERENCES package_variations(id) ON DELETE CASCADE,
            form_id               TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
            kind                  TEXT NOT NULL CHECK (kind IN ('assessment', 'checkin')),
            interval_days         INT,
            sort_order            INT NOT NULL DEFAULT 1,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_pkg_default_forms_variation ON package_default_forms (package_variation_id);
        CREATE INDEX IF NOT EXISTS idx_pkg_default_forms_form ON package_default_forms (form_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS package_default_forms;

        ALTER TABLE package_variations
            DROP CONSTRAINT IF EXISTS package_variations_plan_update_mode_check,
            DROP COLUMN IF EXISTS plan_update_mode,
            DROP COLUMN IF EXISTS review_offset_days,
            DROP COLUMN IF EXISTS training_cycle_days,
            DROP COLUMN IF EXISTS nutrition_cycle_days;
    `);
};
