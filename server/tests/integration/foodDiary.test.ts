import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
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

async function createFood(workspaceId: string, overrides: Partial<{
    name_en: string; name_ar: string | null; calories: number; protein: number; carbs: number; fats: number; servingSize: number;
}> = {}) {
    return testPrisma.food_items.create({
        data: {
            id:                   createId(),
            workspace_id:         workspaceId,
            name_en:              overrides.name_en ?? 'Chicken Breast',
            name_ar:              overrides.name_ar ?? null,
            calories_per_serving: overrides.calories ?? 200,
            protein_per_serving:  overrides.protein ?? 30,
            carbs_per_serving:    overrides.carbs ?? 0,
            fats_per_serving:     overrides.fats ?? 5,
            serving_size:         overrides.servingSize ?? 100,
            serving_unit:         'g',
        },
    });
}

/** Builds a full active nutrition plan (plan → cycle → meal → item) around one meal item. */
async function createActivePlanWithItem(workspaceId: string, clientId: string, foodId: string, opts: {
    amount?: number; cycleOrder?: number; cycleName?: string; goalCalories?: number | null; goalProtein?: number | null;
} = {}) {
    const plan = await testPrisma.nutrition_plans.create({
        data: { id: createId(), workspace_id: workspaceId, client_id: clientId, name: 'Test Plan', status: 'active' },
    });
    const cycle = await testPrisma.nutrition_cycles.create({
        data: {
            id: createId(), plan_id: plan.id, name: opts.cycleName ?? 'Cycle 1', cycle_order: opts.cycleOrder ?? 1,
            goal_calories: opts.goalCalories ?? 800, goal_protein: opts.goalProtein ?? 100,
        },
    });
    const meal = await testPrisma.nutrition_meals.create({
        data: { id: createId(), cycle_id: cycle.id, name: 'Breakfast', meal_order: 1 },
    });
    const item = await testPrisma.nutrition_meal_items.create({
        data: { id: createId(), meal_id: meal.id, food_item_id: foodId, amount: opts.amount ?? 200, meal_item_order: 1 },
    });
    return { plan, cycle, meal, item };
}

describe('Food Diary — client portal', () => {
    let workspaceId: string;
    let clientA: { id: string };
    let cookieA: string;
    let food: { id: string };

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        clientA = await createClient(workspaceId);
        cookieA = makeClientCookie(clientA.id, workspaceId);
        food = await createFood(workspaceId);
    });

    describe('GET /food-diary/today', () => {
        test('returns null when the client has no active nutrition plan', async () => {
            const res = await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);
            expect(res.status).toBe(200);
            expect(res.body).toBeNull();
        });

        test('creates a snapshot from the active plan on first access', async () => {
            const { item } = await createActivePlanWithItem(workspaceId, clientA.id, food.id, { amount: 200 });

            const res = await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);
            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].meal_item_id).toBe(item.id);
            expect(res.body.items[0].prescribed_amount).toBe(200);
            expect(res.body.items[0].amount_eaten).toBe(0);
            expect(res.body.items[0].name_en).toBe('Chicken Breast');
            expect(res.body.total_calories).toBe(0); // nothing eaten yet
            expect(res.body.goal_calories).toBe(800);

            const rows = await testPrisma.food_diary_entries.findMany({ where: { client_id: clientA.id } });
            expect(rows).toHaveLength(1);
        });

        test('a second call returns the same entry, does not create a duplicate', async () => {
            await createActivePlanWithItem(workspaceId, clientA.id, food.id);

            const first = await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);
            const second = await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);
            expect(second.body.id).toBe(first.body.id);

            const rows = await testPrisma.food_diary_entries.findMany({ where: { client_id: clientA.id } });
            expect(rows).toHaveLength(1);
        });

        test('with multiple cycles, an explicit cycle_id picks which one is snapshotted on first creation', async () => {
            const plan = await testPrisma.nutrition_plans.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: clientA.id, name: 'Multi-cycle Plan', status: 'active' },
            });
            const restDay = await testPrisma.nutrition_cycles.create({
                data: { id: createId(), plan_id: plan.id, name: 'Rest Day', cycle_order: 1, goal_calories: 1800 },
            });
            const trainingDay = await testPrisma.nutrition_cycles.create({
                data: { id: createId(), plan_id: plan.id, name: 'Training Day', cycle_order: 2, goal_calories: 2400 },
            });
            const trainingMeal = await testPrisma.nutrition_meals.create({
                data: { id: createId(), cycle_id: trainingDay.id, name: 'Breakfast', meal_order: 1 },
            });
            await testPrisma.nutrition_meal_items.create({
                data: { id: createId(), meal_id: trainingMeal.id, food_item_id: food.id, amount: 150, meal_item_order: 1 },
            });

            const res = await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .query({ cycle_id: trainingDay.id });
            expect(res.status).toBe(200);
            expect(res.body.cycle_id).toBe(trainingDay.id);
            expect(res.body.goal_calories).toBe(2400);
            void restDay;
        });

        test('unauthenticated request is rejected with 401', async () => {
            const res = await request.get('/api/client-portal/food-diary/today');
            expect(res.status).toBe(401);
        });
    });

    describe('PATCH /food-diary/today', () => {
        test('recomputes totals from the snapshot\'s per-serving values when amount_eaten changes', async () => {
            // 200 cal / 30 protein / 0 carbs / 5 fat per 100g serving, item amount 200g.
            const { item } = await createActivePlanWithItem(workspaceId, clientA.id, food.id, { amount: 200 });
            await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA); // creates the snapshot

            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: item.id, amount_eaten: 200 }); // ate the full prescribed amount
            expect(res.status).toBe(200);
            expect(res.body.total_calories).toBe(400); // (200/100) * 200
            expect(res.body.total_protein).toBe(60);    // (200/100) * 30
            expect(res.body.total_fats).toBe(10);        // (200/100) * 5
            expect(res.body.items[0].amount_eaten).toBe(200);

            const row = await testPrisma.food_diary_entries.findFirst({ where: { client_id: clientA.id } });
            expect(Number(row!.total_calories)).toBe(400);
        });

        test('supports a partial amount eaten, not just the full prescribed amount', async () => {
            const { item } = await createActivePlanWithItem(workspaceId, clientA.id, food.id, { amount: 200 });
            await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);

            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: item.id, amount_eaten: 50 }); // ate only 50g of the 200g prescribed
            expect(res.status).toBe(200);
            expect(res.body.total_calories).toBe(100); // (50/100) * 200
            expect(res.body.items[0].amount_eaten).toBe(50);
        });

        test('creates today\'s entry on first call if none exists yet (PATCH before any GET)', async () => {
            const { item } = await createActivePlanWithItem(workspaceId, clientA.id, food.id);
            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: item.id, amount_eaten: 100 });
            expect(res.status).toBe(200);

            const rows = await testPrisma.food_diary_entries.findMany({ where: { client_id: clientA.id } });
            expect(rows).toHaveLength(1);
        });

        test('an unknown meal_item_id (not part of today\'s snapshot) returns 404', async () => {
            await createActivePlanWithItem(workspaceId, clientA.id, food.id);
            await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);

            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: 'not-a-real-item', amount_eaten: 50 });
            expect(res.status).toBe(404);
        });

        test('no active plan and no existing entry returns 404', async () => {
            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: 'anything', amount_eaten: 50 });
            expect(res.status).toBe(404);
        });

        test('rejects a negative amount_eaten with 400', async () => {
            const { item } = await createActivePlanWithItem(workspaceId, clientA.id, food.id);
            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: item.id, amount_eaten: -5 });
            expect(res.status).toBe(400);
        });

        test('rejects a missing meal_item_id with 400', async () => {
            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ amount_eaten: 50 });
            expect(res.status).toBe(400);
        });

        test('cannot target another client\'s meal item via that client\'s own item id (each client\'s snapshot is independent)', async () => {
            const otherClient = await createClient(workspaceId);
            const otherFood = await createFood(workspaceId);
            const { item: otherItem } = await createActivePlanWithItem(workspaceId, otherClient.id, otherFood.id);
            const otherCookie = makeClientCookie(otherClient.id, workspaceId);
            await request.get('/api/client-portal/food-diary/today').set('Cookie', otherCookie);

            await createActivePlanWithItem(workspaceId, clientA.id, food.id);
            await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);

            // clientA's own snapshot doesn't contain otherClient's item id, so this 404s
            // rather than silently touching otherClient's row.
            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: otherItem.id, amount_eaten: 100 });
            expect(res.status).toBe(404);

            const otherEntry = await testPrisma.food_diary_entries.findFirst({ where: { client_id: otherClient.id } });
            const otherItemState = (otherEntry!.items as Array<Record<string, unknown>>).find((i) => i.meal_item_id === otherItem.id);
            expect(otherItemState!.amount_eaten).toBe(0); // untouched
        });
    });

    describe('GET /food-diary/history', () => {
        test('returns entries most-recent first, scoped to the calling client', async () => {
            const otherClient = await createClient(workspaceId);
            await testPrisma.food_diary_entries.create({
                data: { id: createId(), client_id: clientA.id, workspace_id: workspaceId, date: new Date('2026-06-01'), items: [] },
            });
            await testPrisma.food_diary_entries.create({
                data: { id: createId(), client_id: clientA.id, workspace_id: workspaceId, date: new Date('2026-06-03'), items: [] },
            });
            await testPrisma.food_diary_entries.create({
                data: { id: createId(), client_id: otherClient.id, workspace_id: workspaceId, date: new Date('2026-06-02'), items: [] },
            });

            const res = await request.get('/api/client-portal/food-diary/history').set('Cookie', cookieA);
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(new Date(res.body[0].date).getTime()).toBeGreaterThan(new Date(res.body[1].date).getTime());
        });

        test('unauthenticated request is rejected with 401', async () => {
            const res = await request.get('/api/client-portal/food-diary/history');
            expect(res.status).toBe(401);
        });
    });

    describe('adherence calculation', () => {
        test('averages calorie + protein adherence against the snapshotted goals', async () => {
            // goal_calories: 800, goal_protein: 100 (from createActivePlanWithItem's defaults).
            // Eating the full 200g item gives 400 kcal (50% of 800) and 60g protein (60% of 100) -> avg 55%.
            const { item } = await createActivePlanWithItem(workspaceId, clientA.id, food.id, { amount: 200 });
            await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);
            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: item.id, amount_eaten: 200 });
            expect(res.body.adherence).toBe(55);
        });

        test('caps adherence at 100% when intake exceeds the goal', async () => {
            // goal_calories: 800, goal_protein: 100. Eating 400g of a 200g-serving item gives
            // 800 kcal (100% of 800, not 200%) and 120g protein (capped at 100%, not 120%) -> avg 100.
            const { item } = await createActivePlanWithItem(workspaceId, clientA.id, food.id, { amount: 200 });
            await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);
            const res = await request.patch('/api/client-portal/food-diary/today').set('Cookie', cookieA)
                .send({ meal_item_id: item.id, amount_eaten: 400 });
            expect(res.body.adherence).toBe(100);
        });

        test('is null (not 0%) when the cycle has no goals set at all', async () => {
            const plan = await testPrisma.nutrition_plans.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: clientA.id, name: 'No Goals Plan', status: 'active' },
            });
            await testPrisma.nutrition_cycles.create({
                data: { id: createId(), plan_id: plan.id, name: 'Cycle 1', cycle_order: 1 }, // no goal_* fields set
            });

            const res = await request.get('/api/client-portal/food-diary/today').set('Cookie', cookieA);
            expect(res.body.adherence).toBeNull();
        });
    });
});

describe('Food Diary — coach view', () => {
    let workspaceId: string;
    let coachCookie: string;
    let clientA: { id: string };
    let otherWorkspaceId: string;
    let clientB: { id: string };

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        coachCookie = await makeAuthCookie(user.id, workspaceId);
        clientA = await createClient(workspaceId);

        const otherUser = await createTestUser();
        const otherWs = await createTestWorkspace(otherUser.id);
        otherWorkspaceId = otherWs.id;
        clientB = await createClient(otherWorkspaceId);
    });

    test('rejects an unauthenticated request with 401', async () => {
        const res = await request.get(`/api/clients/${clientA.id}/food-diary`);
        expect(res.status).toBe(401);
    });

    test('lists a workspace client\'s diary entries with adherence', async () => {
        await testPrisma.food_diary_entries.create({
            data: {
                id: createId(), client_id: clientA.id, workspace_id: workspaceId, date: new Date('2026-06-01'),
                items: [], total_calories: 400, goal_calories: 800,
            },
        });

        const res = await request.get(`/api/clients/${clientA.id}/food-diary`).set('Cookie', coachCookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].adherence).toBe(50);
    });

    test('cannot read a client in another workspace (tenant isolation)', async () => {
        await testPrisma.food_diary_entries.create({
            data: { id: createId(), client_id: clientB.id, workspace_id: otherWorkspaceId, date: new Date('2026-06-01'), items: [] },
        });
        const res = await request.get(`/api/clients/${clientB.id}/food-diary`).set('Cookie', coachCookie);
        expect(res.status).toBe(404);
    });

    describe('GET /food-diary/adherence', () => {
        test('rejects an unauthenticated request with 401', async () => {
            const res = await request.get(`/api/clients/${clientA.id}/food-diary/adherence`);
            expect(res.status).toBe(401);
        });

        test('cannot read adherence for a client in another workspace (tenant isolation)', async () => {
            const res = await request.get(`/api/clients/${clientB.id}/food-diary/adherence`).set('Cookie', coachCookie);
            expect(res.status).toBe(404);
        });

        test('returns empty plans and least-adherent items when the client has no diary entries', async () => {
            const res = await request.get(`/api/clients/${clientA.id}/food-diary/adherence`).set('Cookie', coachCookie);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ plans: [], leastAdherentItems: [], dailySeries: [] });
        });

        test('rolls up adherence per plan, most recently active plan first, and ranks the least-adherent food item', async () => {
            const planX = await testPrisma.nutrition_plans.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: clientA.id, name: 'Plan X', status: 'inactive' },
            });
            const planY = await testPrisma.nutrition_plans.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: clientA.id, name: 'Plan Y', status: 'active' },
            });

            const bananaItem = (amountEaten: number) => ([{
                meal_item_id: 'mi1', food_item_id: 'banana', meal_name: 'Breakfast', name_en: 'Banana', name_ar: null,
                prescribed_amount: 100, amount_eaten: amountEaten, serving_unit: 'g', serving_size: 100,
                calories_per_serving: 90, protein_per_serving: 1, carbs_per_serving: 23, fats_per_serving: 0,
            }]);
            const riceItem = [{
                meal_item_id: 'mi2', food_item_id: 'rice', meal_name: 'Lunch', name_en: 'Rice', name_ar: null,
                prescribed_amount: 200, amount_eaten: 200, serving_unit: 'g', serving_size: 200,
                calories_per_serving: 260, protein_per_serving: 5, carbs_per_serving: 56, fats_per_serving: 1,
            }];

            // Plan X: two days, banana at 20% then 100% eaten (avg 60%); day adherence 50% then 100% (avg 75%).
            await testPrisma.food_diary_entries.create({
                data: {
                    id: createId(), client_id: clientA.id, workspace_id: workspaceId, plan_id: planX.id,
                    date: new Date('2026-06-01'), items: bananaItem(20), total_calories: 400, goal_calories: 800,
                },
            });
            await testPrisma.food_diary_entries.create({
                data: {
                    id: createId(), client_id: clientA.id, workspace_id: workspaceId, plan_id: planX.id,
                    date: new Date('2026-06-02'), items: bananaItem(100), total_calories: 800, goal_calories: 800,
                },
            });
            // Plan Y: one day, rice fully eaten (100%); day adherence 100%. Later date than Plan X.
            await testPrisma.food_diary_entries.create({
                data: {
                    id: createId(), client_id: clientA.id, workspace_id: workspaceId, plan_id: planY.id,
                    date: new Date('2026-07-01'), items: riceItem, total_calories: 1000, goal_calories: 1000,
                },
            });

            const res = await request.get(`/api/clients/${clientA.id}/food-diary/adherence`).set('Cookie', coachCookie);
            expect(res.status).toBe(200);
            expect(res.body.plans).toHaveLength(2);

            const [first, second] = res.body.plans;
            expect(first.planId).toBe(planY.id);
            expect(first.planName).toBe('Plan Y');
            expect(first.entryCount).toBe(1);
            expect(first.avgAdherence).toBe(100);
            expect(first.leastAdherentItems).toEqual([{ food_item_id: 'rice', name_en: 'Rice', name_ar: null, avg_pct: 100, occurrences: 1 }]);

            expect(second.planId).toBe(planX.id);
            expect(second.planName).toBe('Plan X');
            expect(second.entryCount).toBe(2);
            expect(second.avgAdherence).toBe(75);
            expect(second.leastAdherentItems).toEqual([{ food_item_id: 'banana', name_en: 'Banana', name_ar: null, avg_pct: 60, occurrences: 2 }]);

            expect(res.body.leastAdherentItems.map((i: { food_item_id: string }) => i.food_item_id)).toEqual(['banana', 'rice']);

            // Daily series backs the trend chart -- oldest first, one point per day, tagged with its plan.
            expect(res.body.dailySeries).toEqual([
                { date: '2026-06-01T00:00:00.000Z', adherence: 50, planId: planX.id },
                { date: '2026-06-02T00:00:00.000Z', adherence: 100, planId: planX.id },
                { date: '2026-07-01T00:00:00.000Z', adherence: 100, planId: planY.id },
            ]);
        });

        test('skips items with no prescribed amount instead of dividing by zero', async () => {
            const plan = await testPrisma.nutrition_plans.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: clientA.id, name: 'Zero Plan', status: 'active' },
            });
            await testPrisma.food_diary_entries.create({
                data: {
                    id: createId(), client_id: clientA.id, workspace_id: workspaceId, plan_id: plan.id, date: new Date('2026-06-01'),
                    items: [{
                        meal_item_id: 'mi1', food_item_id: 'mystery', meal_name: 'Snack', name_en: 'Mystery Snack', name_ar: null,
                        prescribed_amount: 0, amount_eaten: 5, serving_unit: 'g', serving_size: 100,
                        calories_per_serving: 100, protein_per_serving: 1, carbs_per_serving: 1, fats_per_serving: 1,
                    }],
                },
            });

            const res = await request.get(`/api/clients/${clientA.id}/food-diary/adherence`).set('Cookie', coachCookie);
            expect(res.status).toBe(200);
            expect(res.body.plans[0].leastAdherentItems).toEqual([]);
            expect(res.body.leastAdherentItems).toEqual([]);
        });

        test('caps a per-item ratio at 100% when more than the prescribed amount was eaten', async () => {
            const plan = await testPrisma.nutrition_plans.create({
                data: { id: createId(), workspace_id: workspaceId, client_id: clientA.id, name: 'Overeaten Plan', status: 'active' },
            });
            await testPrisma.food_diary_entries.create({
                data: {
                    id: createId(), client_id: clientA.id, workspace_id: workspaceId, plan_id: plan.id, date: new Date('2026-06-01'),
                    items: [{
                        meal_item_id: 'mi1', food_item_id: 'protein-bar', meal_name: 'Snack', name_en: 'Protein Bar', name_ar: null,
                        prescribed_amount: 50, amount_eaten: 150, serving_unit: 'g', serving_size: 50,
                        calories_per_serving: 200, protein_per_serving: 20, carbs_per_serving: 15, fats_per_serving: 5,
                    }],
                },
            });

            const res = await request.get(`/api/clients/${clientA.id}/food-diary/adherence`).set('Cookie', coachCookie);
            expect(res.status).toBe(200);
            expect(res.body.plans[0].leastAdherentItems).toEqual([{ food_item_id: 'protein-bar', name_en: 'Protein Bar', name_ar: null, avg_pct: 100, occurrences: 1 }]);
        });
    });
});
