// Audit log for the coach "Merge categories" feature (nutrition/food-categories).
// One row per merge: who, when, which categories were folded into which, and the
// id + previous category string of every food item that moved — everything the
// "Undo last merge" action needs to put things back. It is a pure log: food_items
// and food_categories are not altered by this migration. target_category_id has no
// FK on purpose (the target may be renamed or deleted after the merge; undo copes).
exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "food_category_merges" (
            "id"                 TEXT PRIMARY KEY,
            "workspace_id"       TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
            "performed_by"       TEXT REFERENCES "users"("id") ON DELETE SET NULL,
            "target_category_id" TEXT NOT NULL,
            "target_name_en"     VARCHAR(100) NOT NULL,
            "target_created"     BOOLEAN NOT NULL DEFAULT FALSE,
            "source_categories"  JSONB NOT NULL,
            "moved_items"        JSONB NOT NULL,
            "items_moved"        INTEGER NOT NULL,
            "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "undone_at"          TIMESTAMPTZ(6),
            "undone_by"          TEXT REFERENCES "users"("id") ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS "food_category_merges_workspace_created_idx"
            ON "food_category_merges"("workspace_id", "created_at" DESC);
    `);
};

exports.down = (pgm) => {
    pgm.sql(`DROP TABLE IF EXISTS "food_category_merges";`);
};
