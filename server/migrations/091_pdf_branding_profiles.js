// PDF branding: one row per workspace per plan type -> many named profiles.
//
// A coach can keep several fully-independent branding profiles (each with its
// own logo, colors, cover image, section toggles) per plan type and choose one
// at export time. Exactly one profile per (workspace, plan type) is the
// default, used when an export names no profile. This mirrors the
// nutrition/training "never share assets" split (DECISIONS.md 2026-07-28) one
// level down: two profiles of the same type never share an asset reference
// either.
//
// Migration effect: each existing row is that workspace's current sole
// config, so it becomes the "Default" profile (is_default = TRUE). Workspaces
// that never saved PDF settings still get a synthesized default at read time
// (getOrDefault* in pdfExport.service.ts), so this migration deliberately does
// not backfill a row for them.

const TABLES = ['nutrition_pdf_settings', 'training_pdf_settings'];

exports.up = (pgm) => {
    for (const table of TABLES) {
        pgm.sql(`
            ALTER TABLE ${table}
                ADD COLUMN name       TEXT    NOT NULL DEFAULT 'Default',
                ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;

            UPDATE ${table} SET is_default = TRUE;

            -- workspace_id alone is no longer unique (many profiles per
            -- workspace); uniqueness moves to (workspace_id, name).
            ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_workspace_id_key;
            DROP INDEX IF EXISTS ${table}_workspace_id_key;

            ALTER TABLE ${table}
                ADD CONSTRAINT ${table}_workspace_id_name_key UNIQUE (workspace_id, name);

            CREATE INDEX ${table}_workspace_id_idx ON ${table} (workspace_id);

            -- At most one default profile per workspace, enforced in the DB so
            -- an app-layer bug can never produce two.
            CREATE UNIQUE INDEX ${table}_one_default_per_workspace
                ON ${table} (workspace_id) WHERE is_default;
        `);
    }
};

exports.down = (pgm) => {
    for (const table of TABLES) {
        pgm.sql(`
            -- Collapse back to one row per workspace: keep the default, drop the rest.
            DELETE FROM ${table} WHERE is_default = FALSE;

            DROP INDEX IF EXISTS ${table}_one_default_per_workspace;
            DROP INDEX IF EXISTS ${table}_workspace_id_idx;
            ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_workspace_id_name_key;

            ALTER TABLE ${table} ADD CONSTRAINT ${table}_workspace_id_key UNIQUE (workspace_id);

            ALTER TABLE ${table}
                DROP COLUMN name,
                DROP COLUMN is_default;
        `);
    }
};
