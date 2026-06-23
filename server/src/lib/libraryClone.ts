import { createId } from '@paralleldrive/cuid2';
import { prisma } from './prisma';
import logger from '../logger';

// Copy the global Default Libraries (master_* tables) into a freshly created
// workspace. Runs in the background after signup (see auth.controller). Idempotent:
// guarded by workspaces.clone_status so a workspace is never cloned twice.

const BATCH_SIZE = 500;

function chunk<T>(rows: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
    return out;
}

export type LibraryCounts = {
    exercises: number;
    foodItems: number;
    foodCategories: number;
    equipment: number;
    muscleGroups: number;
};

export async function getLibraryCounts(workspaceId: string): Promise<LibraryCounts> {
    const [exercises, foodItems, foodCategories, equipment, muscleGroups] = await Promise.all([
        prisma.exercise_library.count({ where: { workspace_id: workspaceId } }),
        prisma.food_items.count({ where: { workspace_id: workspaceId } }),
        prisma.food_categories.count({ where: { workspace_id: workspaceId } }),
        prisma.exercise_equipments.count({ where: { workspace_id: workspaceId } }),
        prisma.exercise_muscle_groups.count({ where: { workspace_id: workspaceId } }),
    ]);
    return { exercises, foodItems, foodCategories, equipment, muscleGroups };
}

async function cloneInBatches<TRow, TData>(rows: TRow[], map: (row: TRow) => TData, insert: (data: TData[]) => Promise<unknown>): Promise<void> {
    for (const batch of chunk(rows, BATCH_SIZE)) {
        await insert(batch.map(map));
    }
}

/**
 * Clone every master library record into the given workspace. Safe to call once
 * per workspace; subsequent calls short-circuit unless the previous run failed.
 */
export async function cloneDefaultLibraries(workspaceId: string): Promise<void> {
    const ws = await prisma.workspaces.findUnique({
        where:  { id: workspaceId },
        select: { id: true, clone_status: true },
    });
    if (!ws) {
        logger.warn({ workspaceId }, '[libraryClone] workspace not found — skipping');
        return;
    }
    // Prevent duplicate cloning: only proceed from a fresh/failed state.
    if (ws.clone_status === 'ready' || ws.clone_status === 'cloning') {
        logger.info({ workspaceId, status: ws.clone_status }, '[libraryClone] already cloned/in progress — skipping');
        return;
    }

    await prisma.workspaces.update({ where: { id: workspaceId }, data: { clone_status: 'cloning', clone_error: null } });

    try {
        const [muscleGroups, equipment, exercises, foodCategories, foodItems] = await Promise.all([
            prisma.master_exercise_muscle_groups.findMany(),
            prisma.master_exercise_equipments.findMany(),
            prisma.master_exercise_library.findMany(),
            prisma.master_food_categories.findMany(),
            prisma.master_food_items.findMany(),
        ]);

        await cloneInBatches(muscleGroups,
            (m) => ({ id: createId(), workspace_id: workspaceId, name_en: m.name_en, name_ar: m.name_ar }),
            (data) => prisma.exercise_muscle_groups.createMany({ data, skipDuplicates: true }));

        await cloneInBatches(equipment,
            (e) => ({ id: createId(), workspace_id: workspaceId, name_en: e.name_en, name_ar: e.name_ar }),
            (data) => prisma.exercise_equipments.createMany({ data, skipDuplicates: true }));

        await cloneInBatches(exercises,
            (ex) => ({
                id: createId(), workspace_id: workspaceId,
                name_en: ex.name_en, name_ar: ex.name_ar,
                muscle_group: ex.muscle_group, equipment: ex.equipment,
                youtube_url: ex.youtube_url, video_path: ex.video_path, thumbnail_path: ex.thumbnail_path,
                instructions_en: ex.instructions_en, instructions_ar: ex.instructions_ar,
            }),
            (data) => prisma.exercise_library.createMany({ data, skipDuplicates: true }));

        await cloneInBatches(foodCategories,
            (c) => ({ id: createId(), workspace_id: workspaceId, name_en: c.name_en, name_ar: c.name_ar }),
            (data) => prisma.food_categories.createMany({ data, skipDuplicates: true }));

        await cloneInBatches(foodItems,
            (f) => ({
                id: createId(), workspace_id: workspaceId,
                name_en: f.name_en, name_ar: f.name_ar, food_category: f.food_category,
                serving_size: f.serving_size, serving_unit: f.serving_unit,
                calories_per_serving: f.calories_per_serving, protein_per_serving: f.protein_per_serving,
                carbs_per_serving: f.carbs_per_serving, fats_per_serving: f.fats_per_serving,
            }),
            (data) => prisma.food_items.createMany({ data, skipDuplicates: true }));

        await prisma.workspaces.update({ where: { id: workspaceId }, data: { clone_status: 'ready', clone_error: null } });
        logger.info({ workspaceId, counts: { muscleGroups: muscleGroups.length, equipment: equipment.length, exercises: exercises.length, foodCategories: foodCategories.length, foodItems: foodItems.length } }, '[libraryClone] completed');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await prisma.workspaces.update({ where: { id: workspaceId }, data: { clone_status: 'failed', clone_error: message } }).catch(() => {});
        logger.error({ workspaceId, err }, '[libraryClone] failed');
    }
}
