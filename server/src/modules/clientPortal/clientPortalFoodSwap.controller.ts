import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { resolveSwapAmount } from '../nutrition/nutrition.service';

type Row = Record<string, unknown>;

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Loads a meal item only if it belongs to an active nutrition plan owned by
 * this client — the tenant/ownership check every swap endpoint below relies
 * on. Returns null (→ 404 by the caller) for any mismatch, including plans
 * that exist but aren't active, so a client can never touch another
 * client's plan or a draft/archived one.
 */
async function getOwnedMealItemContext(clientId: string, mealItemId: string): Promise<Row | null> {
    const rows = await prisma.$queryRaw<Row[]>`
        SELECT nmi.id, nmi.meal_id, nmi.food_item_id, nmi.amount,
               nmi.original_food_item_id, nmi.original_amount, nmi.is_swapped,
               np.id AS plan_id, np.client_id, np.status AS plan_status,
               fi.serving_size, fi.calories_per_serving, fi.protein_per_serving,
               fi.carbs_per_serving, fi.fats_per_serving, fi.food_category,
               fi.name_en AS food_name_en, fi.name_ar AS food_name_ar
        FROM nutrition_meal_items nmi
        JOIN nutrition_meals nm ON nm.id = nmi.meal_id
        JOIN nutrition_cycles nc ON nc.id = nm.cycle_id
        JOIN nutrition_plans np ON np.id = nc.plan_id
        LEFT JOIN food_items fi ON fi.id = nmi.food_item_id
        WHERE nmi.id = ${mealItemId} AND np.client_id = ${clientId} AND np.status = 'active'
    `;
    return rows[0] ?? null;
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function searchSwapAlternatives(req: Request, res: Response, next: NextFunction) {
    try {
        const mealItemId = req.params.mealItemId as string;
        const item = await getOwnedMealItemContext(req.client!.clientId, mealItemId);
        if (!item) return res.status(404).json({ message: 'Meal item not found' });

        const { query } = req.query as { query?: string };

        // Swaps are restricted to the same food group as the prescribed food
        // (protein → protein, etc.) so a substitution can never quietly change
        // the meal's composition beyond calories. No category on the current
        // food (legacy/uncategorized data) leaves the swap unrestricted.
        const foodCategory = item.food_category as string | null;

        const candidates = await prisma.food_items.findMany({
            where: {
                workspace_id: req.client!.workspaceId,
                id:           { not: item.food_item_id as string },
                ...(foodCategory ? { food_category: foodCategory } : {}),
                ...(query
                    ? { OR: [
                        { name_en: { contains: query, mode: 'insensitive' } },
                        { name_ar: { contains: query, mode: 'insensitive' } },
                    ] }
                    : {}),
            },
            // No cap: a coach's category must show every alternative it has,
            // not just the alphabetically-first slice. Categories are
            // curated/scoped by the coach, not user-generated, so unbounded
            // growth here isn't a realistic concern.
            orderBy: { name_en: 'asc' },
        });

        // food_items.food_category stores the category's name_en as a plain
        // string (not a foreign key) — look up its Arabic counterpart so the
        // client portal can render the category in the active locale.
        const categories = await prisma.food_categories.findMany({
            where: { workspace_id: req.client!.workspaceId },
        });
        const categoryNameAr = new Map(categories.map((c) => [c.name_en, c.name_ar]));

        const sourceAmount = Number(item.amount);
        const sourceServingSize = Number(item.serving_size);
        const sourceCalories = Number(item.calories_per_serving);

        const alternatives = candidates
            .map((food) => {
                // Foods with no calorie data, or genuinely 0 kcal/serving (water,
                // black coffee, spices), can't be calorie-matched — offer them at
                // their own serving size instead of hiding them from the category.
                const resolved = resolveSwapAmount(
                    { amount: sourceAmount, servingSize: sourceServingSize, caloriesPerServing: sourceCalories },
                    { servingSize: Number(food.serving_size), caloriesPerServing: Number(food.calories_per_serving) }
                );
                if (resolved == null) return null;

                const { amount: calculatedAmount, isCalorieMatched } = resolved;
                const ratio = calculatedAmount / Number(food.serving_size);
                return {
                    foodItemId:      food.id,
                    name:            food.name_en,
                    nameAr:          food.name_ar,
                    servingUnit:     food.serving_unit,
                    foodCategory:    food.food_category,
                    foodCategoryAr:  food.food_category ? categoryNameAr.get(food.food_category) ?? null : null,
                    calculatedAmount,
                    isCalorieMatched,
                    calories:        round1(ratio * Number(food.calories_per_serving)),
                    protein:         round1(ratio * Number(food.protein_per_serving)),
                    carbs:           round1(ratio * Number(food.carbs_per_serving)),
                    fat:             round1(ratio * Number(food.fats_per_serving)),
                };
            })
            .filter((row): row is NonNullable<typeof row> => row != null);

        res.json({
            currentFood: {
                foodItemId: item.food_item_id,
                name:       item.food_name_en,
                nameAr:     item.food_name_ar,
                amount:     sourceAmount,
            },
            alternatives,
        });
    } catch (err) { next(err); }
}

// ── Swap ────────────────────────────────────────────────────────────────────

export async function swapMealItemFood(req: Request, res: Response, next: NextFunction) {
    try {
        const mealItemId = req.params.mealItemId as string;
        const { alternativeFoodId } = req.body as { alternativeFoodId?: unknown };
        if (typeof alternativeFoodId !== 'string' || !alternativeFoodId) {
            return res.status(400).json({ message: 'alternativeFoodId is required' });
        }

        const item = await getOwnedMealItemContext(req.client!.clientId, mealItemId);
        if (!item) return res.status(404).json({ message: 'Meal item not found' });
        if (item.food_item_id === alternativeFoodId) {
            return res.status(409).json({ message: 'This food is already active for this item' });
        }

        const altFood = await prisma.food_items.findFirst({
            where: { id: alternativeFoodId, workspace_id: req.client!.workspaceId },
        });
        if (!altFood) return res.status(404).json({ message: 'Alternative food not found' });

        // Same enforcement as the search endpoint — re-checked here so a
        // crafted request can't swap outside the food group the search UI
        // already restricts to.
        const foodCategory = item.food_category as string | null;
        if (foodCategory && altFood.food_category !== foodCategory) {
            return res.status(422).json({ message: 'Alternative must be from the same food category' });
        }

        const resolved = resolveSwapAmount(
            { amount: Number(item.amount), servingSize: Number(item.serving_size), caloriesPerServing: Number(item.calories_per_serving) },
            { servingSize: Number(altFood.serving_size), caloriesPerServing: Number(altFood.calories_per_serving) }
        );
        if (resolved == null) {
            return res.status(422).json({ message: 'Cannot compute an equivalent amount for this food' });
        }
        const { amount: calculatedAmount } = resolved;

        const fromFoodItemId = item.food_item_id as string;
        const fromAmount = Number(item.amount);
        const wasAlreadySwapped = item.is_swapped === true;

        await prisma.$transaction([
            prisma.nutrition_meal_items.update({
                where: { id: mealItemId },
                data: {
                    food_item_id:          alternativeFoodId,
                    amount:                calculatedAmount,
                    is_swapped:            true,
                    swapped_at:            new Date(),
                    swapped_by_client_id:  req.client!.clientId,
                    // Keep the true original on repeat swaps — only snapshot
                    // once, the first time this item is ever swapped.
                    ...(wasAlreadySwapped ? {} : {
                        original_food_item_id: fromFoodItemId,
                        original_amount:       fromAmount,
                    }),
                },
            }),
            prisma.food_swap_history.create({
                data: {
                    id:                createId(),
                    meal_item_id:      mealItemId,
                    client_id:         req.client!.clientId,
                    from_food_item_id: fromFoodItemId,
                    to_food_item_id:   alternativeFoodId,
                    from_amount:       fromAmount,
                    to_amount:         calculatedAmount,
                    action:            'swap',
                },
            }),
        ]);

        const ratio = calculatedAmount / Number(altFood.serving_size);
        res.json({
            originalFood:     { foodItemId: fromFoodItemId, name: item.food_name_en, amount: fromAmount },
            swappedFood:      { foodItemId: altFood.id, name: altFood.name_en, amount: calculatedAmount },
            calculatedAmount,
            calories:         round1(ratio * Number(altFood.calories_per_serving)),
            protein:          round1(ratio * Number(altFood.protein_per_serving)),
            carbs:            round1(ratio * Number(altFood.carbs_per_serving)),
            fat:              round1(ratio * Number(altFood.fats_per_serving)),
        });
    } catch (err) { next(err); }
}

// ── Reset ───────────────────────────────────────────────────────────────────

export async function resetMealItemFood(req: Request, res: Response, next: NextFunction) {
    try {
        const mealItemId = req.params.mealItemId as string;
        const item = await getOwnedMealItemContext(req.client!.clientId, mealItemId);
        if (!item) return res.status(404).json({ message: 'Meal item not found' });
        if (item.is_swapped !== true || item.original_food_item_id == null) {
            return res.status(409).json({ message: 'Nothing to reset' });
        }

        const fromFoodItemId = item.food_item_id as string;
        const fromAmount = Number(item.amount);
        const toFoodItemId = item.original_food_item_id as string;
        const toAmount = Number(item.original_amount);

        await prisma.$transaction([
            prisma.nutrition_meal_items.update({
                where: { id: mealItemId },
                data: {
                    food_item_id:           toFoodItemId,
                    amount:                 toAmount,
                    is_swapped:             false,
                    swapped_at:             null,
                    swapped_by_client_id:   null,
                    original_food_item_id:  null,
                    original_amount:        null,
                },
            }),
            prisma.food_swap_history.create({
                data: {
                    id:                createId(),
                    meal_item_id:      mealItemId,
                    client_id:         req.client!.clientId,
                    from_food_item_id: fromFoodItemId,
                    to_food_item_id:   toFoodItemId,
                    from_amount:       fromAmount,
                    to_amount:         toAmount,
                    action:            'reset',
                },
            }),
        ]);

        const restoredFood = await prisma.food_items.findUnique({ where: { id: toFoodItemId } });
        res.json({
            foodItemId: toFoodItemId,
            name:       restoredFood?.name_en ?? null,
            amount:     toAmount,
        });
    } catch (err) { next(err); }
}
