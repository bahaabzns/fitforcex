// The nutrition workspace-library query (LoadPlanModal's "Load Plan" picker)
// walks nutrition_plans -> nutrition_cycles -> nutrition_meals ->
// nutrition_meal_items -> food_items via nested LATERAL joins to compute
// real macros per plan. None of those FK columns were indexed, so every
// level of the join was a sequential scan, multiplying across plans x
// cycles x meals x items -- the cause of the slow "Load Nutrition Plan"
// modal coaches reported. training_days/training_exercises/training_sets
// already have the equivalent indexes, which is why the training picker
// wasn't slow.
exports.up = (pgm) => {
    pgm.createIndex('nutrition_plans', 'workspace_id', { ifNotExists: true });
    pgm.createIndex('nutrition_plans', 'client_id', { ifNotExists: true });
    pgm.createIndex('nutrition_cycles', 'plan_id', { ifNotExists: true });
    pgm.createIndex('nutrition_meals', 'cycle_id', { ifNotExists: true });
    pgm.createIndex('nutrition_meal_items', 'meal_id', { ifNotExists: true });
    pgm.createIndex('nutrition_meal_items', 'food_item_id', { ifNotExists: true });
    pgm.createIndex('nutrition_meal_items', 'original_food_item_id', { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropIndex('nutrition_meal_items', 'original_food_item_id', { ifExists: true });
    pgm.dropIndex('nutrition_meal_items', 'food_item_id', { ifExists: true });
    pgm.dropIndex('nutrition_meal_items', 'meal_id', { ifExists: true });
    pgm.dropIndex('nutrition_meals', 'cycle_id', { ifExists: true });
    pgm.dropIndex('nutrition_cycles', 'plan_id', { ifExists: true });
    pgm.dropIndex('nutrition_plans', 'client_id', { ifExists: true });
    pgm.dropIndex('nutrition_plans', 'workspace_id', { ifExists: true });
};
