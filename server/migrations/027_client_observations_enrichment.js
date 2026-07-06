// Extends client_observations (added in 017) with the fields needed for the
// Observations module: a required title, a defaulted category, an optional
// severity, three narrow nullable "related item" FKs (exercise / food item /
// check-in-or-assessment), an optional attachment, and edit/soft-delete
// timestamps. All changes are additive — no existing column is dropped.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE client_observations
            ADD COLUMN IF NOT EXISTS title               TEXT,
            ADD COLUMN IF NOT EXISTS category             TEXT NOT NULL DEFAULT 'General',
            ADD COLUMN IF NOT EXISTS severity              TEXT,                     -- 'Low' | 'Medium' | 'High'
            ADD COLUMN IF NOT EXISTS exercise_library_id    TEXT REFERENCES exercise_library(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS food_item_id            TEXT REFERENCES food_items(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS form_request_id          TEXT REFERENCES form_requests(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS attachment_url            TEXT,
            ADD COLUMN IF NOT EXISTS updated_at                 TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS deleted_at                  TIMESTAMPTZ;

        -- content (the old sole free-text column) is now optional "Details" —
        -- title carries the one-line insight instead.
        ALTER TABLE client_observations ALTER COLUMN content DROP NOT NULL;

        -- Backfill title for pre-existing rows (legacy migration / seed data)
        -- before title is made required below.
        UPDATE client_observations
            SET title = NULLIF(LEFT(TRIM(content), 60), '')
            WHERE title IS NULL;
        UPDATE client_observations
            SET title = 'Observation'
            WHERE title IS NULL OR title = '';

        ALTER TABLE client_observations ALTER COLUMN title SET NOT NULL;

        -- The hot path: a client's feed, newest first, excluding soft-deletes.
        CREATE INDEX IF NOT EXISTS idx_observations_client_feed
            ON client_observations (client_id, deleted_at, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_observations_category
            ON client_observations (category);
        CREATE INDEX IF NOT EXISTS idx_observations_exercise_library_id
            ON client_observations (exercise_library_id);
        CREATE INDEX IF NOT EXISTS idx_observations_food_item_id
            ON client_observations (food_item_id);
        CREATE INDEX IF NOT EXISTS idx_observations_form_request_id
            ON client_observations (form_request_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP INDEX IF EXISTS idx_observations_client_feed;
        DROP INDEX IF EXISTS idx_observations_category;
        DROP INDEX IF EXISTS idx_observations_exercise_library_id;
        DROP INDEX IF EXISTS idx_observations_food_item_id;
        DROP INDEX IF EXISTS idx_observations_form_request_id;

        ALTER TABLE client_observations
            DROP COLUMN IF EXISTS title,
            DROP COLUMN IF EXISTS category,
            DROP COLUMN IF EXISTS severity,
            DROP COLUMN IF EXISTS exercise_library_id,
            DROP COLUMN IF EXISTS food_item_id,
            DROP COLUMN IF EXISTS form_request_id,
            DROP COLUMN IF EXISTS attachment_url,
            DROP COLUMN IF EXISTS updated_at,
            DROP COLUMN IF EXISTS deleted_at;

        ALTER TABLE client_observations ALTER COLUMN content SET NOT NULL;
    `);
};
