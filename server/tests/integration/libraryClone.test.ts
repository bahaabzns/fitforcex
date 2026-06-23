import { createTestUser, createTestWorkspace } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';
import { cloneDefaultLibraries, getLibraryCounts } from '../../src/lib/libraryClone';

// Master data is not touched by resetTestDb (which only truncates tenant tables),
// so seed a known set once and clean it up at the end.
const MUSCLE_GROUPS = 2;
const EQUIPMENT = 2;
const EXERCISES = 3;
const FOOD_CATEGORIES = 2;
const FOOD_ITEMS = 4;

async function seedMaster() {
    await testPrisma.master_exercise_muscle_groups.createMany({
        data: Array.from({ length: MUSCLE_GROUPS }, (_, i) => ({ id: createId(), name_en: `MG ${i}-${createId()}` })),
    });
    await testPrisma.master_exercise_equipments.createMany({
        data: Array.from({ length: EQUIPMENT }, (_, i) => ({ id: createId(), name_en: `EQ ${i}-${createId()}` })),
    });
    await testPrisma.master_exercise_library.createMany({
        data: Array.from({ length: EXERCISES }, (_, i) => ({ id: createId(), name_en: `EX ${i}`, muscle_group: 'MG', equipment: 'EQ' })),
    });
    await testPrisma.master_food_categories.createMany({
        data: Array.from({ length: FOOD_CATEGORIES }, (_, i) => ({ id: createId(), name_en: `FC ${i}-${createId()}` })),
    });
    await testPrisma.master_food_items.createMany({
        data: Array.from({ length: FOOD_ITEMS }, (_, i) => ({ id: createId(), name_en: `FI ${i}`, calories_per_serving: 100, protein_per_serving: 10, carbs_per_serving: 5, fats_per_serving: 2 })),
    });
}

async function clearMaster() {
    await testPrisma.master_exercise_muscle_groups.deleteMany();
    await testPrisma.master_exercise_equipments.deleteMany();
    await testPrisma.master_exercise_library.deleteMany();
    await testPrisma.master_food_categories.deleteMany();
    await testPrisma.master_food_items.deleteMany();
}

describe('Default Libraries clone engine', () => {
    beforeAll(async () => { await clearMaster(); await seedMaster(); });
    afterAll(async () => { await clearMaster(); });

    async function freshWorkspace() {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        // New signups start as 'pending'; createTestWorkspace defaults to 'ready'.
        await testPrisma.workspaces.update({ where: { id: ws.id }, data: { clone_status: 'pending' } });
        return ws;
    }

    it('clones every master library into the workspace and marks it ready', async () => {
        const ws = await freshWorkspace();

        await cloneDefaultLibraries(ws.id);

        const counts = await getLibraryCounts(ws.id);
        expect(counts).toEqual({
            exercises: EXERCISES,
            foodItems: FOOD_ITEMS,
            foodCategories: FOOD_CATEGORIES,
            equipment: EQUIPMENT,
            muscleGroups: MUSCLE_GROUPS,
        });

        const after = await testPrisma.workspaces.findUnique({ where: { id: ws.id }, select: { clone_status: true } });
        expect(after?.clone_status).toBe('ready');
    });

    it('is idempotent — a second clone does not duplicate rows', async () => {
        const ws = await freshWorkspace();

        await cloneDefaultLibraries(ws.id);
        await cloneDefaultLibraries(ws.id);   // should short-circuit (status already ready)

        const counts = await getLibraryCounts(ws.id);
        expect(counts.exercises).toBe(EXERCISES);
        expect(counts.foodItems).toBe(FOOD_ITEMS);
    });

    it('does not clone a workspace that is already ready', async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);   // defaults to clone_status 'ready'

        await cloneDefaultLibraries(ws.id);

        const counts = await getLibraryCounts(ws.id);
        expect(counts.exercises).toBe(0);
    });
});
