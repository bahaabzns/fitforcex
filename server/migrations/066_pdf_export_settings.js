// PDF export feature: pdf_settings existed but was never wired up, and was scoped per-coach
// (coach_id -> users). This app's tenancy boundary is the workspace (clients/plans are all
// workspace_id-scoped, and one user can own/belong to multiple workspaces), so branding needs
// the same boundary or two workspaces owned by the same coach would incorrectly share one
// brand identity. Table has zero rows in every environment (never used), so the rename needs
// no backfill. Also adds training-specific display toggles alongside the existing
// nutrition-specific ones, since v1 exports both plan types from one settings row.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE pdf_settings DROP CONSTRAINT IF EXISTS pdf_settings_coach_id_fkey;
        ALTER TABLE pdf_settings RENAME COLUMN coach_id TO workspace_id;
        ALTER TABLE pdf_settings
            ADD CONSTRAINT pdf_settings_workspace_id_fkey
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

        ALTER TABLE pdf_settings ALTER COLUMN cover_title SET DEFAULT 'Plan';

        ALTER TABLE pdf_settings
            ADD COLUMN show_exercise_notes            BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_exercise_equipment         BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_sets_detail                BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN show_day_summary_page           BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN day_summary_bg_image_url        TEXT,
            ADD COLUMN exercise_content_primary_color  TEXT,
            ADD COLUMN day_summary_primary_color       TEXT,
            ADD COLUMN max_exercises_per_page          INTEGER NOT NULL DEFAULT 0;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE pdf_settings
            DROP COLUMN IF EXISTS show_exercise_notes,
            DROP COLUMN IF EXISTS show_exercise_equipment,
            DROP COLUMN IF EXISTS show_sets_detail,
            DROP COLUMN IF EXISTS show_day_summary_page,
            DROP COLUMN IF EXISTS day_summary_bg_image_url,
            DROP COLUMN IF EXISTS exercise_content_primary_color,
            DROP COLUMN IF EXISTS day_summary_primary_color,
            DROP COLUMN IF EXISTS max_exercises_per_page;

        ALTER TABLE pdf_settings ALTER COLUMN cover_title SET DEFAULT 'Nutrition Plan';

        ALTER TABLE pdf_settings DROP CONSTRAINT IF EXISTS pdf_settings_workspace_id_fkey;
        ALTER TABLE pdf_settings RENAME COLUMN workspace_id TO coach_id;
        ALTER TABLE pdf_settings
            ADD CONSTRAINT pdf_settings_coach_id_fkey
            FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE;
    `);
};
