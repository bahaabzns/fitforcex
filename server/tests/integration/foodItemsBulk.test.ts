import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { DEFAULT_PERMISSIONS } from '../../src/lib/defaultPermissions';

const BASE = '/api/nutrition/food-items';

async function createFood(workspaceId: string, name_en: string, food_category: string | null = null) {
    return testPrisma.food_items.create({
        data: {
            id: createId(), workspace_id: workspaceId, name_en, food_category,
            calories_per_serving: 100, protein_per_serving: 10, carbs_per_serving: 10, fats_per_serving: 1,
            serving_size: 100, serving_unit: 'g',
        },
    });
}

async function categoryOf(id: string) {
    return (await testPrisma.food_items.findUnique({ where: { id } }))?.food_category;
}

async function createPlanUsing(workspaceId: string, foodIds: string[]) {
    const client = await testPrisma.clients.create({
        data: { id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000, fname: 'T', lname: 'C', email: `c-${createId()}@test.com`, workspace_id: workspaceId },
    });
    const plan = await testPrisma.nutrition_plans.create({ data: { id: createId(), workspace_id: workspaceId, client_id: client.id, name: 'Plan', status: 'active' } });
    const cycle = await testPrisma.nutrition_cycles.create({ data: { id: createId(), plan_id: plan.id, name: 'C1', cycle_order: 1 } });
    const meal = await testPrisma.nutrition_meals.create({ data: { id: createId(), cycle_id: cycle.id, name: 'Lunch', meal_order: 1 } });
    for (const [index, foodId] of foodIds.entries()) {
        await testPrisma.nutrition_meal_items.create({ data: { id: createId(), meal_id: meal.id, food_item_id: foodId, amount: 100, meal_item_order: index + 1 } });
    }
    return plan;
}

describe('Food items — bulk actions', () => {
    let workspaceId: string;
    let cookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        workspaceId = (await createTestWorkspace(user.id)).id;
        cookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    const changeCategory = (body: unknown, withCookie = cookie) => request.put(`${BASE}/bulk-category`).set('Cookie', withCookie).send(body as object);
    const bulkDelete = (body: unknown, withCookie = cookie) => request.delete(BASE).set('Cookie', withCookie).send(body as object);
    const usage = (body: unknown, withCookie = cookie) => request.post(`${BASE}/bulk-usage`).set('Cookie', withCookie).send(body as object);

    describe('authentication and permissions', () => {
        test('returns 401 when unauthenticated', async () => {
            expect((await request.put(`${BASE}/bulk-category`).send({})).status).toBe(401);
            expect((await request.delete(BASE).send({})).status).toBe(401);
            expect((await request.post(`${BASE}/bulk-usage`).send({})).status).toBe(401);
        });

        test('a viewer (read-only) is denied every bulk action', async () => {
            const member = await createTestUser();
            const viewer = await makeAuthCookie(member.id, workspaceId, 'viewer', DEFAULT_PERMISSIONS.viewer);
            const food = await createFood(workspaceId, 'Rice', 'A');

            expect((await changeCategory({ ids: [food.id], food_category: '' }, viewer)).status).toBe(403);
            expect((await bulkDelete({ ids: [food.id] }, viewer)).status).toBe(403);
            expect((await usage({ ids: [food.id] }, viewer)).status).toBe(403);
            expect(await categoryOf(food.id)).toBe('A');
        });

        test('write without delete may change categories but not delete or check usage', async () => {
            const member = await createTestUser();
            const writeOnly = { ...DEFAULT_PERMISSIONS.manager, nutrition: { read: true, write: true, delete: false } };
            const memberCookie = await makeAuthCookie(member.id, workspaceId, 'manager', writeOnly);
            await testPrisma.food_categories.create({ data: { id: createId(), workspace_id: workspaceId, name_en: 'Carbs' } });
            const food = await createFood(workspaceId, 'Rice');

            expect((await changeCategory({ ids: [food.id], food_category: 'Carbs' }, memberCookie)).status).toBe(200);
            expect((await bulkDelete({ ids: [food.id] }, memberCookie)).status).toBe(403);
            expect((await usage({ ids: [food.id] }, memberCookie)).status).toBe(403);
            expect(await testPrisma.food_items.count({ where: { id: food.id } })).toBe(1);
        });
    });

    describe('PUT /food-items/bulk-category', () => {
        test('moves every selected item to the category and leaves the others alone', async () => {
            await testPrisma.food_categories.create({ data: { id: createId(), workspace_id: workspaceId, name_en: 'Protein Sources' } });
            const a = await createFood(workspaceId, 'Chicken', 'Poultry');
            const b = await createFood(workspaceId, 'Beef', 'Beef');
            const c = await createFood(workspaceId, 'Apple', 'Fruit');

            const res = await changeCategory({ ids: [a.id, b.id], food_category: 'Protein Sources' });

            expect(res.status).toBe(200);
            expect(res.body.updated).toBe(2);
            expect(await categoryOf(a.id)).toBe('Protein Sources');
            expect(await categoryOf(b.id)).toBe('Protein Sources');
            expect(await categoryOf(c.id)).toBe('Fruit');
        });

        test('clears the category when food_category is empty or null', async () => {
            const a = await createFood(workspaceId, 'A', 'X');
            const b = await createFood(workspaceId, 'B', 'X');

            expect((await changeCategory({ ids: [a.id], food_category: '' })).status).toBe(200);
            expect((await changeCategory({ ids: [b.id], food_category: null })).status).toBe(200);

            expect(await categoryOf(a.id)).toBeNull();
            expect(await categoryOf(b.id)).toBeNull();
        });

        test('returns 400 for a category that is not one of the workspace\'s, and writes nothing', async () => {
            const a = await createFood(workspaceId, 'A', 'X');
            const res = await changeCategory({ ids: [a.id], food_category: 'Does Not Exist' });
            expect(res.status).toBe(400);
            expect(await categoryOf(a.id)).toBe('X');
        });

        test('returns 400 for a missing/empty/invalid id list', async () => {
            expect((await changeCategory({ food_category: '' })).status).toBe(400);
            expect((await changeCategory({ ids: [], food_category: '' })).status).toBe(400);
            expect((await changeCategory({ ids: [1, 2], food_category: '' })).status).toBe(400);
        });

        test('returns 404 and changes nothing when any id belongs to another workspace', async () => {
            const other = await createTestUser();
            const otherWorkspaceId = (await createTestWorkspace(other.id)).id;
            const theirs = await createFood(otherWorkspaceId, 'Theirs', 'T');
            const mine = await createFood(workspaceId, 'Mine', 'M');

            const res = await changeCategory({ ids: [mine.id, theirs.id], food_category: '' });

            expect(res.status).toBe(404);
            expect(await categoryOf(mine.id)).toBe('M');
            expect(await categoryOf(theirs.id)).toBe('T');
        });

        test('a category of another workspace cannot be used as the target', async () => {
            const other = await createTestUser();
            const otherWorkspaceId = (await createTestWorkspace(other.id)).id;
            await testPrisma.food_categories.create({ data: { id: createId(), workspace_id: otherWorkspaceId, name_en: 'Theirs Only' } });
            const mine = await createFood(workspaceId, 'Mine', 'M');

            expect((await changeCategory({ ids: [mine.id], food_category: 'Theirs Only' })).status).toBe(400);
            expect(await categoryOf(mine.id)).toBe('M');
        });
    });

    describe('DELETE /food-items', () => {
        test('deletes every selected item and only those', async () => {
            const a = await createFood(workspaceId, 'A');
            const b = await createFood(workspaceId, 'B');
            const keep = await createFood(workspaceId, 'Keep');

            const res = await bulkDelete({ ids: [a.id, b.id] });

            expect(res.status).toBe(200);
            expect(res.body.deleted).toBe(2);
            expect(await testPrisma.food_items.count({ where: { workspace_id: workspaceId } })).toBe(1);
            expect(await testPrisma.food_items.findUnique({ where: { id: keep.id } })).not.toBeNull();
        });

        test('returns 404 and deletes nothing when any id belongs to another workspace', async () => {
            const other = await createTestUser();
            const otherWorkspaceId = (await createTestWorkspace(other.id)).id;
            const theirs = await createFood(otherWorkspaceId, 'Theirs');
            const mine = await createFood(workspaceId, 'Mine');

            const res = await bulkDelete({ ids: [mine.id, theirs.id] });

            expect(res.status).toBe(404);
            expect(await testPrisma.food_items.count({ where: { id: { in: [mine.id, theirs.id] } } })).toBe(2);
        });

        test('returns 400 for an invalid id list', async () => {
            expect((await bulkDelete({})).status).toBe(400);
            expect((await bulkDelete({ ids: [] })).status).toBe(400);
        });

        test('deleting a food removes the plan entries that use it (the cascade the usage warning describes)', async () => {
            const used = await createFood(workspaceId, 'Used');
            const other = await createFood(workspaceId, 'Other');
            await createPlanUsing(workspaceId, [used.id, other.id]);

            await bulkDelete({ ids: [used.id] });

            expect(await testPrisma.nutrition_meal_items.count({ where: { food_item_id: used.id } })).toBe(0);
            expect(await testPrisma.nutrition_meal_items.count({ where: { food_item_id: other.id } })).toBe(1);
        });
    });

    describe('POST /food-items/bulk-usage', () => {
        test('counts plan entries, distinct plans and alternatives that use the selected foods', async () => {
            const a = await createFood(workspaceId, 'A');
            const b = await createFood(workspaceId, 'B');
            const unused = await createFood(workspaceId, 'Unused');
            await createPlanUsing(workspaceId, [a.id, b.id]);
            await createPlanUsing(workspaceId, [a.id]);

            const res = await usage({ ids: [a.id, b.id, unused.id] });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ meal_items: 3, plans: 2, alternatives: 0 });
        });

        test('reports zero for foods that no plan uses', async () => {
            const a = await createFood(workspaceId, 'A');
            const res = await usage({ ids: [a.id] });
            expect(res.body).toEqual({ meal_items: 0, plans: 0, alternatives: 0 });
        });

        test('returns 404 for another workspace\'s food item', async () => {
            const other = await createTestUser();
            const otherWorkspaceId = (await createTestWorkspace(other.id)).id;
            const theirs = await createFood(otherWorkspaceId, 'Theirs');
            expect((await usage({ ids: [theirs.id] })).status).toBe(404);
        });
    });
});
