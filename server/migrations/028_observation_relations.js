// Adds observation_relations, a junction table that lets one observation link
// to multiple entities (exercise / food item / check-in / assessment) instead
// of the single-related-item model from migration 027. Additive only — the
// three legacy columns on client_observations are backfilled into this table
// but not dropped here; a later migration removes them once the app has fully
// cut over to reading/writing observation_relations exclusively.

exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE IF NOT EXISTS observation_relations (
            id                   TEXT PRIMARY KEY,
            observation_id       TEXT NOT NULL REFERENCES client_observations(id) ON DELETE CASCADE,
            exercise_library_id  TEXT REFERENCES exercise_library(id) ON DELETE CASCADE,
            food_item_id         TEXT REFERENCES food_items(id) ON DELETE CASCADE,
            form_request_id      TEXT REFERENCES form_requests(id) ON DELETE CASCADE,
            created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_observation_relations_observation_id ON observation_relations (observation_id);
        CREATE INDEX IF NOT EXISTS idx_observation_relations_exercise_library_id ON observation_relations (exercise_library_id);
        CREATE INDEX IF NOT EXISTS idx_observation_relations_food_item_id ON observation_relations (food_item_id);
        CREATE INDEX IF NOT EXISTS idx_observation_relations_form_request_id ON observation_relations (form_request_id);

        -- NULL is never equal to NULL in a unique constraint, so these only
        -- ever collide for two rows of the SAME type on the SAME observation.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_observation_relations_exercise ON observation_relations (observation_id, exercise_library_id);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_observation_relations_food_item ON observation_relations (observation_id, food_item_id);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_observation_relations_form_request ON observation_relations (observation_id, form_request_id);

        -- Backfill: one relation row per existing single-related-item observation.
        -- Ids are plain md5-derived hex strings (this table's ids are opaque,
        -- same as everywhere else in this schema — no prefix, no special format).
        INSERT INTO observation_relations (id, observation_id, exercise_library_id, created_at)
            SELECT substr(md5(random()::text || id || 'ex'), 1, 24), id, exercise_library_id, now()
            FROM client_observations
            WHERE exercise_library_id IS NOT NULL;

        INSERT INTO observation_relations (id, observation_id, food_item_id, created_at)
            SELECT substr(md5(random()::text || id || 'fd'), 1, 24), id, food_item_id, now()
            FROM client_observations
            WHERE food_item_id IS NOT NULL;

        INSERT INTO observation_relations (id, observation_id, form_request_id, created_at)
            SELECT substr(md5(random()::text || id || 'fr'), 1, 24), id, form_request_id, now()
            FROM client_observations
            WHERE form_request_id IS NOT NULL;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS observation_relations;
    `);
};
