import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { DEFAULT_PERMISSIONS } from '../../src/lib/defaultPermissions';

const BASE = '/api/nutrition/food-categories';

async function createCategory(workspaceId: string, name_en: string, name_ar: string | null = null) {
    return testPrisma.food_categories.create({ data: { id: createId(), workspace_id: workspaceId, name_en, name_ar } });
}

async function createFood(workspaceId: string, name_en: string, food_category: string | null, calories = 165) {
    return testPrisma.food_items.create({
        data: {
            id: createId(), workspace_id: workspaceId, name_en, food_category,
            calories_per_serving: calories, protein_per_serving: 20, carbs_per_serving: 0, fats_per_serving: 5,
            serving_size: 100, serving_unit: 'g',
        },
    });
}

async function categoryNames(workspaceId: string): Promise<string[]> {
    const rows = await testPrisma.food_categories.findMany({ where: { workspace_id: workspaceId }, orderBy: { name_en: 'asc' } });
    return rows.map((row) => row.name_en);
}

async function itemCategory(itemId: string): Promise<string | null | undefined> {
    return (await testPrisma.food_items.findUnique({ where: { id: itemId } }))?.food_category;
}

describe('Food category merge', () => {
    let workspaceId: string;
    let cookie: string;
    let userId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        userId = user.id;
        workspaceId = (await createTestWorkspace(user.id)).id;
        cookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    const merge = (body: unknown, withCookie = cookie) => request.post(`${BASE}/merge`).set('Cookie', withCookie).send(body as object);
    const preview = (body: unknown, withCookie = cookie) => request.post(`${BASE}/merge/preview`).set('Cookie', withCookie).send(body as object);
    const undo = (mergeId: string, withCookie = cookie) => request.post(`${BASE}/merges/${mergeId}/undo`).set('Cookie', withCookie);

    describe('authentication and permissions', () => {
        test('returns 401 when unauthenticated', async () => {
            expect((await request.post(`${BASE}/merge`).send({})).status).toBe(401);
            expect((await request.post(`${BASE}/merge/preview`).send({})).status).toBe(401);
            expect((await request.post(`${BASE}/merges/x/undo`)).status).toBe(401);
            expect((await request.get(`${BASE}/merges`)).status).toBe(401);
        });

        test.each(['viewer', 'trainer'])('returns 403 for a %s (no nutrition write/delete)', async (role) => {
            const member = await createTestUser();
            const memberCookie = await makeAuthCookie(member.id, workspaceId, role, DEFAULT_PERMISSIONS[role]);
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');

            const res = await merge({ sourceIds: [a.id, b.id], target: { id: a.id } }, memberCookie);

            expect(res.status).toBe(403);
            expect(await categoryNames(workspaceId)).toEqual(['A', 'B']);
        });

        test('returns 403 when the caller has nutrition.write but not nutrition.delete', async () => {
            const member = await createTestUser();
            const writeOnly = { ...DEFAULT_PERMISSIONS.manager, nutrition: { read: true, write: true, delete: false } };
            const memberCookie = await makeAuthCookie(member.id, workspaceId, 'manager', writeOnly);
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');

            expect((await merge({ sourceIds: [a.id, b.id], target: { id: a.id } }, memberCookie)).status).toBe(403);
            expect((await preview({ sourceIds: [a.id, b.id], target: { id: a.id } }, memberCookie)).status).toBe(403);
            expect(await categoryNames(workspaceId)).toEqual(['A', 'B']);
        });

        test('a nutritionist (read + write + delete) can merge', async () => {
            const member = await createTestUser();
            const memberCookie = await makeAuthCookie(member.id, workspaceId, 'nutritionist', DEFAULT_PERMISSIONS.nutritionist);
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');

            expect((await merge({ sourceIds: [a.id, b.id], target: { id: a.id } }, memberCookie)).status).toBe(201);
        });

        test('a read-only viewer can list merges', async () => {
            const member = await createTestUser();
            const memberCookie = await makeAuthCookie(member.id, workspaceId, 'viewer', DEFAULT_PERMISSIONS.viewer);
            const res = await request.get(`${BASE}/merges`).set('Cookie', memberCookie);
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('validation', () => {
        test('returns 400 for fewer than two distinct categories (including merging a category into itself)', async () => {
            const a = await createCategory(workspaceId, 'A');
            expect((await merge({ sourceIds: [], target: { name_en: 'X' } })).status).toBe(400);
            expect((await merge({ sourceIds: [a.id], target: { id: a.id } })).status).toBe(400);
            expect((await merge({ sourceIds: [a.id, a.id], target: { id: a.id } })).status).toBe(400);
            expect(await categoryNames(workspaceId)).toEqual(['A']);
        });

        test('returns 400 when the target is missing, empty, or not one of the selected categories', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const c = await createCategory(workspaceId, 'C');

            expect((await merge({ sourceIds: [a.id, b.id] })).status).toBe(400);
            expect((await merge({ sourceIds: [a.id, b.id], target: { name_en: '   ' } })).status).toBe(400);
            expect((await merge({ sourceIds: [a.id, b.id], target: { id: c.id } })).status).toBe(400);
            expect((await merge({ sourceIds: [a.id, b.id], target: { name_en: 'x'.repeat(101) } })).status).toBe(400);
            expect((await merge({ sourceIds: [a.id, b.id], target: { name_en: 'Ok', name_ar: 'ع'.repeat(101) } })).status).toBe(400);
            expect(await categoryNames(workspaceId)).toEqual(['A', 'B', 'C']);
        });

        test('returns 404 for an unknown category id', async () => {
            const a = await createCategory(workspaceId, 'A');
            const res = await merge({ sourceIds: [a.id, 'nope'], target: { id: a.id } });
            expect(res.status).toBe(404);
        });
    });

    describe('merging', () => {
        test('moves the right items, keeps the chosen category, removes the others, and leaves everything else alone', async () => {
            const beef = await createCategory(workspaceId, 'Beef Products', 'لحم');
            const poultry = await createCategory(workspaceId, 'Poultry Products');
            const fish = await createCategory(workspaceId, 'Finfish and Shellfish Products');
            const fruit = await createCategory(workspaceId, 'Fruits');
            const steak = await createFood(workspaceId, 'Steak', 'Beef Products');
            const chicken = await createFood(workspaceId, 'Chicken', 'Poultry Products');
            const salmon = await createFood(workspaceId, 'Salmon', 'Finfish and Shellfish Products');
            const apple = await createFood(workspaceId, 'Apple', 'Fruits');

            const res = await merge({ sourceIds: [beef.id, poultry.id], target: { id: beef.id } });

            expect(res.status).toBe(201);
            expect(res.body.items_moved).toBe(1); // only chicken; steak already holds the target name
            expect(res.body.target).toMatchObject({ id: beef.id, name_en: 'Beef Products', name_ar: 'لحم', is_new: false });
            expect(await categoryNames(workspaceId)).toEqual(['Beef Products', 'Finfish and Shellfish Products', 'Fruits']);
            expect(await itemCategory(steak.id)).toBe('Beef Products');
            expect(await itemCategory(chicken.id)).toBe('Beef Products');
            expect(await itemCategory(salmon.id)).toBe('Finfish and Shellfish Products');
            expect(await itemCategory(apple.id)).toBe('Fruits');
            expect(await testPrisma.food_items.count({ where: { workspace_id: workspaceId } })).toBe(4); // never deletes items
            expect(fish.id).toBeTruthy();
            expect(fruit.id).toBeTruthy();

            const log = await testPrisma.food_category_merges.findFirstOrThrow({ where: { workspace_id: workspaceId } });
            expect(log.performed_by).toBe(userId);
            expect(log.target_created).toBe(false);
            expect(log.moved_items).toEqual([{ id: chicken.id, from: 'Poultry Products' }]);
        });

        test('creates a new target with EN + AR names when the name is new', async () => {
            const a = await createCategory(workspaceId, 'Beef Products');
            const b = await createCategory(workspaceId, 'Poultry Products');
            const steak = await createFood(workspaceId, 'Steak', 'Beef Products');
            const chicken = await createFood(workspaceId, 'Chicken', 'Poultry Products');

            const res = await merge({ sourceIds: [a.id, b.id], target: { name_en: '  Protein   Sources ', name_ar: 'مصادر البروتين' } });

            expect(res.status).toBe(201);
            expect(res.body.target).toMatchObject({ name_en: 'Protein Sources', name_ar: 'مصادر البروتين', is_new: true });
            expect(await categoryNames(workspaceId)).toEqual(['Protein Sources']);
            const created = await testPrisma.food_categories.findFirstOrThrow({ where: { workspace_id: workspaceId } });
            expect(created.name_ar).toBe('مصادر البروتين');
            expect(await itemCategory(steak.id)).toBe('Protein Sources');
            expect(await itemCategory(chicken.id)).toBe('Protein Sources');
        });

        test('reuses an existing category when the new name matches case-insensitively (not selected)', async () => {
            const existing = await createCategory(workspaceId, 'Protein Sources', null);
            const a = await createCategory(workspaceId, 'Beef Products');
            const b = await createCategory(workspaceId, 'Poultry Products');
            const steak = await createFood(workspaceId, 'Steak', 'Beef Products');

            const res = await merge({ sourceIds: [a.id, b.id], target: { name_en: ' protein SOURCES', name_ar: 'مصادر البروتين' } });

            expect(res.status).toBe(201);
            expect(res.body.target).toMatchObject({ id: existing.id, name_en: 'Protein Sources', is_new: false });
            expect(await categoryNames(workspaceId)).toEqual(['Protein Sources']); // no duplicate
            expect(await itemCategory(steak.id)).toBe('Protein Sources');
            // the coach's category had no Arabic name, so it is filled in
            expect((await testPrisma.food_categories.findUniqueOrThrow({ where: { id: existing.id } })).name_ar).toBe('مصادر البروتين');
        });

        test('never overwrites an existing Arabic name when reusing a category', async () => {
            const existing = await createCategory(workspaceId, 'Protein Sources', 'اسم المدرب');
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');

            await merge({ sourceIds: [a.id, b.id], target: { name_en: 'protein sources', name_ar: 'غيره' } });

            expect((await testPrisma.food_categories.findUniqueOrThrow({ where: { id: existing.id } })).name_ar).toBe('اسم المدرب');
        });

        test('a new name matching one of the selected categories keeps that category as the target', async () => {
            const a = await createCategory(workspaceId, 'Dairy');
            const b = await createCategory(workspaceId, 'Dairy and Egg Products');
            const milk = await createFood(workspaceId, 'Milk', 'Dairy and Egg Products');

            const res = await merge({ sourceIds: [a.id, b.id], target: { name_en: 'dairy' } });

            expect(res.status).toBe(201);
            expect(res.body.target.id).toBe(a.id);
            expect(await categoryNames(workspaceId)).toEqual(['Dairy']);
            expect(await itemCategory(milk.id)).toBe('Dairy');
        });

        test('moves orphan items (category string with no row, or a case/spacing variant of a source name)', async () => {
            const a = await createCategory(workspaceId, 'Beef Products');
            const b = await createCategory(workspaceId, 'Poultry Products');
            const orphan = await createFood(workspaceId, 'Orphan Beef', 'beef   products'); // variant, no matching row
            const unrelatedOrphan = await createFood(workspaceId, 'Orphan Other', 'Grains');

            const previewRes = await preview({ sourceIds: [a.id, b.id], target: { id: b.id } });
            expect(previewRes.body.items_to_move).toBe(1);
            expect(previewRes.body.sources).toEqual([expect.objectContaining({ id: a.id, item_count: 1 })]);

            const res = await merge({ sourceIds: [a.id, b.id], target: { id: b.id } });

            expect(res.status).toBe(201);
            expect(await itemCategory(orphan.id)).toBe('Poultry Products');
            expect(await itemCategory(unrelatedOrphan.id)).toBe('Grains');
        });

        test('handles a merge with a single item in total, and categories with no items', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const c = await createCategory(workspaceId, 'C');
            const only = await createFood(workspaceId, 'Lonely', 'B');

            const res = await merge({ sourceIds: [a.id, b.id, c.id], target: { id: a.id } });

            expect(res.status).toBe(201);
            expect(res.body.items_moved).toBe(1);
            expect(await itemCategory(only.id)).toBe('A');
            expect(await categoryNames(workspaceId)).toEqual(['A']);
        });

        test('preview reports the same numbers as the merge and writes nothing', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            await createFood(workspaceId, 'One', 'A');
            await createFood(workspaceId, 'Two', 'B');
            await createFood(workspaceId, 'Three', 'B');

            const previewRes = await preview({ sourceIds: [a.id, b.id], target: { name_en: 'Merged' } });

            expect(previewRes.status).toBe(200);
            expect(previewRes.body.items_to_move).toBe(3);
            expect(previewRes.body.target).toMatchObject({ id: null, name_en: 'Merged', is_new: true });
            expect(previewRes.body.sources.map((s: { id: string }) => s.id).sort()).toEqual([a.id, b.id].sort());
            expect(await categoryNames(workspaceId)).toEqual(['A', 'B']);
            expect(await testPrisma.food_category_merges.count()).toBe(0);

            const mergeRes = await merge({ sourceIds: [a.id, b.id], target: { name_en: 'Merged' } });
            expect(mergeRes.body.items_moved).toBe(previewRes.body.items_to_move);
        });
    });

    describe('tenant isolation', () => {
        test('cannot merge, preview or undo another workspace\'s categories, and changes nothing', async () => {
            const otherUser = await createTestUser();
            const otherWorkspaceId = (await createTestWorkspace(otherUser.id)).id;
            const otherA = await createCategory(otherWorkspaceId, 'A');
            const otherB = await createCategory(otherWorkspaceId, 'B');
            const otherFood = await createFood(otherWorkspaceId, 'Theirs', 'B');
            const mine = await createCategory(workspaceId, 'Mine');

            const body = { sourceIds: [otherA.id, otherB.id], target: { id: otherA.id } };
            expect((await merge(body)).status).toBe(404);
            expect((await preview(body)).status).toBe(404);
            // one own + one foreign id is rejected as a whole
            expect((await merge({ sourceIds: [mine.id, otherA.id], target: { id: mine.id } })).status).toBe(404);

            expect(await categoryNames(otherWorkspaceId)).toEqual(['A', 'B']);
            expect(await itemCategory(otherFood.id)).toBe('B');
            expect(await categoryNames(workspaceId)).toEqual(['Mine']);

            // the other workspace's merge can't be undone from here
            const otherCookie = await makeAuthCookie(otherUser.id, otherWorkspaceId, 'owner');
            const theirMerge = await merge({ sourceIds: [otherA.id, otherB.id], target: { id: otherA.id } }, otherCookie);
            expect(theirMerge.status).toBe(201);
            expect((await undo(theirMerge.body.merge_id)).status).toBe(404);
            expect(await itemCategory(otherFood.id)).toBe('A');
        });

        test('same-named items and categories in other workspaces are never touched', async () => {
            const otherUser = await createTestUser();
            const otherWorkspaceId = (await createTestWorkspace(otherUser.id)).id;
            await createCategory(otherWorkspaceId, 'Beef Products');
            const otherSteak = await createFood(otherWorkspaceId, 'Steak', 'Beef Products');
            const a = await createCategory(workspaceId, 'Beef Products');
            const b = await createCategory(workspaceId, 'Poultry Products');
            await createFood(workspaceId, 'Steak', 'Beef Products');

            await merge({ sourceIds: [a.id, b.id], target: { name_en: 'Protein Sources' } });

            expect(await itemCategory(otherSteak.id)).toBe('Beef Products');
            expect(await categoryNames(otherWorkspaceId)).toEqual(['Beef Products']);
        });
    });

    describe('plans and swap', () => {
        async function createActivePlanWithItem(clientId: string, foodId: string) {
            const plan = await testPrisma.nutrition_plans.create({ data: { id: createId(), workspace_id: workspaceId, client_id: clientId, name: 'Plan', status: 'active' } });
            const cycle = await testPrisma.nutrition_cycles.create({ data: { id: createId(), plan_id: plan.id, name: 'Cycle 1', cycle_order: 1 } });
            const meal = await testPrisma.nutrition_meals.create({ data: { id: createId(), cycle_id: cycle.id, name: 'Lunch', meal_order: 1 } });
            return testPrisma.nutrition_meal_items.create({ data: { id: createId(), meal_id: meal.id, food_item_id: foodId, amount: 200, meal_item_order: 1 } });
        }

        test('swap works across the merged categories, and existing plans/history keep working', async () => {
            const client = await testPrisma.clients.create({
                data: { id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000, fname: 'T', lname: 'C', email: `c-${createId()}@test.com`, workspace_id: workspaceId },
            });
            const beefCat = await createCategory(workspaceId, 'Beef Products');
            const poultryCat = await createCategory(workspaceId, 'Poultry Products');
            const steak = await createFood(workspaceId, 'Steak', 'Beef Products', 250);
            const chicken = await createFood(workspaceId, 'Chicken Breast', 'Poultry Products', 165);
            const item = await createActivePlanWithItem(client.id, steak.id);
            const clientCookie = makeClientCookie(client.id, workspaceId);

            // Before the merge the two are different categories: not offered, and the swap is refused.
            const before = await request.get(`/api/client-portal/meal-items/${item.id}/swap-search`).set('Cookie', clientCookie);
            expect(before.body.alternatives).toEqual([]);
            const refused = await request.post(`/api/client-portal/meal-items/${item.id}/swap`).set('Cookie', clientCookie).send({ alternativeFoodId: chicken.id });
            expect(refused.status).toBe(422);

            await merge({ sourceIds: [beefCat.id, poultryCat.id], target: { name_en: 'Protein Sources', name_ar: 'مصادر البروتين' } });

            const unchangedItem = await testPrisma.nutrition_meal_items.findUniqueOrThrow({ where: { id: item.id } });
            expect(unchangedItem.food_item_id).toBe(steak.id); // plan untouched by the merge

            const after = await request.get(`/api/client-portal/meal-items/${item.id}/swap-search`).set('Cookie', clientCookie);
            expect(after.status).toBe(200);
            expect(after.body.alternatives.map((alt: { foodItemId: string }) => alt.foodItemId)).toEqual([chicken.id]);
            expect(after.body.alternatives[0].foodCategory).toBe('Protein Sources');
            expect(after.body.alternatives[0].foodCategoryAr).toBe('مصادر البروتين');

            const swapped = await request.post(`/api/client-portal/meal-items/${item.id}/swap`).set('Cookie', clientCookie).send({ alternativeFoodId: chicken.id });
            expect(swapped.status).toBe(200);
            expect(await testPrisma.food_swap_history.count({ where: { meal_item_id: item.id } })).toBe(1);
        });

        test('plan rows and swap history are identical before and after a merge and an undo', async () => {
            const client = await testPrisma.clients.create({
                data: { id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000, fname: 'T', lname: 'C', email: `c-${createId()}@test.com`, workspace_id: workspaceId },
            });
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const food = await createFood(workspaceId, 'F', 'A');
            const item = await createActivePlanWithItem(client.id, food.id);
            const snapshot = async () => testPrisma.nutrition_meal_items.findUniqueOrThrow({ where: { id: item.id } });
            const before = await snapshot();

            const res = await merge({ sourceIds: [a.id, b.id], target: { id: b.id } });
            expect(await snapshot()).toEqual(before);
            await undo(res.body.merge_id);
            expect(await snapshot()).toEqual(before);
        });
    });

    describe('undo', () => {
        test('restores the source categories (original ids), the items\' previous categories, and removes the created target', async () => {
            const a = await createCategory(workspaceId, 'Beef Products', 'لحم');
            const b = await createCategory(workspaceId, 'Poultry Products');
            const steak = await createFood(workspaceId, 'Steak', 'Beef Products');
            const chicken = await createFood(workspaceId, 'Chicken', 'Poultry Products');
            const orphan = await createFood(workspaceId, 'Variant', 'beef  products');
            const merged = await merge({ sourceIds: [a.id, b.id], target: { name_en: 'Protein Sources' } });

            const res = await undo(merged.body.merge_id);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ restored_items: 3, skipped_edited: 0, skipped_deleted: 0, recreated_categories: 2, target_removed: true });
            expect(await categoryNames(workspaceId)).toEqual(['Beef Products', 'Poultry Products']);
            const restoredA = await testPrisma.food_categories.findUniqueOrThrow({ where: { id: a.id } });
            expect(restoredA.name_ar).toBe('لحم');
            expect(await itemCategory(steak.id)).toBe('Beef Products');
            expect(await itemCategory(chicken.id)).toBe('Poultry Products');
            expect(await itemCategory(orphan.id)).toBe('beef  products'); // exactly as it was, orphan included
        });

        test('keeps a pre-existing target (only the sources come back)', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const food = await createFood(workspaceId, 'F', 'B');
            const merged = await merge({ sourceIds: [a.id, b.id], target: { id: a.id } });

            const res = await undo(merged.body.merge_id);

            expect(res.body.target_removed).toBe(false);
            expect(await categoryNames(workspaceId)).toEqual(['A', 'B']);
            expect(await itemCategory(food.id)).toBe('B');
        });

        test('skips and reports items edited or deleted after the merge, and restores the rest', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const untouched = await createFood(workspaceId, 'Untouched', 'B');
            const edited = await createFood(workspaceId, 'Edited', 'B');
            const deleted = await createFood(workspaceId, 'Deleted', 'B');
            const merged = await merge({ sourceIds: [a.id, b.id], target: { id: a.id } });

            await testPrisma.food_items.update({ where: { id: edited.id }, data: { food_category: 'Something Else' } });
            await testPrisma.food_items.delete({ where: { id: deleted.id } });

            const res = await undo(merged.body.merge_id);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ restored_items: 1, skipped_edited: 1, skipped_deleted: 1 });
            expect(res.body.skipped_items).toEqual([expect.objectContaining({ id: edited.id, reason: 'edited' })]);
            expect(await itemCategory(untouched.id)).toBe('B');
            expect(await itemCategory(edited.id)).toBe('Something Else');
        });

        test('follows a target that was renamed after the merge', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const food = await createFood(workspaceId, 'F', 'B');
            const merged = await merge({ sourceIds: [a.id, b.id], target: { id: a.id } });
            // the existing rename cascade carries items along with the target
            await request.put(`${BASE}/${a.id}`).set('Cookie', cookie).send({ name_en: 'A renamed' });

            const res = await undo(merged.body.merge_id);

            expect(res.body.restored_items).toBe(1);
            expect(await itemCategory(food.id)).toBe('B');
        });

        test('keeps a created target that gained items after the merge', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const merged = await merge({ sourceIds: [a.id, b.id], target: { name_en: 'Combined' } });
            const later = await createFood(workspaceId, 'Added later', 'Combined');

            const res = await undo(merged.body.merge_id);

            expect(res.body.target_removed).toBe(false);
            expect(await categoryNames(workspaceId)).toEqual(['A', 'B', 'Combined']);
            expect(await itemCategory(later.id)).toBe('Combined');
        });

        test('reuses a same-named category the coach re-created in the meantime instead of duplicating it', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const merged = await merge({ sourceIds: [a.id, b.id], target: { id: a.id } });
            await createCategory(workspaceId, 'b');

            const res = await undo(merged.body.merge_id);

            expect(res.body).toMatchObject({ recreated_categories: 0, reused_categories: 1 });
            expect(await categoryNames(workspaceId)).toEqual(['A', 'b']);
        });

        test('only the most recent merge can be undone, and a merge can only be undone once', async () => {
            const a = await createCategory(workspaceId, 'A');
            const b = await createCategory(workspaceId, 'B');
            const c = await createCategory(workspaceId, 'C');
            const first = await merge({ sourceIds: [a.id, b.id], target: { id: a.id } });
            const second = await merge({ sourceIds: [a.id, c.id], target: { id: a.id } });

            const listed = await request.get(`${BASE}/merges`).set('Cookie', cookie);
            expect(listed.body.map((m: { id: string; can_undo: boolean }) => [m.id, m.can_undo])).toEqual([[second.body.merge_id, true], [first.body.merge_id, false]]);

            expect((await undo(first.body.merge_id)).status).toBe(409);
            expect((await undo(second.body.merge_id)).status).toBe(200);
            expect((await undo(second.body.merge_id)).status).toBe(409);
            expect((await undo(first.body.merge_id)).status).toBe(200); // now the latest un-undone
            expect(await categoryNames(workspaceId)).toEqual(['A', 'B', 'C']);
        });

        test('returns 404 for an unknown merge id', async () => {
            expect((await undo('does-not-exist')).status).toBe(404);
        });
    });
});
