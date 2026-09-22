import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

async function createClient(workspaceId: string) {
    return testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Test',
            lname:        'Client',
            email:        `client-${createId()}@test.com`,
            workspace_id: workspaceId,
        },
    });
}

async function createSubscriptionTx(workspaceId: string, clientId: string, startDate: Date, duration: number) {
    return testPrisma.transactions.create({
        data: {
            id:                      createId(),
            transaction_code:        Math.floor(Math.random() * 90000) + 10000,
            workspace_id:            workspaceId,
            client_id:               clientId,
            client_name:             'Test Client',
            payment_method:          'cash',
            amount:                  100,
            status:                  'completed',
            duration,
            start_mode:              'custom',
            subscription_start_date: startDate,
        },
    });
}

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

async function createFood(workspaceId: string, overrides: Partial<{
    name_en: string; calories: number; protein: number; carbs: number; fats: number; servingSize: number | null; category: string;
}> = {}) {
    return testPrisma.food_items.create({
        data: {
            id:                   createId(),
            workspace_id:         workspaceId,
            name_en:              overrides.name_en ?? 'Chicken Breast',
            calories_per_serving: overrides.calories ?? 165,
            protein_per_serving:  overrides.protein ?? 31,
            carbs_per_serving:    overrides.carbs ?? 0,
            fats_per_serving:     overrides.fats ?? 3.6,
            serving_size:         'servingSize' in overrides ? overrides.servingSize : 100,
            serving_unit:         'g',
            food_category:        overrides.category ?? null,
        },
    });
}

/** Builds a full active nutrition plan (plan → cycle → meal → item) around one meal item. */
async function createActivePlanWithItem(workspaceId: string, clientId: string, foodId: string, amount = 200) {
    const plan = await testPrisma.nutrition_plans.create({
        data: { id: createId(), workspace_id: workspaceId, client_id: clientId, name: 'Test Plan', status: 'active' },
    });
    const cycle = await testPrisma.nutrition_cycles.create({
        data: { id: createId(), plan_id: plan.id, name: 'Cycle 1', cycle_order: 1 },
    });
    const meal = await testPrisma.nutrition_meals.create({
        data: { id: createId(), cycle_id: cycle.id, name: 'Breakfast', meal_order: 1 },
    });
    const item = await testPrisma.nutrition_meal_items.create({
        data: { id: createId(), meal_id: meal.id, food_item_id: foodId, amount, meal_item_order: 1 },
    });
    return { plan, cycle, meal, item };
}

describe('Client Food Swap', () => {
    let workspaceId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
    });

    describe('POST /api/client-portal/meal-items/:mealItemId/swap', () => {
        test('returns 401 when unauthenticated', async () => {
            const res = await request.post('/api/client-portal/meal-items/does-not-exist/swap').send({ alternativeFoodId: 'x' });
            expect(res.status).toBe(401);
        });

        test('returns 403 when the client\'s subscription policy has allow_food_swap off (Expired, no override)', async () => {
            const client = await createClient(workspaceId);
            await createSubscriptionTx(workspaceId, client.id, daysAgo(60), 30); // ended 30 days ago → Expired
            const originalFood = await createFood(workspaceId);
            const altFood = await createFood(workspaceId, { name_en: 'Turkey Breast' });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, originalFood.id);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.post(`/api/client-portal/meal-items/${item.id}/swap`)
                .set('Cookie', cookie)
                .send({ alternativeFoodId: altFood.id });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('ACCESS_RESTRICTED');
        });

        test('returns 400 when alternativeFoodId is missing', async () => {
            const client = await createClient(workspaceId);
            const originalFood = await createFood(workspaceId);
            const { item } = await createActivePlanWithItem(workspaceId, client.id, originalFood.id);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.post(`/api/client-portal/meal-items/${item.id}/swap`).set('Cookie', cookie).send({});
            expect(res.status).toBe(400);
        });

        test('returns 404 when the meal item belongs to a different client (tenant isolation)', async () => {
            const owner = await createClient(workspaceId);
            const intruder = await createClient(workspaceId);
            const originalFood = await createFood(workspaceId);
            const altFood = await createFood(workspaceId, { name_en: 'Turkey Breast' });
            const { item } = await createActivePlanWithItem(workspaceId, owner.id, originalFood.id);
            const intruderCookie = makeClientCookie(intruder.id, workspaceId);

            const res = await request.post(`/api/client-portal/meal-items/${item.id}/swap`)
                .set('Cookie', intruderCookie)
                .send({ alternativeFoodId: altFood.id });

            expect(res.status).toBe(404);
        });

        test('happy path: swaps the food, computes calorie-equivalent grams, and writes history', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fats: 3.6, servingSize: 100 });
            const turkey  = await createFood(workspaceId, { name_en: 'Turkey Breast', calories: 135, protein: 30, carbs: 0, fats: 1, servingSize: 100 });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id, 200);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.post(`/api/client-portal/meal-items/${item.id}/swap`)
                .set('Cookie', cookie)
                .send({ alternativeFoodId: turkey.id });

            expect(res.status).toBe(200);
            // targetCalories = (200/100)*165 = 330; equivalent turkey amount = (330/135)*100 = 244.4
            expect(res.body.calculatedAmount).toBeCloseTo(244.4, 1);
            expect(res.body.originalFood.foodItemId).toBe(chicken.id);
            expect(res.body.swappedFood.foodItemId).toBe(turkey.id);

            const updated = await testPrisma.nutrition_meal_items.findUnique({ where: { id: item.id } });
            expect(updated?.food_item_id).toBe(turkey.id);
            expect(updated?.is_swapped).toBe(true);
            expect(updated?.original_food_item_id).toBe(chicken.id);
            expect(Number(updated?.original_amount)).toBe(200);

            const history = await testPrisma.food_swap_history.findMany({ where: { meal_item_id: item.id } });
            expect(history).toHaveLength(1);
            expect(history[0].action).toBe('swap');
            expect(history[0].from_food_item_id).toBe(chicken.id);
            expect(history[0].to_food_item_id).toBe(turkey.id);
        });

        test('returns 422 when the alternative is in a different food category', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', category: 'Protein' });
            const rice    = await createFood(workspaceId, { name_en: 'White Rice', category: 'Carbs' });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.post(`/api/client-portal/meal-items/${item.id}/swap`)
                .set('Cookie', cookie)
                .send({ alternativeFoodId: rice.id });

            expect(res.status).toBe(422);
        });

        test('swap-search only returns foods in the same category as the current item', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', category: 'Protein' });
            const turkey  = await createFood(workspaceId, { name_en: 'Turkey Breast', category: 'Protein' });
            const rice    = await createFood(workspaceId, { name_en: 'White Rice', category: 'Carbs' });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.get(`/api/client-portal/meal-items/${item.id}/swap-search`).set('Cookie', cookie);

            expect(res.status).toBe(200);
            const ids = res.body.alternatives.map((a: { foodItemId: string }) => a.foodItemId);
            expect(ids).toContain(turkey.id);
            expect(ids).not.toContain(rice.id);
        });

        test('swap-search returns every same-category alternative, unbounded by any page-size cap', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', category: 'Protein' });
            const alternatives = await Promise.all(
                Array.from({ length: 55 }, (_, i) =>
                    createFood(workspaceId, { name_en: `Protein Alt ${String(i).padStart(2, '0')}`, category: 'Protein' })
                )
            );
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.get(`/api/client-portal/meal-items/${item.id}/swap-search`).set('Cookie', cookie);

            expect(res.status).toBe(200);
            const ids = res.body.alternatives.map((a: { foodItemId: string }) => a.foodItemId);
            for (const alt of alternatives) {
                expect(ids).toContain(alt.id);
            }
        });

        test('swap-search includes a same-category food with 0 calories/serving, flagged as not calorie-matched', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', category: 'Protein' });
            // Black coffee: legitimately 0 kcal — calorie-matching is mathematically
            // undefined, but it's still a valid same-category swap option.
            const blackCoffee = await createFood(workspaceId, {
                name_en: 'Black Coffee', category: 'Protein', calories: 0, protein: 0, carbs: 0, fats: 0, servingSize: 250,
            });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id, 200);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.get(`/api/client-portal/meal-items/${item.id}/swap-search`).set('Cookie', cookie);

            expect(res.status).toBe(200);
            const alt = res.body.alternatives.find((a: { foodItemId: string }) => a.foodItemId === blackCoffee.id);
            expect(alt).toBeDefined();
            expect(alt.isCalorieMatched).toBe(false);
            expect(alt.calculatedAmount).toBe(250); // falls back to the food's own serving size
        });

        test('swap-search excludes a same-category food that has no serving_size at all', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', category: 'Protein' });
            const incomplete = await createFood(workspaceId, { name_en: 'Mystery Protein', category: 'Protein', servingSize: null });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id, 200);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.get(`/api/client-portal/meal-items/${item.id}/swap-search`).set('Cookie', cookie);

            expect(res.status).toBe(200);
            const ids = res.body.alternatives.map((a: { foodItemId: string }) => a.foodItemId);
            expect(ids).not.toContain(incomplete.id);
        });

        test('swap succeeds against a 0-calorie alternative, using its own serving size', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', category: 'Protein' });
            const blackCoffee = await createFood(workspaceId, {
                name_en: 'Black Coffee', category: 'Protein', calories: 0, protein: 0, carbs: 0, fats: 0, servingSize: 250,
            });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id, 200);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.post(`/api/client-portal/meal-items/${item.id}/swap`)
                .set('Cookie', cookie)
                .send({ alternativeFoodId: blackCoffee.id });

            expect(res.status).toBe(200);
            expect(res.body.calculatedAmount).toBe(250);
            expect(res.body.calories).toBe(0);
        });

        test('a second swap keeps the true original snapshot (does not overwrite it with the first swap target)', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', calories: 165, protein: 31, servingSize: 100 });
            const turkey  = await createFood(workspaceId, { name_en: 'Turkey Breast', calories: 135, protein: 30, servingSize: 100 });
            const tuna    = await createFood(workspaceId, { name_en: 'Tuna', calories: 116, protein: 26, servingSize: 100 });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id, 200);
            const cookie = makeClientCookie(client.id, workspaceId);

            await request.post(`/api/client-portal/meal-items/${item.id}/swap`).set('Cookie', cookie).send({ alternativeFoodId: turkey.id });
            await request.post(`/api/client-portal/meal-items/${item.id}/swap`).set('Cookie', cookie).send({ alternativeFoodId: tuna.id });

            const updated = await testPrisma.nutrition_meal_items.findUnique({ where: { id: item.id } });
            expect(updated?.food_item_id).toBe(tuna.id);
            expect(updated?.original_food_item_id).toBe(chicken.id);
            expect(Number(updated?.original_amount)).toBe(200);
        });
    });

    describe('POST /api/client-portal/meal-items/:mealItemId/swap/reset', () => {
        test('restores the original food and amount, and clears the swap flags', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId, { name_en: 'Chicken Breast', calories: 165, protein: 31, servingSize: 100 });
            const turkey  = await createFood(workspaceId, { name_en: 'Turkey Breast', calories: 135, protein: 30, servingSize: 100 });
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id, 200);
            const cookie = makeClientCookie(client.id, workspaceId);

            await request.post(`/api/client-portal/meal-items/${item.id}/swap`).set('Cookie', cookie).send({ alternativeFoodId: turkey.id });

            const res = await request.post(`/api/client-portal/meal-items/${item.id}/swap/reset`).set('Cookie', cookie);
            expect(res.status).toBe(200);
            expect(res.body.foodItemId).toBe(chicken.id);
            expect(res.body.amount).toBe(200);

            const updated = await testPrisma.nutrition_meal_items.findUnique({ where: { id: item.id } });
            expect(updated?.food_item_id).toBe(chicken.id);
            expect(Number(updated?.amount)).toBe(200);
            expect(updated?.is_swapped).toBe(false);
            expect(updated?.original_food_item_id).toBeNull();

            const history = await testPrisma.food_swap_history.findMany({ where: { meal_item_id: item.id }, orderBy: { created_at: 'asc' } });
            expect(history).toHaveLength(2);
            expect(history[1].action).toBe('reset');
        });

        test('returns 409 when the item was never swapped', async () => {
            const client = await createClient(workspaceId);
            const chicken = await createFood(workspaceId);
            const { item } = await createActivePlanWithItem(workspaceId, client.id, chicken.id);
            const cookie = makeClientCookie(client.id, workspaceId);

            const res = await request.post(`/api/client-portal/meal-items/${item.id}/swap/reset`).set('Cookie', cookie);
            expect(res.status).toBe(409);
        });
    });
});
