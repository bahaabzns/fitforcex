// Indexes for foreign-key columns that hot request paths filter or join by, found by
// the 2026-11 slowness investigation (pg_stat_user_tables showed millions of full-table
// scans and zero index use on these):
//   subscription_freezes.client_id             looked up per client on every portal/coach status check
//   nutrition_meal_item_alternatives.meal_item_id / food_item_id   portal nutrition join + FK cascades
//   form_requests.client_id                    portal form lists and per-client request lookups
//   transactions.client_id                     per-client status computation (every portal request)
//
// Plain CREATE INDEX (not CONCURRENTLY) on purpose: each table holds well under 30k rows,
// so the build takes milliseconds, and staying inside node-pg-migrate's transaction means a
// failure leaves nothing half-built. IF NOT EXISTS keeps it safe to re-run.
//
// Numbering note: 111 and 112 exist on other branches that are not on main yet. They must
// be merged and deployed before this file, or node-pg-migrate rejects them as out of order.
//
// Touches exactly: the five indexes below.
exports.up = (pgm) => {
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_subscription_freezes_client" ON "subscription_freezes" ("client_id");`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_nutrition_meal_item_alternatives_meal_item" ON "nutrition_meal_item_alternatives" ("meal_item_id");`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_nutrition_meal_item_alternatives_food_item" ON "nutrition_meal_item_alternatives" ("food_item_id");`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_form_requests_client" ON "form_requests" ("client_id");`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_transactions_client" ON "transactions" ("client_id");`);
};

exports.down = (pgm) => {
    pgm.sql(`DROP INDEX IF EXISTS "idx_transactions_client";`);
    pgm.sql(`DROP INDEX IF EXISTS "idx_form_requests_client";`);
    pgm.sql(`DROP INDEX IF EXISTS "idx_nutrition_meal_item_alternatives_food_item";`);
    pgm.sql(`DROP INDEX IF EXISTS "idx_nutrition_meal_item_alternatives_meal_item";`);
    pgm.sql(`DROP INDEX IF EXISTS "idx_subscription_freezes_client";`);
};
