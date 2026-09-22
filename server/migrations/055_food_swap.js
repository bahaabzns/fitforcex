// Client Food Swap — lets a portal client replace a prescribed food with a
// nutritionally-equivalent alternative (backend-calculated grams only).
// original_* columns snapshot the coach's prescription so a swap can be
// reset; food_swap_history is an audit trail for support.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE nutrition_meal_items
            ADD COLUMN IF NOT EXISTS original_food_item_id TEXT REFERENCES food_items(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS original_amount        DECIMAL,
            ADD COLUMN IF NOT EXISTS is_swapped              BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS swapped_at              TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS swapped_by_client_id    TEXT REFERENCES clients(id) ON DELETE SET NULL;

        CREATE TABLE IF NOT EXISTS food_swap_history (
            id                 TEXT PRIMARY KEY,
            meal_item_id       TEXT NOT NULL REFERENCES nutrition_meal_items(id) ON DELETE CASCADE,
            client_id          TEXT REFERENCES clients(id) ON DELETE SET NULL,
            from_food_item_id  TEXT REFERENCES food_items(id) ON DELETE SET NULL,
            to_food_item_id    TEXT REFERENCES food_items(id) ON DELETE SET NULL,
            from_amount        DECIMAL,
            to_amount          DECIMAL,
            action             TEXT NOT NULL, -- 'swap' | 'reset'
            created_at         TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_food_swap_history_meal_item ON food_swap_history (meal_item_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_food_swap_history_client    ON food_swap_history (client_id);

        ALTER TABLE subscription_access_policies
            ADD COLUMN IF NOT EXISTS allow_food_swap BOOLEAN NOT NULL DEFAULT FALSE;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE subscription_access_policies DROP COLUMN IF EXISTS allow_food_swap;
        DROP TABLE IF EXISTS food_swap_history;
        ALTER TABLE nutrition_meal_items
            DROP COLUMN IF EXISTS original_food_item_id,
            DROP COLUMN IF EXISTS original_amount,
            DROP COLUMN IF EXISTS is_swapped,
            DROP COLUMN IF EXISTS swapped_at,
            DROP COLUMN IF EXISTS swapped_by_client_id;
    `);
};
