import pool from '../../db';
import { serializePlanRow } from '../../lib/planEngine';

type Row = Record<string, unknown>;

/**
 * Fetches a nutrition plan with its full cycles -> meals -> items(+alternatives)
 * tree, scoped to a workspace. Shared by the JSON plan-detail endpoint and the
 * PDF export controller so both always render the exact same data — extracted
 * out of nutrition.controller.ts's getPlan rather than duplicated.
 */
export async function fetchFullNutritionPlan(planId: string, workspaceId: string) {
    const planResult = await pool.query(
        `SELECT np.*, TRIM(CONCAT(u.fname, ' ', u.lname)) AS last_edited_by_name
         FROM nutrition_plans np
         LEFT JOIN users u ON u.id = np.last_edited_by
         WHERE np.id = $1 AND np.workspace_id = $2`,
        [planId, workspaceId]
    );
    if (!planResult.rows.length) return null;

    const cyclesResult = await pool.query(
        'SELECT * FROM nutrition_cycles WHERE plan_id = $1 ORDER BY cycle_order ASC',
        [planId]
    );

    const mealsResult = await Promise.all(
        (cyclesResult.rows as Row[]).map((cycle) =>
            pool.query('SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC', [cycle.id])
        )
    );

    const cycles = await Promise.all(
        (cyclesResult.rows as Row[]).map(async (cycle, cycleIndex) => {
            const meals = mealsResult[cycleIndex].rows as Row[];
            const mealsWithItems = await Promise.all(
                meals.map(async (meal) => {
                    const itemsResult = await pool.query(
                        // Coach view always reflects the coach's own prescription, never a
                        // client's food swap — COALESCE falls back to original_* only while
                        // is_swapped is true, so neither the builder nor the export ever
                        // silently shows what the client swapped to as if the coach had
                        // prescribed it.
                        `SELECT nmi.id, nmi.meal_item_order, nmi.is_swapped, nmi.swapped_at,
                                COALESCE(nmi.original_food_item_id, nmi.food_item_id) AS food_item_id,
                                COALESCE(nmi.original_amount, nmi.amount) AS amount,
                                fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                                fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                                fi.serving_size, fi.food_category
                         FROM nutrition_meal_items nmi
                         JOIN food_items fi ON fi.id = COALESCE(nmi.original_food_item_id, nmi.food_item_id)
                         WHERE nmi.meal_id = $1 ORDER BY nmi.meal_item_order ASC`,
                        [meal.id]
                    );
                    const itemsWithAlts = await Promise.all(
                        (itemsResult.rows as Row[]).map(async (item) => {
                            const altsResult = await pool.query(
                                `SELECT nmia.id, nmia.meal_item_id, nmia.food_item_id, nmia.amount, nmia.alt_order,
                                        fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                                        fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                                        fi.serving_size, fi.food_category
                                 FROM nutrition_meal_item_alternatives nmia
                                 JOIN food_items fi ON fi.id = nmia.food_item_id
                                 WHERE nmia.meal_item_id = $1 ORDER BY nmia.alt_order ASC`,
                                [item.id]
                            );
                            return { ...item, alternatives: altsResult.rows };
                        })
                    );
                    return { ...meal, items: itemsWithAlts };
                })
            );
            return { ...cycle, meals: mealsWithItems };
        })
    );

    const serializedPlan = serializePlanRow(planResult.rows[0] as Row)!;
    return { ...serializedPlan, cycles };
}

export function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * The coach portal's food-equivalence formula (ported from
 * client/hooks/useNutritionPlan.js), now the single source of truth so the
 * client-portal food swap can reuse it server-side instead of trusting a
 * client-supplied amount. Matches calories only, by design — same as the
 * coach-side "add alternative" flow.
 */
export function calculateEquivalentAmount(
    source: { amount: number; servingSize: number; caloriesPerServing: number },
    target: { servingSize: number; caloriesPerServing: number }
): number | null {
    if (!source.servingSize || !source.caloriesPerServing) return null;
    if (!target.servingSize || !target.caloriesPerServing) return null;

    const targetCalories = (source.amount / source.servingSize) * source.caloriesPerServing;
    return Math.round((targetCalories / target.caloriesPerServing) * target.servingSize * 10) / 10;
}

/**
 * Wraps calculateEquivalentAmount with a fallback for foods whose library
 * entry is missing calorie data or genuinely has 0 kcal/serving (water,
 * black coffee, spices) — calorie-matching is mathematically undefined for
 * those, but the food is still a legitimate same-category swap target.
 * Falls back to "1 serving" of the target instead of dropping it outright.
 * Only returns null when the target has no serving_size at all, i.e. there
 * is no quantity we could offer in the first place (a data-entry gap, not a
 * math edge case).
 */
export function resolveSwapAmount(
    source: { amount: number; servingSize: number; caloriesPerServing: number },
    target: { servingSize: number; caloriesPerServing: number }
): { amount: number; isCalorieMatched: boolean } | null {
    const equivalent = calculateEquivalentAmount(source, target);
    if (equivalent != null) return { amount: equivalent, isCalorieMatched: true };

    if (!target.servingSize) return null;
    return { amount: target.servingSize, isCalorieMatched: false };
}
