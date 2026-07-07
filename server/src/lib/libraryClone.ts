import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import logger from '../logger';
import { seedWorkspaceMetrics } from '../modules/metrics/metrics.controller';

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
    assessmentForms: number;
    checkInForms: number;
};

export async function getLibraryCounts(workspaceId: string): Promise<LibraryCounts> {
    const [exercises, foodItems, foodCategories, equipment, muscleGroups, assessmentForms, checkInForms] = await Promise.all([
        prisma.exercise_library.count({ where: { workspace_id: workspaceId } }),
        prisma.food_items.count({ where: { workspace_id: workspaceId } }),
        prisma.food_categories.count({ where: { workspace_id: workspaceId } }),
        prisma.exercise_equipments.count({ where: { workspace_id: workspaceId } }),
        prisma.exercise_muscle_groups.count({ where: { workspace_id: workspaceId } }),
        prisma.forms.count({ where: { workspace_id: workspaceId, form_type: 'assessment' } }),
        prisma.forms.count({ where: { workspace_id: workspaceId, form_type: 'check-in' } }),
    ]);
    return { exercises, foodItems, foodCategories, equipment, muscleGroups, assessmentForms, checkInForms };
}

/**
 * Clone every Master Form Template (master_forms + master_form_questions) into the given
 * workspace as fully-editable coach forms (forms + form_versions + form_version_questions).
 * Each form gets a fresh cuid and starts life as an unsealed version 1 — fully
 * version-aware from the moment it exists, exactly like createForm (Forms Versioning
 * Phase 2/5). The coach copy is fully decoupled — later edits to the master never touch
 * existing copies.
 */
async function cloneMasterForms(workspaceId: string): Promise<{ forms: number; questions: number }> {
    const masterForms = await prisma.master_forms.findMany({
        include: { questions: { orderBy: [{ order_index: 'asc' }, { id: 'asc' }] } },
        orderBy: { created_at: 'asc' },
    });

    let questionCount = 0;
    for (const mf of masterForms) {
        const newFormId = createId();
        const versionId = createId();
        await prisma.forms.create({
            data: {
                id:             newFormId,
                workspace_id:   workspaceId,
                title_en:       mf.title_en,
                title_ar:       mf.title_ar,
                description_en: mf.description_en,
                description_ar: mf.description_ar,
                status:         mf.status,
                post_action:    mf.post_action,
                form_type:      mf.form_type,
            },
        });
        await prisma.form_versions.create({
            data: { id: versionId, form_id: newFormId, version_number: 1 },
        });
        await prisma.forms.update({ where: { id: newFormId }, data: { current_version_id: versionId } });

        if (mf.questions.length) {
            await prisma.form_version_questions.createMany({
                data: mf.questions.map((q) => ({
                    id:              createId(),
                    form_version_id: versionId,
                    label_en:        q.label_en,
                    label_ar:        q.label_ar,
                    type:            q.type,
                    required:        q.required,
                    order_index:     q.order_index,
                    options:         q.options ?? Prisma.DbNull,
                    options_ar:      q.options_ar ?? Prisma.DbNull,
                    placeholder_en:  q.placeholder_en,
                    placeholder_ar:  q.placeholder_ar,
                    min_value:       q.min_value,
                    max_value:       q.max_value,
                })),
            });
            questionCount += mf.questions.length;
        }
    }

    return { forms: masterForms.length, questions: questionCount };
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

        const forms = await cloneMasterForms(workspaceId);
        const metricCount = await seedWorkspaceMetrics(workspaceId);

        await prisma.workspaces.update({ where: { id: workspaceId }, data: { clone_status: 'ready', clone_error: null } });
        logger.info({ workspaceId, counts: { muscleGroups: muscleGroups.length, equipment: equipment.length, exercises: exercises.length, foodCategories: foodCategories.length, foodItems: foodItems.length, forms: forms.forms, formQuestions: forms.questions, metrics: metricCount } }, '[libraryClone] completed');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await prisma.workspaces.update({ where: { id: workspaceId }, data: { clone_status: 'failed', clone_error: message } }).catch(() => {});
        logger.error({ workspaceId, err }, '[libraryClone] failed');
    }
}
