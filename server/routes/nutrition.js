const express = require('express');
const router = express.Router();

const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/food-items', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM food_items WHERE coach_id = $1 ORDER BY name ASC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/food-items', async (req, res) => {
    const { 
        name, 
        food_category, 
        serving_size, 
        serving_unit,
        calories_per_serving, 
        carbs_per_serving, 
        protein_per_serving, 
        fats_per_serving,

    } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO food_items (name, food_category, serving_size, serving_unit, calories_per_serving, carbs_per_serving, protein_per_serving, fats_per_serving, coach_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [name, food_category, serving_size, serving_unit, calories_per_serving, carbs_per_serving, protein_per_serving, fats_per_serving, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/food-items/:id', async (req, res) => {
    const { 
        name, 
        food_category, 
        serving_size, 
        serving_unit,
        calories_per_serving, 
        carbs_per_serving, 
        protein_per_serving, 
        fats_per_serving  } = req.body;
    try {
        const result = await pool.query(
            'UPDATE food_items SET name = $1, food_category = $2, serving_size = $3, serving_unit = $4, calories_per_serving = $5, carbs_per_serving = $6, protein_per_serving = $7, fats_per_serving = $8 WHERE id = $9 AND coach_id = $10 RETURNING *',
            [name, food_category, serving_size, serving_unit, calories_per_serving, carbs_per_serving, protein_per_serving, fats_per_serving, req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Food item not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/food-items/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM food_items WHERE id = $1 AND coach_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Food item not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Food Categories ───────────────────────────────────────────────────────────

router.get('/food-categories', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT fc.*, COUNT(fi.id)::int AS food_item_count
             FROM food_categories fc
             LEFT JOIN food_items fi ON fi.food_category = fc.name AND fi.coach_id = fc.coach_id
             WHERE fc.coach_id = $1
             GROUP BY fc.id
             ORDER BY fc.name ASC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/food-categories', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO food_categories (name, coach_id) VALUES ($1, $2) RETURNING *',
            [name, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/food-categories/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const oldResult = await pool.query(
            'SELECT name FROM food_categories WHERE id = $1 AND coach_id = $2',
            [req.params.id, req.user.id]
        );
        if (oldResult.rows.length === 0) {
            return res.status(404).json({ error: 'Food category not found' });
        }
        const oldName = oldResult.rows[0].name;

        const result = await pool.query(
            'UPDATE food_categories SET name = $1 WHERE id = $2 AND coach_id = $3 RETURNING *',
            [name, req.params.id, req.user.id]
        );

        await pool.query(
            'UPDATE food_items SET food_category = $1 WHERE food_category = $2 AND coach_id = $3',
            [name, oldName, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/food-categories/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM food_categories WHERE id = $1 AND coach_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Food category not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});











router.get('/plans', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT np.*,
                (SELECT COUNT(*) FROM nutrition_cycles WHERE plan_id = np.id)::int AS cycle_count
             FROM nutrition_plans np
             WHERE np.coach_id = $1 AND np.client_id = $2
             ORDER BY np.created_at DESC`,
            [req.user.id, req.query.clientId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/plans/:id', async (req, res) => {
    try {
        const planResult = await pool.query(
            'SELECT * FROM nutrition_plans WHERE id = $1 AND coach_id = $2',
            [req.params.id, req.user.id]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({ error: 'Nutrition plan not found' });
        }

        const cyclesResult = await pool.query(
            'SELECT * FROM nutrition_cycles WHERE plan_id = $1 ORDER BY cycle_order ASC',
            [req.params.id]
        );

        
        const mealsResult = await Promise.all(cyclesResult.rows.map(cycle =>
            pool.query(
                'SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC',
                [cycle.id]
            )
        ));


        const cycles = await Promise.all(
            cyclesResult.rows.map(async (cycle, cycleIndex) => {
                const meals = mealsResult[cycleIndex].rows;
                const mealsWithItems = await Promise.all(
                    meals.map(async meal => {
                        const itemsResult = await pool.query(
                            'SELECT nmi.id, nmi.amount, nmi.meal_item_order, fi.name, fi.serving_unit, fi.calories_per_serving, fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id WHERE nmi.meal_id = $1 ORDER BY nmi.meal_item_order ASC',
                            [meal.id]
                        );
                        const itemsWithAlts = await Promise.all(
                            itemsResult.rows.map(async item => {
                                const altsResult = await pool.query(
                                    `SELECT nmia.id, nmia.meal_item_id, nmia.amount, nmia.alt_order,
                                            fi.name, fi.serving_unit, fi.calories_per_serving,
                                            fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size
                                     FROM nutrition_meal_item_alternatives nmia
                                     JOIN food_items fi ON fi.id = nmia.food_item_id
                                     WHERE nmia.meal_item_id = $1
                                     ORDER BY nmia.alt_order ASC`,
                                    [item.id]
                                );
                                return { ...item, alternatives: altsResult.rows };
                            })
                        );
                        return {
                            ...meal,
                            items: itemsWithAlts
                        };
                    })
                );
                return {
                    ...cycle,
                    meals: mealsWithItems
                };
            })
        );

        res.json({
            id: planResult.rows[0].id,
            name: planResult.rows[0].name,
            client_id: planResult.rows[0].client_id,
            status: planResult.rows[0].status,
            created_at: planResult.rows[0].created_at,
            updated_at: planResult.rows[0].updated_at,
            cycles: cycles
        });



        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/plans', async (req, res) => {
    const {
        name,
        client_id
    } = req.body;

    try {
        const planResult = await pool.query(
            'INSERT INTO nutrition_plans (name, client_id, coach_id) VALUES ($1, $2, $3) RETURNING *',
            [name, client_id, req.user.id]
        );

        const defaultCycleResult = await pool.query(
            'INSERT INTO nutrition_cycles (plan_id, name) VALUES ($1, $2) RETURNING *',
            [planResult.rows[0].id, 'Cycle 1']
        );

        res.status(201).json( planResult.rows[0] );

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/plans/:id', async (req, res) => {
    const { name, status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE nutrition_plans SET name = $1, status = $2, updated_at = NOW() WHERE id = $3 AND coach_id = $4 RETURNING *',
            [name, status, req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found or you do not have permission to update it' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/plans/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM nutrition_plans WHERE id = $1 AND coach_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plan not found or you do not have permission to delete it' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/plans/:id/duplicate', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch original plan
        const originalPlan = await client.query(
            'SELECT * FROM nutrition_plans WHERE id = $1 AND coach_id = $2',
            [req.params.id, req.user.id]
        );
        if (originalPlan.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Plan not found' });
        }
        const plan = originalPlan.rows[0];

        // 2. Insert new plan
        const newPlan = await client.query(
            'INSERT INTO nutrition_plans (name, client_id, coach_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [`Copy of ${plan.name}`, plan.client_id, req.user.id, plan.status]
        );
        const newPlanId = newPlan.rows[0].id;

        // 3. Fetch original cycles
        const cycles = await client.query(
            'SELECT * FROM nutrition_cycles WHERE plan_id = $1 ORDER BY cycle_order ASC',
            [plan.id]
        );

        for (const cycle of cycles.rows) {
            // 4. Insert new cycle
            const newCycle = await client.query(
                'INSERT INTO nutrition_cycles (plan_id, name, cycle_order) VALUES ($1, $2, $3) RETURNING *',
                [newPlanId, cycle.name, cycle.cycle_order]
            );
            const newCycleId = newCycle.rows[0].id;

            // 5. Fetch original meals
            const meals = await client.query(
                'SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC',
                [cycle.id]
            );

            for (const meal of meals.rows) {
                // 6. Insert new meal
                const newMeal = await client.query(
                    'INSERT INTO nutrition_meals (cycle_id, name, meal_order) VALUES ($1, $2, $3) RETURNING *',
                    [newCycleId, meal.name, meal.meal_order]
                );
                const newMealId = newMeal.rows[0].id;

                // 7. Fetch original meal items
                const items = await client.query(
                    'SELECT * FROM nutrition_meal_items WHERE meal_id = $1 ORDER BY meal_item_order ASC',
                    [meal.id]
                );

                for (const item of items.rows) {
                    await client.query(
                        'INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order) VALUES ($1, $2, $3, $4)',
                        [newMealId, item.food_item_id, item.amount, item.meal_item_order]
                    );
                }
            }
        }

        await client.query('COMMIT');

        // Return new plan with cycle_count
        const result = await pool.query(
            `SELECT np.*, (SELECT COUNT(*) FROM nutrition_cycles WHERE plan_id = np.id)::int AS cycle_count
             FROM nutrition_plans np WHERE np.id = $1`,
            [newPlanId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});











router.post('/cycles/:id/duplicate', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const cycleResult = await client.query(
            'SELECT * FROM nutrition_cycles WHERE id = $1',
            [req.params.id]
        );
        if (cycleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Cycle not found' });
        }
        const cycle = cycleResult.rows[0];

        const nextOrderResult = await client.query(
            'SELECT COALESCE(MAX(cycle_order), 0) + 1 AS next_order FROM nutrition_cycles WHERE plan_id = $1',
            [cycle.plan_id]
        );
        const newCycle = await client.query(
            'INSERT INTO nutrition_cycles (plan_id, name, cycle_order) VALUES ($1, $2, $3) RETURNING *',
            [cycle.plan_id, `Copy of ${cycle.name}`, nextOrderResult.rows[0].next_order]
        );
        const newCycleId = newCycle.rows[0].id;

        const meals = await client.query(
            'SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC',
            [cycle.id]
        );
        for (const meal of meals.rows) {
            const newMeal = await client.query(
                'INSERT INTO nutrition_meals (cycle_id, name, meal_order) VALUES ($1, $2, $3) RETURNING *',
                [newCycleId, meal.name, meal.meal_order]
            );
            const items = await client.query(
                'SELECT * FROM nutrition_meal_items WHERE meal_id = $1 ORDER BY meal_item_order ASC',
                [meal.id]
            );
            for (const item of items.rows) {
                await client.query(
                    'INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order) VALUES ($1, $2, $3, $4)',
                    [newMeal.rows[0].id, item.food_item_id, item.amount, item.meal_item_order]
                );
            }
        }

        await client.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = $1',
            [cycle.plan_id]
        );
        await client.query('COMMIT');

        const fullMeals = await pool.query(
            'SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC',
            [newCycleId]
        );
        const mealsWithItems = await Promise.all(fullMeals.rows.map(async (m) => {
            const itemsRes = await pool.query(
                'SELECT nmi.id, nmi.amount, nmi.meal_item_order, fi.name, fi.serving_unit, fi.calories_per_serving, fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id WHERE nmi.meal_id = $1 ORDER BY nmi.meal_item_order ASC',
                [m.id]
            );
            return { ...m, items: itemsRes.rows };
        }));
        res.status(201).json({ ...newCycle.rows[0], meals: mealsWithItems });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

router.post('/cycles', async (req, res) => {
    const { name, planId } = req.body;

    try {
        const nextOrderResult = await pool.query(
            'SELECT COALESCE(MAX(cycle_order), 0) + 1 AS next_order FROM nutrition_cycles WHERE plan_id = $1',
            [planId]
        );
        const nextOrder = nextOrderResult.rows[0].next_order;

        const cycleResult = await pool.query(
            'INSERT INTO nutrition_cycles (plan_id, name, cycle_order) VALUES ($1, $2, $3) RETURNING * ',
            [planId, name, nextOrder]
        );
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = $1',
            [planId]
        );
        res.status(201).json(cycleResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/cycles/:id', async (req, res) => {
    const { name, goal_calories, goal_protein, goal_carbs, goal_fats, note } = req.body;
    try {
        const result = await pool.query(
            `UPDATE nutrition_cycles
             SET name = $1,
                 note = COALESCE($3, note),
                 goal_calories = COALESCE($4, goal_calories),
                 goal_protein  = COALESCE($5, goal_protein),
                 goal_carbs    = COALESCE($6, goal_carbs),
                 goal_fats     = COALESCE($7, goal_fats)
             WHERE id = $2 RETURNING *`,
            [name, req.params.id, note ?? null, goal_calories ?? null, goal_protein ?? null, goal_carbs ?? null, goal_fats ?? null]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cycle not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/cycles/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM nutrition_cycles WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cycle not found' });
        }
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = $1',
            [result.rows[0].plan_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});




router.post('/meals/:id/duplicate', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const mealResult = await client.query(
            'SELECT * FROM nutrition_meals WHERE id = $1',
            [req.params.id]
        );
        if (mealResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Meal not found' });
        }
        const meal = mealResult.rows[0];

        const nextOrderResult = await client.query(
            'SELECT COALESCE(MAX(meal_order), 0) + 1 AS next_order FROM nutrition_meals WHERE cycle_id = $1',
            [meal.cycle_id]
        );
        const newMeal = await client.query(
            'INSERT INTO nutrition_meals (cycle_id, name, meal_order) VALUES ($1, $2, $3) RETURNING *',
            [meal.cycle_id, `Copy of ${meal.name}`, nextOrderResult.rows[0].next_order]
        );
        const newMealId = newMeal.rows[0].id;

        const items = await client.query(
            'SELECT * FROM nutrition_meal_items WHERE meal_id = $1 ORDER BY meal_item_order ASC',
            [meal.id]
        );
        for (const item of items.rows) {
            const newItem = await client.query(
                'INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order) VALUES ($1, $2, $3, $4) RETURNING *',
                [newMealId, item.food_item_id, item.amount, item.meal_item_order]
            );
            const alts = await client.query(
                'SELECT * FROM nutrition_meal_item_alternatives WHERE meal_item_id = $1 ORDER BY alt_order ASC',
                [item.id]
            );
            for (const alt of alts.rows) {
                await client.query(
                    'INSERT INTO nutrition_meal_item_alternatives (meal_item_id, food_item_id, amount, alt_order) VALUES ($1, $2, $3, $4)',
                    [newItem.rows[0].id, alt.food_item_id, alt.amount, alt.alt_order]
                );
            }
        }

        await client.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)',
            [meal.cycle_id]
        );
        await client.query('COMMIT');

        const itemsRes = await pool.query(
            'SELECT nmi.id, nmi.amount, nmi.meal_item_order, fi.name, fi.serving_unit, fi.calories_per_serving, fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id WHERE nmi.meal_id = $1 ORDER BY nmi.meal_item_order ASC',
            [newMealId]
        );
        const itemsWithAlts = await Promise.all(
            itemsRes.rows.map(async item => {
                const altsRes = await pool.query(
                    `SELECT nmia.id, nmia.meal_item_id, nmia.amount, nmia.alt_order,
                            fi.name, fi.serving_unit, fi.calories_per_serving,
                            fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size
                     FROM nutrition_meal_item_alternatives nmia
                     JOIN food_items fi ON fi.id = nmia.food_item_id
                     WHERE nmia.meal_item_id = $1 ORDER BY nmia.alt_order ASC`,
                    [item.id]
                );
                return { ...item, alternatives: altsRes.rows };
            })
        );
        res.status(201).json({ ...newMeal.rows[0], items: itemsWithAlts });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

router.post('/meals', async (req, res) => {
    const { name, cycleId } = req.body;

    try {
        const nextOrderResult = await pool.query(
            'SELECT COALESCE(MAX(meal_order), 0) + 1 AS next_order FROM nutrition_meals WHERE cycle_id = $1',
            [cycleId]
        );
        const nextOrder = nextOrderResult.rows[0].next_order;

        const mealResult = await pool.query(
            'INSERT INTO nutrition_meals (cycle_id, name, meal_order) VALUES ($1, $2, $3) RETURNING *',
            [cycleId, name, nextOrder]
        );
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)',
            [cycleId]
        );
        res.status(201).json(mealResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.put('/meals/:id', async (req, res) => {
    const { name, note } = req.body;
    try {
        const result = await pool.query(
            'UPDATE nutrition_meals SET name = $1, note = COALESCE($3, note) WHERE id = $2 RETURNING *',
            [name, req.params.id, note ?? null]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)',
            [result.rows[0].cycle_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/meals/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM nutrition_meals WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meal not found' });
        }
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)',
            [result.rows[0].cycle_id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});








router.post('/meal-items', async (req, res) => {
    const { mealId, foodItemId, amount } = req.body;

    try {
        const nextOrderResult = await pool.query(
            'SELECT COALESCE(MAX(meal_item_order), 0) + 1 AS next_order FROM nutrition_meal_items WHERE meal_id = $1',
            [mealId]
        );
        const nextOrder = nextOrderResult.rows[0].next_order;

        const itemResult = await pool.query(
            'INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [mealId, foodItemId, amount, nextOrder]
        );
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT nc.plan_id FROM nutrition_cycles nc JOIN nutrition_meals nm ON nm.cycle_id = nc.id WHERE nm.id = $1)',
            [mealId]
        );
        const itemDetailsResult = await pool.query(
            'SELECT nmi.id, nmi.amount, nmi.meal_item_order, fi.serving_unit, fi.name, fi.calories_per_serving, fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id WHERE nmi.id = $1',
            [itemResult.rows[0].id]
        );
        res.status(201).json(itemDetailsResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.put('/meal-items/reorder', async (req, res) => {
    const { items } = req.body; // [{ id: 3, order: 1 }, { id: 1, order: 2 }, ...]
    try {
        await Promise.all(
            items.map(item =>
                pool.query(
                    'UPDATE nutrition_meal_items SET meal_item_order = $1 WHERE id = $2',
                    [item.order, item.id]
                )
            )
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.put('/meal-items/:id', async (req, res) => {
    const { amount } = req.body;
    try {
        const result = await pool.query(
            'UPDATE nutrition_meal_items SET amount = $1 WHERE id = $2 RETURNING *',
            [amount, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meal item not found' });
        }
        const itemDetailsResult = await pool.query(
            'SELECT nmi.id, nmi.amount, nmi.meal_item_order, fi.serving_unit, fi.name, fi.calories_per_serving, fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id WHERE nmi.id = $1',
            [result.rows[0].id]
        );
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT nc.plan_id FROM nutrition_cycles nc JOIN nutrition_meals nm ON nm.cycle_id = nc.id WHERE nm.id = $1)',
            [result.rows[0].meal_id]
        );
        res.json(itemDetailsResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});




router.delete('/meal-items/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM nutrition_meal_items WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Meal item not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});




// ── Meal Item Alternatives ────────────────────────────────────────────────────

router.post('/meal-items/:id/alternatives', async (req, res) => {
    const { foodItemId, amount } = req.body;
    const mealItemId = req.params.id;
    try {
        const nextOrderResult = await pool.query(
            'SELECT COALESCE(MAX(alt_order), 0) + 1 AS next_order FROM nutrition_meal_item_alternatives WHERE meal_item_id = $1',
            [mealItemId]
        );
        const nextOrder = nextOrderResult.rows[0].next_order;

        const result = await pool.query(
            'INSERT INTO nutrition_meal_item_alternatives (meal_item_id, food_item_id, amount, alt_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [mealItemId, foodItemId, amount, nextOrder]
        );

        const details = await pool.query(
            `SELECT nmia.id, nmia.meal_item_id, nmia.amount, nmia.alt_order,
                    fi.name, fi.serving_unit, fi.calories_per_serving,
                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size
             FROM nutrition_meal_item_alternatives nmia
             JOIN food_items fi ON fi.id = nmia.food_item_id
             WHERE nmia.id = $1`,
            [result.rows[0].id]
        );

        res.status(201).json(details.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/meal-item-alternatives/:id', async (req, res) => {
    const { amount } = req.body;
    try {
        const result = await pool.query(
            'UPDATE nutrition_meal_item_alternatives SET amount = $1 WHERE id = $2 RETURNING *',
            [amount, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alternative not found' });
        }
        const details = await pool.query(
            `SELECT nmia.id, nmia.meal_item_id, nmia.amount, nmia.alt_order,
                    fi.name, fi.serving_unit, fi.calories_per_serving,
                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size
             FROM nutrition_meal_item_alternatives nmia
             JOIN food_items fi ON fi.id = nmia.food_item_id
             WHERE nmia.id = $1`,
            [result.rows[0].id]
        );
        res.json(details.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/meal-item-alternatives/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM nutrition_meal_item_alternatives WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alternative not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;