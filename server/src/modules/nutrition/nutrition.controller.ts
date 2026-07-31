import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { Pool, PoolClient } from 'pg';
import {
    toIsoDateOrNull,
    serializePlanRows,
    normalizeOrderedList,
    insertOrderedChildren,
    replaceClientPlansTransactional,
    activateSinglePlan,
    saveSinglePlanDraft,
    withTransaction,
    reconcileCheckInSchedules,
} from '../../lib/planEngine';
import pool from '../../db';
import { prisma } from '../../lib/prisma';
import { toNumberOrNull, fetchFullNutritionPlan } from './nutrition.service';
import { recordEvent } from '../../lib/events';
import { sealVersionForAssignment } from '../forms/forms.service';

type Row = Record<string, unknown>;
type DbHandle = Pool | PoolClient;

// Every plan-content mutation below stamps who touched it and when, via one
// of these, instead of a bare `updated_at = NOW()` — so the plan card's
// "edited X ago · by <name>" stays accurate no matter which specific action
// (reorder, delete an item, duplicate a cycle, ...) a coach used.
async function touchPlan(db: DbHandle, planId: string, userId: string): Promise<void> {
    await db.query('UPDATE nutrition_plans SET updated_at = NOW(), last_edited_by = $2 WHERE id = $1', [planId, userId]);
}

async function touchPlanByCycle(db: DbHandle, cycleId: string, userId: string): Promise<void> {
    await db.query(
        'UPDATE nutrition_plans SET updated_at = NOW(), last_edited_by = $2 WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)',
        [cycleId, userId]
    );
}

async function touchPlanByMeal(db: DbHandle, mealId: string, userId: string): Promise<void> {
    await db.query(
        `UPDATE nutrition_plans SET updated_at = NOW(), last_edited_by = $2 WHERE id = (
            SELECT nc.plan_id FROM nutrition_cycles nc JOIN nutrition_meals nm ON nm.cycle_id = nc.id WHERE nm.id = $1
        )`, [mealId, userId]
    );
}

async function touchPlanByMealItem(db: DbHandle, mealItemId: string, userId: string): Promise<void> {
    await db.query(
        `UPDATE nutrition_plans SET updated_at = NOW(), last_edited_by = $2 WHERE id = (
            SELECT nc.plan_id FROM nutrition_meal_items nmi
            JOIN nutrition_meals nm ON nm.id = nmi.meal_id
            JOIN nutrition_cycles nc ON nc.id = nm.cycle_id
            WHERE nmi.id = $1
        )`, [mealItemId, userId]
    );
}

// ── Food Items ────────────────────────────────────────────────────────────────

export async function getFoodItems(req: Request, res: Response, next: NextFunction) {
    try {
        const items = await prisma.food_items.findMany({
            where:   { workspace_id: req.user!.workspaceId },
            orderBy: { name_en: 'asc' },
        });
        res.json(items);
    } catch (err) { next(err); }
}

export async function createFoodItem(req: Request, res: Response, next: NextFunction) {
    const { name_en, name_ar, food_category, serving_size, serving_unit, calories_per_serving, carbs_per_serving, protein_per_serving, fats_per_serving } = req.body as Record<string, unknown>;
    try {
        const created = await prisma.food_items.create({
            data: {
                id:                   createId(),
                workspace_id:         req.user!.workspaceId,
                name_en:              name_en as string,
                name_ar:              (name_ar as string | null) || null,
                food_category:        food_category as string | null,
                serving_size:         serving_size != null ? Number(serving_size) : null,
                serving_unit:         serving_unit as string | null,
                calories_per_serving: Number(calories_per_serving),
                carbs_per_serving:    Number(carbs_per_serving),
                protein_per_serving:  Number(protein_per_serving),
                fats_per_serving:     Number(fats_per_serving),
            },
        });
        res.status(201).json(created);
    } catch (err) { next(err); }
}

export async function updateFoodItem(req: Request, res: Response, next: NextFunction) {
    const { name_en, name_ar, food_category, serving_size, serving_unit, calories_per_serving, carbs_per_serving, protein_per_serving, fats_per_serving } = req.body as Record<string, unknown>;
    try {
        const existing = await prisma.food_items.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!existing) return res.status(404).json({ error: 'Food item not found' });
        const updated = await prisma.food_items.update({
            where: { id: req.params.id as string },
            data: {
                name_en:              name_en as string,
                name_ar:              (name_ar as string | null) || null,
                food_category:        food_category as string | null,
                serving_size:         serving_size != null ? Number(serving_size) : null,
                serving_unit:         serving_unit as string | null,
                calories_per_serving: Number(calories_per_serving),
                carbs_per_serving:    Number(carbs_per_serving),
                protein_per_serving:  Number(protein_per_serving),
                fats_per_serving:     Number(fats_per_serving),
            },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function deleteFoodItem(req: Request, res: Response, next: NextFunction) {
    try {
        const toDelete = await prisma.food_items.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!toDelete) return res.status(404).json({ error: 'Food item not found' });
        await prisma.food_items.delete({ where: { id: req.params.id as string } });
        res.json(toDelete);
    } catch (err) { next(err); }
}

// ── Food Categories ───────────────────────────────────────────────────────────

export async function getFoodCategories(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT fc.*, COUNT(fi.id)::int AS food_item_count
            FROM food_categories fc
            LEFT JOIN food_items fi ON fi.food_category = fc.name_en AND fi.workspace_id = fc.workspace_id
            WHERE fc.workspace_id = ${req.user!.workspaceId}
            GROUP BY fc.id
            ORDER BY fc.name_en ASC
        `;
        res.json(rows);
    } catch (err) { next(err); }
}

export async function createFoodCategory(req: Request, res: Response, next: NextFunction) {
    const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
    try {
        const created = await prisma.food_categories.create({
            data: { id: createId(), workspace_id: req.user!.workspaceId, name_en: name_en!, name_ar: name_ar || null },
        });
        res.status(201).json(created);
    } catch (err) { next(err); }
}

export async function updateFoodCategory(req: Request, res: Response, next: NextFunction) {
    const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
    try {
        const existing = await prisma.food_categories.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!existing) return res.status(404).json({ error: 'Food category not found' });
        const oldNameEn = existing.name_en;

        const updated = await prisma.food_categories.update({
            where: { id: req.params.id as string },
            data:  { name_en: name_en!, name_ar: name_ar || null },
        });

        await prisma.food_items.updateMany({
            where: { food_category: oldNameEn, workspace_id: req.user!.workspaceId },
            data:  { food_category: name_en },
        });

        res.json(updated);
    } catch (err) { next(err); }
}

export async function deleteFoodCategory(req: Request, res: Response, next: NextFunction) {
    try {
        const toDelete = await prisma.food_categories.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!toDelete) return res.status(404).json({ error: 'Food category not found' });
        await prisma.food_categories.delete({ where: { id: req.params.id as string } });
        res.json(toDelete);
    } catch (err) { next(err); }
}

// ── Nutrition Plans ───────────────────────────────────────────────────────────

export async function getWorkspaceLibrary(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query(
            `SELECT
                np.id, np.name, np.status, np.created_at, np.updated_at, np.created_by,
                c.client_code,
                NULLIF(TRIM(COALESCE(c.fname, '') || ' ' || COALESCE(c.lname, '')), '') AS client_name,
                NULLIF(TRIM(COALESCE(u.fname, '') || ' ' || COALESCE(u.lname, '')), '') AS creator_name,
                cyc_agg.cycle_count, cyc_agg.avg_calories, cyc_agg.avg_protein, cyc_agg.avg_carbs, cyc_agg.avg_fats,
                cyc_agg.cycles
             FROM nutrition_plans np
             LEFT JOIN clients c ON c.id = np.client_id
             LEFT JOIN users u ON u.id = np.created_by
             -- goal_calories/protein/carbs/fats on nutrition_cycles are an OPTIONAL
             -- manual target most coaches never fill in (they just build meals from
             -- food items) — that's why cards showed no macros at all for plans built
             -- that way. Computed instead from the actual meal items, mirroring the
             -- exact formula the builder itself uses client-side (lib/nutritionCalc.js:
             -- amount / serving_size * per_serving macro), so this always reflects
             -- what's really in the plan rather than an often-empty aspirational goal.
             LEFT JOIN LATERAL (
                 SELECT
                     COUNT(*)::int AS cycle_count,
                     ROUND(AVG(cyc.calories))::int AS avg_calories,
                     ROUND(AVG(cyc.protein))::int  AS avg_protein,
                     ROUND(AVG(cyc.carbs))::int    AS avg_carbs,
                     ROUND(AVG(cyc.fats))::int     AS avg_fats,
                     COALESCE(json_agg(cyc ORDER BY cyc.cycle_order), '[]'::json) AS cycles
                 FROM (
                     SELECT nc.id, nc.name, nc.cycle_order,
                            actual.calories, actual.protein, actual.carbs, actual.fats,
                            COALESCE(actual.meal_count, 0) AS meal_count
                     FROM nutrition_cycles nc
                     LEFT JOIN LATERAL (
                         SELECT
                             ROUND(SUM(fi.calories_per_serving * nmi.amount / NULLIF(fi.serving_size, 0)))::int AS calories,
                             ROUND(SUM(fi.protein_per_serving  * nmi.amount / NULLIF(fi.serving_size, 0)))::int AS protein,
                             ROUND(SUM(fi.carbs_per_serving    * nmi.amount / NULLIF(fi.serving_size, 0)))::int AS carbs,
                             ROUND(SUM(fi.fats_per_serving     * nmi.amount / NULLIF(fi.serving_size, 0)))::int AS fats,
                             COUNT(DISTINCT nm.id)::int AS meal_count
                         FROM nutrition_meals nm
                         LEFT JOIN nutrition_meal_items nmi ON nmi.meal_id = nm.id
                         LEFT JOIN food_items fi ON fi.id = COALESCE(nmi.original_food_item_id, nmi.food_item_id)
                         WHERE nm.cycle_id = nc.id
                     ) actual ON true
                     WHERE nc.plan_id = np.id
                 ) cyc
             ) cyc_agg ON true
             WHERE np.workspace_id = $1
             ORDER BY np.updated_at DESC`,
            [req.user!.workspaceId]
        );
        res.json(serializePlanRows(result.rows));
    } catch (err) { next(err); }
}

export async function getPlans(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query(
            `SELECT np.*, (SELECT COUNT(*) FROM nutrition_cycles WHERE plan_id = np.id)::int AS cycle_count,
                    TRIM(CONCAT(u.fname, ' ', u.lname)) AS last_edited_by_name
             FROM nutrition_plans np
             LEFT JOIN users u ON u.id = np.last_edited_by
             WHERE np.workspace_id = $1 AND np.client_id = $2
             ORDER BY np.created_at DESC`,
            [req.user!.workspaceId, req.query.clientId as string]
        );
        res.json(serializePlanRows(result.rows));
    } catch (err) { next(err); }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
    try {
        const plan = await fetchFullNutritionPlan(req.params.id as string, req.user!.workspaceId);
        if (!plan) return res.status(404).json({ error: 'Nutrition plan not found' });

        // Spreads the full row (matches training.controller.ts's getPlan) --
        // a prior hand-picked field list silently dropped activated_at/
        // cycle_days/cycle_end_at/review_offset_days/review_notified_at on
        // every plan-detail fetch, so a page reload lost the active plan's
        // cycle progress even though the DB had it.
        res.json(plan);
    } catch (err) { next(err); }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
    const { name, client_id } = req.body as { name?: string; client_id?: string };
    try {
        const planResult = await pool.query(
            'INSERT INTO nutrition_plans (name, client_id, workspace_id, id, created_by, last_edited_by) VALUES ($1, $2, $3, $4, $5, $5) RETURNING *',
            [name, client_id, req.user!.workspaceId, createId(), req.user!.userId]
        );
        await pool.query(
            'INSERT INTO nutrition_cycles (plan_id, name, id) VALUES ($1, $2, $3) RETURNING *',
            [(planResult.rows[0] as Row).id, 'Cycle 1', createId()]
        );
        res.status(201).json(planResult.rows[0]);
    } catch (err) { next(err); }
}

export async function saveDraft(req: Request, res: Response, next: NextFunction) {
    const { clientId, plans = [], activePlanId = null } = req.body as { clientId: string; plans?: Row[]; activePlanId?: string | null };

    try {
        await replaceClientPlansTransactional({
            pool,
            work: async (dbClient) => {
                // Package Lifecycle Phase 3a bug fix: this bulk "save all
                // drafts" path deletes and recreates every plan for the
                // client, same as the single-plan path -- read forward
                // each existing plan's activation/cycle dates (keyed by its
                // current id) before the delete, below, or they're lost.
                const existingPlansResult = await dbClient.query(
                    `SELECT id, activated_at, cycle_days, cycle_end_at, review_notified_at
                     FROM nutrition_plans WHERE workspace_id = $1 AND client_id = $2`,
                    [req.user!.workspaceId, clientId]
                );
                const existingPlanDates = new Map(
                    (existingPlansResult.rows as Row[]).map(row => [row.id as string, row])
                );

                await dbClient.query(
                    `DELETE FROM nutrition_meal_item_alternatives nmia
                     USING nutrition_meal_items nmi, nutrition_meals nm, nutrition_cycles nc, nutrition_plans np
                     WHERE nmia.meal_item_id = nmi.id AND nmi.meal_id = nm.id AND nm.cycle_id = nc.id
                       AND nc.plan_id = np.id AND np.workspace_id = $1 AND np.client_id = $2`,
                    [req.user!.workspaceId, clientId]
                );
                await dbClient.query(
                    `DELETE FROM nutrition_meal_items nmi
                     USING nutrition_meals nm, nutrition_cycles nc, nutrition_plans np
                     WHERE nmi.meal_id = nm.id AND nm.cycle_id = nc.id AND nc.plan_id = np.id
                       AND np.workspace_id = $1 AND np.client_id = $2`,
                    [req.user!.workspaceId, clientId]
                );
                await dbClient.query(
                    `DELETE FROM nutrition_meals nm USING nutrition_cycles nc, nutrition_plans np
                     WHERE nm.cycle_id = nc.id AND nc.plan_id = np.id AND np.workspace_id = $1 AND np.client_id = $2`,
                    [req.user!.workspaceId, clientId]
                );
                await dbClient.query(
                    `DELETE FROM nutrition_cycles nc USING nutrition_plans np
                     WHERE nc.plan_id = np.id AND np.workspace_id = $1 AND np.client_id = $2`,
                    [req.user!.workspaceId, clientId]
                );
                await dbClient.query(
                    'DELETE FROM nutrition_plans WHERE workspace_id = $1 AND client_id = $2',
                    [req.user!.workspaceId, clientId]
                );

                const planIdMap = new Map<string, string>();

                for (let pIndex = 0; pIndex < plans.length; pIndex++) {
                    const plan      = plans[pIndex];
                    const createdAt = toIsoDateOrNull(plan.created_at as string | null) || new Date().toISOString();
                    const updatedAt = new Date().toISOString();
                    const priorDates = existingPlanDates.get(plan.id as string);

                    const insertedPlan = await dbClient.query(
                        `INSERT INTO nutrition_plans (name, client_id, workspace_id, status, created_at, updated_at, created_by, id, activated_at, cycle_days, cycle_end_at, review_notified_at, last_edited_by)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
                        [
                            (plan.name as string) || `Plan ${pIndex + 1}`,
                            clientId, req.user!.workspaceId,
                            plan.status === 'active' ? 'active' : 'inactive',
                            createdAt, updatedAt,
                            (plan.created_by as string | null) ?? req.user!.userId,
                            createId(),
                            priorDates?.activated_at ?? null,
                            priorDates?.cycle_days ?? null,
                            priorDates?.cycle_end_at ?? null,
                            priorDates?.review_notified_at ?? null,
                            req.user!.userId,
                        ]
                    );

                    const dbPlan = insertedPlan.rows[0] as Row;
                    planIdMap.set(plan.id as string, dbPlan.id as string);

                    for (const cycle of normalizeOrderedList(plan.cycles as Row[], 'cycle_order') as Row[]) {
                        const insertedCycle = await dbClient.query(
                            `INSERT INTO nutrition_cycles (plan_id, name, cycle_order, note, goal_calories, goal_protein, goal_carbs, goal_fats, id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                            [
                                dbPlan.id, (cycle.name as string) || `Cycle ${cycle.cycle_order}`,
                                cycle.cycle_order, cycle.note ?? null,
                                cycle.goal_calories ?? null, cycle.goal_protein ?? null,
                                cycle.goal_carbs ?? null, cycle.goal_fats ?? null, createId(),
                            ]
                        );

                        const dbCycle = insertedCycle.rows[0] as Row;

                        for (const meal of normalizeOrderedList(cycle.meals as Row[], 'meal_order') as Row[]) {
                            const insertedMeal = await dbClient.query(
                                `INSERT INTO nutrition_meals (cycle_id, name, meal_order, note, id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                                [dbCycle.id, (meal.name as string) || `Meal ${meal.meal_order}`, meal.meal_order, meal.note ?? null, createId()]
                            );
                            const dbMeal = insertedMeal.rows[0] as Row;

                            for (const item of normalizeOrderedList(meal.items as Row[], 'meal_item_order') as Row[]) {
                                const insertedItem = await dbClient.query(
                                    `INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order, id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                                    [dbMeal.id, item.food_item_id, toNumberOrNull(item.amount) ?? 0, item.meal_item_order, createId()]
                                );

                                for (const alt of normalizeOrderedList(item.alternatives as Row[], 'alt_order') as Row[]) {
                                    await dbClient.query(
                                        `INSERT INTO nutrition_meal_item_alternatives (meal_item_id, food_item_id, amount, alt_order, id) VALUES ($1, $2, $3, $4, $5)`,
                                        [(insertedItem.rows[0] as Row).id, alt.food_item_id, toNumberOrNull(alt.amount) ?? 0, alt.alt_order, createId()]
                                    );
                                }
                            }
                        }
                    }
                }

                const resolvedActivePlanId = planIdMap.get(activePlanId as string) || null;
                if (resolvedActivePlanId) {
                    await dbClient.query(
                        `UPDATE nutrition_plans
                         SET status = CASE WHEN id = $1 THEN 'active' ELSE 'inactive' END,
                             activated_at = CASE WHEN id = $1 THEN COALESCE(activated_at, NOW()) ELSE activated_at END
                         WHERE workspace_id = $2 AND client_id = $3`,
                        [resolvedActivePlanId, req.user!.workspaceId, clientId]
                    );
                }
            },
        });

        const summary = await pool.query(
            `SELECT np.*, (SELECT COUNT(*) FROM nutrition_cycles WHERE plan_id = np.id)::int AS cycle_count
             FROM nutrition_plans np WHERE np.workspace_id = $1 AND np.client_id = $2 ORDER BY np.created_at DESC`,
            [req.user!.workspaceId, clientId]
        );

        res.json({ plans: serializePlanRows(summary.rows) });
    } catch (err) { next(err); }
}

export async function savePlanDraft(req: Request, res: Response, next: NextFunction) {
    const { clientId, plan, activePlanId = null, durationChoice, cycleDays: restartCycleDays, checkInForms: restartCheckInForms } = req.body as {
        clientId: string; plan: Row; activePlanId?: string | null;
        // Package Lifecycle Phase 3b: required by the frontend only when the
        // plan being saved is currently active (§12.5); ignored otherwise.
        durationChoice?: 'restart' | 'extend';
        // Post-review refinement: only meaningful when durationChoice ===
        // 'restart' — the coach reconfigured duration/check-ins through the
        // same Configure Activation modal used for first activation, instead
        // of the restart silently reusing the plan's existing values.
        // Undefined preserves the old behavior exactly (see
        // reconcileCheckInSchedules's doc comment in lib/planEngine.ts).
        cycleDays?: number | null;
        checkInForms?: Array<{ formId: string }>;
    };

    try {
        let existingCreatedBy: string | null = null;
        // Package Lifecycle Phase 3a bug fix: the save path deletes the plan
        // row and re-inserts it, so activated_at/cycle_days/cycle_end_at must
        // be read here and carried into the new row (below) or they're lost
        // -- silently resetting the plan's activation clock on every save,
        // regardless of the shared engine's COALESCE(activated_at, NOW())
        // intent in lib/planEngine.ts.
        let existingActivatedAt: Date | null = null;
        let existingCycleDays: number | null = null;
        let existingCycleEndAt: Date | null = null;
        let existingReviewNotifiedAt: Date | null = null;
        // Set inside activatePlanInTransaction below; consulted after the
        // transaction commits so a restart notification never fires for a
        // save that ultimately rolled back.
        let restartedClientId: string | null = null;
        // Populated by activateSinglePlan inside activatePlanInTransaction --
        // form_requests ids auto-reviewed as a side effect of this restart.
        // See the identical note in activatePlan below.
        const autoReviewedIds: string[] = [];

        const result = await saveSinglePlanDraft({
            pool, plan, clientId, coachId: req.user!.workspaceId, activePlanId,
            loadExistingPlan: async ({ dbClient, planId, clientId: cId, coachId }: { dbClient: PoolClient; planId: string; clientId: string; coachId: string }) => {
                const existing = await dbClient.query(
                    `SELECT id, created_at, created_by, activated_at, cycle_days, cycle_end_at, review_notified_at
                     FROM nutrition_plans WHERE id = $1 AND workspace_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
                const row = existing.rows[0] as Row | undefined;
                existingCreatedBy       = (row?.created_by as string) ?? null;
                existingActivatedAt     = (row?.activated_at as Date) ?? null;
                existingCycleDays       = (row?.cycle_days as number) ?? null;
                existingCycleEndAt      = (row?.cycle_end_at as Date) ?? null;
                existingReviewNotifiedAt = (row?.review_notified_at as Date) ?? null;
                return row ?? null;
            },
            deleteExistingPlanTree: async ({ dbClient, planId }: { dbClient: PoolClient; planId: string }) => {
                await dbClient.query(
                    `DELETE FROM nutrition_meal_item_alternatives nmia
                     USING nutrition_meal_items nmi, nutrition_meals nm, nutrition_cycles nc
                     WHERE nmia.meal_item_id = nmi.id AND nmi.meal_id = nm.id AND nm.cycle_id = nc.id AND nc.plan_id = $1`,
                    [planId]
                );
                await dbClient.query(
                    `DELETE FROM nutrition_meal_items nmi USING nutrition_meals nm, nutrition_cycles nc
                     WHERE nmi.meal_id = nm.id AND nm.cycle_id = nc.id AND nc.plan_id = $1`,
                    [planId]
                );
                await dbClient.query(
                    `DELETE FROM nutrition_meals nm USING nutrition_cycles nc WHERE nm.cycle_id = nc.id AND nc.plan_id = $1`,
                    [planId]
                );
                await dbClient.query('DELETE FROM nutrition_cycles WHERE plan_id = $1', [planId]);
                await dbClient.query('DELETE FROM nutrition_plans WHERE id = $1', [planId]);
            },
            insertPlanTree: async ({ dbClient, plan: incomingPlan, clientId: cId, coachId, createdAt, updatedAt }: { dbClient: PoolClient; plan: Row; clientId: string; coachId: string; createdAt: string; updatedAt: string }) => {
                const createdBy    = existingCreatedBy ?? req.user!.userId;
                const insertedPlan = await dbClient.query(
                    `INSERT INTO nutrition_plans (name, client_id, workspace_id, status, created_at, updated_at, created_by, id, activated_at, cycle_days, cycle_end_at, review_notified_at, last_edited_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
                    [
                        (incomingPlan.name as string) || 'Untitled Plan',
                        cId, coachId,
                        incomingPlan.status === 'active' ? 'active' : 'inactive',
                        createdAt, updatedAt, createdBy, createId(),
                        existingActivatedAt, existingCycleDays, existingCycleEndAt, existingReviewNotifiedAt,
                        req.user!.userId,
                    ]
                );

                const newPlan = insertedPlan.rows[0] as Row;

                await insertOrderedChildren({
                    items: incomingPlan.cycles as Row[], orderKey: 'cycle_order',
                    insert: async (cycle: Row) => {
                        const insertedCycle = await dbClient.query(
                            `INSERT INTO nutrition_cycles (plan_id, name, cycle_order, note, goal_calories, goal_protein, goal_carbs, goal_fats, id)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                            [
                                newPlan.id, (cycle.name as string) || `Cycle ${cycle.cycle_order}`,
                                cycle.cycle_order, cycle.note ?? null,
                                cycle.goal_calories ?? null, cycle.goal_protein ?? null,
                                cycle.goal_carbs ?? null, cycle.goal_fats ?? null, createId(),
                            ]
                        );
                        const dbCycle = insertedCycle.rows[0] as Row;

                        await insertOrderedChildren({
                            items: cycle.meals as Row[], orderKey: 'meal_order',
                            insert: async (meal: Row) => {
                                const insertedMeal = await dbClient.query(
                                    `INSERT INTO nutrition_meals (cycle_id, name, meal_order, note, id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                                    [dbCycle.id, (meal.name as string) || `Meal ${meal.meal_order}`, meal.meal_order, meal.note ?? null, createId()]
                                );
                                const dbMeal = insertedMeal.rows[0] as Row;

                                await insertOrderedChildren({
                                    items: meal.items as Row[], orderKey: 'meal_item_order',
                                    insert: async (item: Row) => {
                                        const insertedItem = await dbClient.query(
                                            `INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order, id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                                            [dbMeal.id, item.food_item_id, toNumberOrNull(item.amount) ?? 0, item.meal_item_order, createId()]
                                        );

                                        await insertOrderedChildren({
                                            items: item.alternatives as Row[], orderKey: 'alt_order',
                                            insert: async (alt: Row) => {
                                                await dbClient.query(
                                                    `INSERT INTO nutrition_meal_item_alternatives (meal_item_id, food_item_id, amount, alt_order, id) VALUES ($1, $2, $3, $4, $5)`,
                                                    [(insertedItem.rows[0] as Row).id, alt.food_item_id, toNumberOrNull(alt.amount) ?? 0, alt.alt_order, createId()]
                                                );
                                                return alt;
                                            },
                                        });

                                        return insertedItem.rows[0];
                                    },
                                });

                                return dbMeal;
                            },
                        });

                        return dbCycle;
                    },
                });

                return newPlan;
            },
            activatePlanInTransaction: async ({ dbClient, planId, coachId }: { dbClient: PoolClient; planId: unknown; clientId: string; coachId: string }) => {
                // Package Lifecycle Phase 3b, post-review refinement:
                // consolidated onto the shared activateSinglePlan. This is
                // the "edit an active plan" path, not first activation --
                // cycleDays is only passed through when the coach actually
                // reconfigured it via the restart flow's Configure
                // Activation modal (restartCycleDays !== undefined);
                // otherwise it's left untouched exactly as before. See
                // Business Logic §12.5 in the Package Lifecycle plan.
                const { plan: restarted, autoReviewedRequestIds } = await activateSinglePlan({
                    db: dbClient,
                    tableName:      'nutrition_plans',
                    planId:         planId as string,
                    coachId,
                    clientIdColumn: 'client_id',
                    updateMode:     durationChoice,
                    submissionPostAction: 'nutrition-plan',
                    ...(durationChoice === 'restart' && restartCycleDays !== undefined ? { cycleDays: restartCycleDays } : {}),
                });
                if (restarted) autoReviewedRequestIds.forEach((id) => autoReviewedIds.push(id));
                if (restarted && durationChoice === 'restart') {
                    // Matched by client + plan type, not source_plan_id: this
                    // save path deletes-and-reinserts the plan row (a
                    // pre-existing, deliberate pattern for the full plan
                    // tree), so the plan's id already changed by the time we
                    // get here and no longer matches what was stamped on the
                    // schedule rows at their original creation. A client has
                    // at most one active nutrition plan at a time, so scoping
                    // by client_id is unambiguous in practice.
                    //
                    // Check-in forms are one-shot, fired exactly at the
                    // plan's end -- a restart pushes that end date out.
                    // reconcileCheckInSchedules retargets everything still
                    // selected, cancels what was deselected (without
                    // touching anything already delivered/answered), and
                    // schedules anything newly added -- see its doc comment
                    // in lib/planEngine.ts. Skipped entirely if the restart
                    // didn't resolve a cycle_end_at (no cycle_days
                    // configured) -- nothing to reschedule to.
                    if (restarted.cycle_end_at) {
                        await reconcileCheckInSchedules({
                            dbClient,
                            sourcePlanType: 'nutrition',
                            sourcePlanId:   restarted.id as string,
                            clientId:       restarted.client_id as string,
                            workspaceId:    coachId,
                            cycleEndAt:     restarted.cycle_end_at as Date,
                            checkInForms:   restartCheckInForms,
                            actorUserId:    req.user!.userId,
                        });
                    }
                    restartedClientId = restarted.client_id as string;
                }
            },
            fetchSavedPlan: async ({ planId, coachId }: { planId: unknown; coachId: string }) => {
                const savedPlanResult = await pool.query(
                    `SELECT np.*, (SELECT COUNT(*) FROM nutrition_cycles WHERE plan_id = np.id)::int AS cycle_count
                     FROM nutrition_plans np WHERE np.id = $1 AND np.workspace_id = $2`,
                    [planId, coachId]
                );
                return savedPlanResult.rows[0] ?? null;
            },
        });

        if (restartedClientId) {
            await recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'plan.duration_restarted',
                title:       'Your nutrition plan has been restarted',
                recipients:  [{ type: 'client', id: restartedClientId }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'nutrition_plan', id: result.newPlanId as string },
                metadata:    { clientId: restartedClientId },
            });
        }

        // See the identical note in activatePlan below: a client's pending
        // nutrition submission is satisfied the moment the plan goes active,
        // restart included -- fired here (post-commit) rather than inside
        // activatePlanInTransaction, same reasoning as restartedClientId above.
        if (restartedClientId) {
            await Promise.all(autoReviewedIds.map((id) => recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'checkin.auto_reviewed',
                importance:  'info',
                title:       'Your coach reviewed your check-in',
                recipients:  [{ type: 'client', id: restartedClientId as string }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'form_request', id },
            })));
        }

        res.json(result);
    } catch (err) { next(err); }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
    const { name, status } = req.body as { name?: string; status?: string };
    try {
        const result = await pool.query(
            'UPDATE nutrition_plans SET name = $1, status = $2, updated_at = NOW(), last_edited_by = $5 WHERE id = $3 AND workspace_id = $4 RETURNING *',
            [name, status, req.params.id, req.user!.workspaceId, req.user!.userId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Plan not found or you do not have permission to update it' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

export async function deletePlan(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query(
            'DELETE FROM nutrition_plans WHERE id = $1 AND workspace_id = $2 RETURNING *',
            [req.params.id, req.user!.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Plan not found or you do not have permission to delete it' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

export async function activatePlan(req: Request, res: Response, next: NextFunction) {
    // Package Lifecycle Phase 3b: the Configure Activation modal resolves
    // cycleDays/checkInForms from the client's package (or the coach's
    // manual override) and passes them here; updateMode only matters if the
    // plan is already active (editing, not first activation) -- see
    // lib/planEngine.ts's activateSinglePlan for the restart/extend rule.
    const { cycleDays, checkInForms, reviewOffsetDays, updateMode } = req.body as {
        cycleDays?: number | null;
        checkInForms?: { formId: string }[];
        reviewOffsetDays?: number | null;
        updateMode?: 'restart' | 'extend';
    };

    try {
        const planId  = req.params.id as string;
        const coachId = req.user!.workspaceId;

        const activation = await withTransaction(pool, async (dbClient) => {
            const { plan, autoReviewedRequestIds } = await activateSinglePlan({
                db: dbClient,
                tableName:      'nutrition_plans',
                planId,
                coachId,
                clientIdColumn: 'client_id',
                cycleDays:        cycleDays !== undefined ? (cycleDays == null ? null : Number(cycleDays)) : undefined,
                reviewOffsetDays: reviewOffsetDays !== undefined ? (reviewOffsetDays == null ? null : Number(reviewOffsetDays)) : undefined,
                updateMode,
                submissionPostAction: 'nutrition-plan',
            });
            if (!plan) return null;

            // A restart replaces the plan's check-in schedule entirely; an
            // extend (or first activation) simply adds any newly-confirmed
            // forms without touching schedules from a prior activation.
            if (updateMode === 'restart') {
                // Bug fix: cancel the linked form_requests rows too (only if
                // still 'scheduled' -- one already flipped to pending has
                // already reached the client and is left alone), or Plans
                // Queue keeps showing check-ins from the plan's previous cycle.
                await dbClient.query(
                    `DELETE FROM form_requests WHERE status = 'scheduled' AND id IN (
                         SELECT form_request_id FROM check_in_schedules
                         WHERE source_plan_type = 'nutrition' AND source_plan_id = $1 AND form_request_id IS NOT NULL
                     )`,
                    [planId]
                );
                await dbClient.query(
                    `DELETE FROM check_in_schedules WHERE source_plan_type = 'nutrition' AND source_plan_id = $1`,
                    [planId]
                );
            }
            // Check-in forms fire once, at the plan's own end date -- no
            // cycle_end_at means no resolved end to fire at, so skip entirely
            // rather than schedule against a null date.
            if (Array.isArray(checkInForms) && checkInForms.length > 0 && plan.cycle_end_at) {
                for (const f of checkInForms) {
                    if (!f.formId) continue;

                    // Bug fix: create the form_requests row immediately
                    // (status 'scheduled') so it's visible in Plans Queue right
                    // away, instead of waiting for the dispatch cron to create
                    // it on the plan's end date. Sealing the version now (same
                    // "assignment moment" convention as the manual schedule-a-
                    // form flow) pins the wording the client will see.
                    const { versionId } = await sealVersionForAssignment(f.formId, coachId, req.user!.userId);
                    const requestId = createId();
                    await dbClient.query(
                        `INSERT INTO form_requests (id, form_id, form_version_id, client_id, workspace_id, status, scheduled_at)
                         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)`,
                        [requestId, f.formId, versionId, plan.client_id, coachId, plan.cycle_end_at]
                    );
                    await dbClient.query(
                        `INSERT INTO check_in_schedules (id, workspace_id, client_id, form_id, next_due_at, source_plan_type, source_plan_id, form_request_id)
                         VALUES ($1, $2, $3, $4, $5, 'nutrition', $6, $7)`,
                        [createId(), coachId, plan.client_id, f.formId, plan.cycle_end_at, plan.id, requestId]
                    );
                }
            }

            return { plan, autoReviewedRequestIds };
        });

        if (!activation?.plan) return res.status(404).json({ error: 'Plan not found' });
        const { plan: updatedPlan, autoReviewedRequestIds } = activation;

        // A restart is the same plan renewing its duration clock, not a new
        // assignment -- fire the distinct restart event instead so the
        // client isn't told a plan they already have was "assigned" again.
        if (updateMode === 'restart') {
            await recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'plan.duration_restarted',
                title:       'Your nutrition plan has been restarted',
                recipients:  [{ type: 'client', id: updatedPlan.client_id as string }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'nutrition_plan', id: updatedPlan.id as string },
                metadata:    { clientId: updatedPlan.client_id as string },
            });
        } else {
            await recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'plan.assigned',
                title:       'A new nutrition plan was assigned to you',
                recipients:  [{ type: 'client', id: updatedPlan.client_id as string }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'nutrition_plan', id: updatedPlan.id as string },
                metadata:    { clientId: updatedPlan.client_id as string },
                realtime:    { rooms: [`client:${updatedPlan.client_id as string}`], event: 'plan_assigned', payload: { type: 'nutrition', planId: updatedPlan.id } },
            });
        }

        // A pending nutrition submission for this client is satisfied the
        // moment this plan goes active -- see the guarded UPDATE inside
        // activateSinglePlan (lib/planEngine.ts) for why this fires
        // regardless of whether the coach arrived here via the Plans Queue
        // (with a submissionId) or created/activated the plan directly from
        // the client's own page. Distinct event type from 'checkin.reviewed'
        // since this wasn't a deliberate queue-review click.
        await Promise.all(autoReviewedRequestIds.map((id) => recordEvent({
            workspaceId: req.user!.workspaceId,
            type:        'checkin.auto_reviewed',
            importance:  'info',
            title:       'Your coach reviewed your check-in',
            recipients:  [{ type: 'client', id: updatedPlan.client_id as string }],
            actor:       { type: 'user', id: req.user!.userId },
            entity:      { type: 'form_request', id },
        })));

        res.json({ ...updatedPlan, autoReviewedSubmissionIds: autoReviewedRequestIds });
    } catch (err) { next(err); }
}

export async function duplicatePlan(req: Request, res: Response, next: NextFunction) {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        const originalPlan = await dbClient.query(
            'SELECT * FROM nutrition_plans WHERE id = $1 AND workspace_id = $2',
            [req.params.id, req.user!.workspaceId]
        );
        if (!originalPlan.rows.length) {
            await dbClient.query('ROLLBACK');
            return res.status(404).json({ error: 'Plan not found' });
        }
        const plan = originalPlan.rows[0] as Row;

        const newPlan = await dbClient.query(
            'INSERT INTO nutrition_plans (name, client_id, workspace_id, status, id, created_by, last_edited_by) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *',
            [`Copy of ${plan.name}`, plan.client_id, req.user!.workspaceId, plan.status, createId(), req.user!.userId]
        );
        const newPlanId = (newPlan.rows[0] as Row).id as string;

        const cycles = await dbClient.query(
            'SELECT * FROM nutrition_cycles WHERE plan_id = $1 ORDER BY cycle_order ASC',
            [plan.id]
        );

        for (const cycle of cycles.rows as Row[]) {
            const newCycle = await dbClient.query(
                'INSERT INTO nutrition_cycles (plan_id, name, cycle_order, id) VALUES ($1, $2, $3, $4) RETURNING *',
                [newPlanId, cycle.name, cycle.cycle_order, createId()]
            );
            const newCycleId = (newCycle.rows[0] as Row).id as string;

            const meals = await dbClient.query(
                'SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC',
                [cycle.id]
            );

            for (const meal of meals.rows as Row[]) {
                const newMeal = await dbClient.query(
                    'INSERT INTO nutrition_meals (cycle_id, name, meal_order, id) VALUES ($1, $2, $3, $4) RETURNING *',
                    [newCycleId, meal.name, meal.meal_order, createId()]
                );
                const newMealId = (newMeal.rows[0] as Row).id as string;

                const items = await dbClient.query(
                    'SELECT * FROM nutrition_meal_items WHERE meal_id = $1 ORDER BY meal_item_order ASC',
                    [meal.id]
                );

                for (const item of items.rows as Row[]) {
                    await dbClient.query(
                        'INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order, id) VALUES ($1, $2, $3, $4, $5)',
                        [newMealId, item.food_item_id, item.amount, item.meal_item_order, createId()]
                    );
                }
            }
        }

        await dbClient.query('COMMIT');

        const result = await pool.query(
            `SELECT np.*, (SELECT COUNT(*) FROM nutrition_cycles WHERE plan_id = np.id)::int AS cycle_count
             FROM nutrition_plans np WHERE np.id = $1`,
            [newPlanId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await dbClient.query('ROLLBACK');
        next(err);
    } finally {
        dbClient.release();
    }
}

// ── Cycles ────────────────────────────────────────────────────────────────────

export async function duplicateCycle(req: Request, res: Response, next: NextFunction) {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        const cycleResult = await dbClient.query(
            'SELECT * FROM nutrition_cycles WHERE id = $1', [req.params.id]
        );
        if (!cycleResult.rows.length) {
            await dbClient.query('ROLLBACK');
            return res.status(404).json({ error: 'Cycle not found' });
        }
        const cycle = cycleResult.rows[0] as Row;

        const nextOrderResult = await dbClient.query(
            'SELECT COALESCE(MAX(cycle_order), 0) + 1 AS next_order FROM nutrition_cycles WHERE plan_id = $1',
            [cycle.plan_id]
        );
        const newCycle = await dbClient.query(
            'INSERT INTO nutrition_cycles (plan_id, name, cycle_order, note, goal_calories, goal_protein, goal_carbs, goal_fats, id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [cycle.plan_id, `Copy of ${cycle.name}`, (nextOrderResult.rows[0] as Row).next_order, cycle.note, cycle.goal_calories, cycle.goal_protein, cycle.goal_carbs, cycle.goal_fats, createId()]
        );
        const newCycleId = (newCycle.rows[0] as Row).id as string;

        const meals = await dbClient.query(
            'SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC', [cycle.id]
        );
        for (const meal of meals.rows as Row[]) {
            const newMeal = await dbClient.query(
                'INSERT INTO nutrition_meals (cycle_id, name, meal_order, note, id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [newCycleId, meal.name, meal.meal_order, meal.note, createId()]
            );
            const newMealId = (newMeal.rows[0] as Row).id as string;

            const items = await dbClient.query(
                'SELECT * FROM nutrition_meal_items WHERE meal_id = $1 ORDER BY meal_item_order ASC', [meal.id]
            );
            for (const item of items.rows as Row[]) {
                const newItem = await dbClient.query(
                    'INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order, id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                    [newMealId, item.food_item_id, item.amount, item.meal_item_order, createId()]
                );
                const newItemId = (newItem.rows[0] as Row).id as string;

                const alts = await dbClient.query(
                    'SELECT * FROM nutrition_meal_item_alternatives WHERE meal_item_id = $1 ORDER BY alt_order ASC', [item.id]
                );
                for (const alt of alts.rows as Row[]) {
                    await dbClient.query(
                        'INSERT INTO nutrition_meal_item_alternatives (meal_item_id, food_item_id, amount, alt_order, id) VALUES ($1, $2, $3, $4, $5)',
                        [newItemId, alt.food_item_id, alt.amount, alt.alt_order, createId()]
                    );
                }
            }
        }

        await touchPlan(dbClient, cycle.plan_id as string, req.user!.userId);
        await dbClient.query('COMMIT');

        const fullMeals = await pool.query(
            'SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC', [newCycleId]
        );
        const mealsWithItems = await Promise.all(
            (fullMeals.rows as Row[]).map(async (m) => {
                const itemsRes = await pool.query(
                    `SELECT nmi.id, nmi.food_item_id, nmi.amount, nmi.meal_item_order,
                            fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                            fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                            fi.serving_size, fi.food_category
                     FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id
                     WHERE nmi.meal_id = $1 ORDER BY nmi.meal_item_order ASC`,
                    [m.id]
                );
                const itemsWithAlts = await Promise.all(
                    (itemsRes.rows as Row[]).map(async (item) => {
                        const altsRes = await pool.query(
                            `SELECT nmia.id, nmia.meal_item_id, nmia.food_item_id, nmia.amount, nmia.alt_order,
                                    fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                                    fi.serving_size, fi.food_category
                             FROM nutrition_meal_item_alternatives nmia JOIN food_items fi ON fi.id = nmia.food_item_id
                             WHERE nmia.meal_item_id = $1 ORDER BY nmia.alt_order ASC`,
                            [item.id]
                        );
                        return { ...item, alternatives: altsRes.rows };
                    })
                );
                return { ...m, items: itemsWithAlts };
            })
        );
        res.status(201).json({ ...newCycle.rows[0], meals: mealsWithItems });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        next(err);
    } finally {
        dbClient.release();
    }
}

export async function createCycle(req: Request, res: Response, next: NextFunction) {
    const { name, planId } = req.body as { name?: string; planId?: string };
    try {
        const nextOrderResult = await pool.query(
            'SELECT COALESCE(MAX(cycle_order), 0) + 1 AS next_order FROM nutrition_cycles WHERE plan_id = $1', [planId]
        );
        const cycleResult = await pool.query(
            'INSERT INTO nutrition_cycles (plan_id, name, cycle_order, id) VALUES ($1, $2, $3, $4) RETURNING *',
            [planId, name, (nextOrderResult.rows[0] as Row).next_order, createId()]
        );
        await touchPlan(pool, planId as string, req.user!.userId);
        res.status(201).json(cycleResult.rows[0]);
    } catch (err) { next(err); }
}

export async function updateCycle(req: Request, res: Response, next: NextFunction) {
    const { name, goal_calories, goal_protein, goal_carbs, goal_fats, note } = req.body as Record<string, unknown>;
    try {
        const result = await pool.query(
            `UPDATE nutrition_cycles
             SET name = $1, note = COALESCE($3, note), goal_calories = COALESCE($4, goal_calories),
                 goal_protein = COALESCE($5, goal_protein), goal_carbs = COALESCE($6, goal_carbs),
                 goal_fats = COALESCE($7, goal_fats)
             WHERE id = $2 RETURNING *`,
            [name, req.params.id, note ?? null, goal_calories ?? null, goal_protein ?? null, goal_carbs ?? null, goal_fats ?? null]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Cycle not found' });
        await touchPlan(pool, (result.rows[0] as Row).plan_id as string, req.user!.userId);
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

export async function deleteCycle(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query('DELETE FROM nutrition_cycles WHERE id = $1 RETURNING *', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Cycle not found' });
        await touchPlan(pool, (result.rows[0] as Row).plan_id as string, req.user!.userId);
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

// ── Meals ─────────────────────────────────────────────────────────────────────

export async function duplicateMeal(req: Request, res: Response, next: NextFunction) {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        const mealResult = await dbClient.query('SELECT * FROM nutrition_meals WHERE id = $1', [req.params.id]);
        if (!mealResult.rows.length) {
            await dbClient.query('ROLLBACK');
            return res.status(404).json({ error: 'Meal not found' });
        }
        const meal = mealResult.rows[0] as Row;

        const nextOrderResult = await dbClient.query(
            'SELECT COALESCE(MAX(meal_order), 0) + 1 AS next_order FROM nutrition_meals WHERE cycle_id = $1', [meal.cycle_id]
        );
        const newMeal = await dbClient.query(
            'INSERT INTO nutrition_meals (cycle_id, name, meal_order, id) VALUES ($1, $2, $3, $4) RETURNING *',
            [meal.cycle_id, `Copy of ${meal.name}`, (nextOrderResult.rows[0] as Row).next_order, createId()]
        );
        const newMealId = (newMeal.rows[0] as Row).id as string;

        const items = await dbClient.query(
            'SELECT * FROM nutrition_meal_items WHERE meal_id = $1 ORDER BY meal_item_order ASC', [meal.id]
        );
        for (const item of items.rows as Row[]) {
            const newItem = await dbClient.query(
                'INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order, id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [newMealId, item.food_item_id, item.amount, item.meal_item_order, createId()]
            );
            const alts = await dbClient.query(
                'SELECT * FROM nutrition_meal_item_alternatives WHERE meal_item_id = $1 ORDER BY alt_order ASC', [item.id]
            );
            for (const alt of alts.rows as Row[]) {
                await dbClient.query(
                    'INSERT INTO nutrition_meal_item_alternatives (meal_item_id, food_item_id, amount, alt_order, id) VALUES ($1, $2, $3, $4, $5)',
                    [(newItem.rows[0] as Row).id, alt.food_item_id, alt.amount, alt.alt_order, createId()]
                );
            }
        }

        await touchPlanByCycle(dbClient, meal.cycle_id as string, req.user!.userId);
        await dbClient.query('COMMIT');

        const itemsRes = await pool.query(
            `SELECT nmi.id, nmi.food_item_id, nmi.amount, nmi.meal_item_order,
                    fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                    fi.serving_size, fi.food_category
             FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id
             WHERE nmi.meal_id = $1 ORDER BY nmi.meal_item_order ASC`,
            [newMealId]
        );
        const itemsWithAlts = await Promise.all(
            (itemsRes.rows as Row[]).map(async (item) => {
                const altsRes = await pool.query(
                    `SELECT nmia.id, nmia.meal_item_id, nmia.food_item_id, nmia.amount, nmia.alt_order,
                            fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                            fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                            fi.serving_size, fi.food_category
                     FROM nutrition_meal_item_alternatives nmia JOIN food_items fi ON fi.id = nmia.food_item_id
                     WHERE nmia.meal_item_id = $1 ORDER BY nmia.alt_order ASC`,
                    [item.id]
                );
                return { ...item, alternatives: altsRes.rows };
            })
        );
        res.status(201).json({ ...newMeal.rows[0], items: itemsWithAlts });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        next(err);
    } finally {
        dbClient.release();
    }
}

export async function createMeal(req: Request, res: Response, next: NextFunction) {
    const { name, cycleId } = req.body as { name?: string; cycleId?: string };
    try {
        const nextOrderResult = await pool.query(
            'SELECT COALESCE(MAX(meal_order), 0) + 1 AS next_order FROM nutrition_meals WHERE cycle_id = $1', [cycleId]
        );
        const mealResult = await pool.query(
            'INSERT INTO nutrition_meals (cycle_id, name, meal_order, id) VALUES ($1, $2, $3, $4) RETURNING *',
            [cycleId, name, (nextOrderResult.rows[0] as Row).next_order, createId()]
        );
        await touchPlanByCycle(pool, cycleId as string, req.user!.userId);
        res.status(201).json(mealResult.rows[0]);
    } catch (err) { next(err); }
}

export async function updateMeal(req: Request, res: Response, next: NextFunction) {
    const { name, note } = req.body as { name?: string; note?: string };
    try {
        const result = await pool.query(
            'UPDATE nutrition_meals SET name = $1, note = COALESCE($3, note) WHERE id = $2 RETURNING *',
            [name, req.params.id, note ?? null]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Meal not found' });
        await touchPlanByCycle(pool, (result.rows[0] as Row).cycle_id as string, req.user!.userId);
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

export async function deleteMeal(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query('DELETE FROM nutrition_meals WHERE id = $1 RETURNING *', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Meal not found' });
        await touchPlanByCycle(pool, (result.rows[0] as Row).cycle_id as string, req.user!.userId);
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

// ── Meal Items ────────────────────────────────────────────────────────────────

export async function createMealItem(req: Request, res: Response, next: NextFunction) {
    const { mealId, foodItemId, amount } = req.body as { mealId?: string; foodItemId?: string; amount?: unknown };
    try {
        const nextOrderResult = await pool.query(
            'SELECT COALESCE(MAX(meal_item_order), 0) + 1 AS next_order FROM nutrition_meal_items WHERE meal_id = $1', [mealId]
        );
        const itemResult = await pool.query(
            'INSERT INTO nutrition_meal_items (meal_id, food_item_id, amount, meal_item_order, id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [mealId, foodItemId, amount, (nextOrderResult.rows[0] as Row).next_order, createId()]
        );
        await touchPlanByMeal(pool, mealId as string, req.user!.userId);
        const itemDetailsResult = await pool.query(
            `SELECT nmi.id, nmi.food_item_id, nmi.amount, nmi.meal_item_order,
                    fi.serving_unit, fi.name_en AS name, fi.name_ar, fi.calories_per_serving,
                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                    fi.serving_size, fi.food_category
             FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id
             WHERE nmi.id = $1`,
            [(itemResult.rows[0] as Row).id]
        );
        res.status(201).json(itemDetailsResult.rows[0]);
    } catch (err) { next(err); }
}

export async function reorderMealItems(req: Request, res: Response, next: NextFunction) {
    const { items } = req.body as { items?: { id: string; order: number }[] };
    try {
        await Promise.all(
            (items ?? []).map((item) =>
                pool.query('UPDATE nutrition_meal_items SET meal_item_order = $1 WHERE id = $2', [item.order, item.id])
            )
        );
        if (items && items.length > 0) {
            await touchPlanByMealItem(pool, items[0].id, req.user!.userId);
        }
        res.json({ success: true });
    } catch (err) { next(err); }
}

export async function updateMealItem(req: Request, res: Response, next: NextFunction) {
    const { amount } = req.body as { amount?: unknown };
    try {
        // A direct coach edit always reasserts the coach's prescription and ends
        // any client food swap on this item — falls back to the pre-swap food,
        // then clears the swap columns. A no-op when the item was never swapped.
        const result = await pool.query(
            `UPDATE nutrition_meal_items
             SET amount = $1,
                 food_item_id = COALESCE(original_food_item_id, food_item_id),
                 is_swapped = FALSE,
                 original_food_item_id = NULL,
                 original_amount = NULL,
                 swapped_at = NULL,
                 swapped_by_client_id = NULL
             WHERE id = $2
             RETURNING *`,
            [amount, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Meal item not found' });
        const itemDetailsResult = await pool.query(
            `SELECT nmi.id, nmi.food_item_id, nmi.amount, nmi.meal_item_order,
                    fi.serving_unit, fi.name_en AS name, fi.name_ar, fi.calories_per_serving,
                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                    fi.serving_size, fi.food_category
             FROM nutrition_meal_items nmi JOIN food_items fi ON fi.id = nmi.food_item_id
             WHERE nmi.id = $1`,
            [(result.rows[0] as Row).id]
        );
        await touchPlanByMeal(pool, (result.rows[0] as Row).meal_id as string, req.user!.userId);
        res.json(itemDetailsResult.rows[0]);
    } catch (err) { next(err); }
}

export async function deleteMealItem(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query('DELETE FROM nutrition_meal_items WHERE id = $1 RETURNING *', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Meal item not found' });
        await touchPlanByMeal(pool, (result.rows[0] as Row).meal_id as string, req.user!.userId);
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

// ── Meal Item Alternatives ────────────────────────────────────────────────────

export async function createMealItemAlternative(req: Request, res: Response, next: NextFunction) {
    const { foodItemId, amount } = req.body as { foodItemId?: string; amount?: unknown };
    const mealItemId = req.params.id as string;
    try {
        const mainItem = await pool.query('SELECT food_item_id FROM nutrition_meal_items WHERE id = $1', [mealItemId]);
        if (!mainItem.rows.length) return res.status(404).json({ error: 'Meal item not found' });
        if ((mainItem.rows[0] as Row).food_item_id === foodItemId) {
            return res.status(409).json({ error: 'Cannot add the main item as its own alternative' });
        }

        const existing = await pool.query(
            'SELECT id FROM nutrition_meal_item_alternatives WHERE meal_item_id = $1 AND food_item_id = $2',
            [mealItemId, foodItemId]
        );
        if (existing.rows.length) {
            return res.status(409).json({ error: 'This food item is already an alternative for this item' });
        }

        const nextOrderResult = await pool.query(
            'SELECT COALESCE(MAX(alt_order), 0) + 1 AS next_order FROM nutrition_meal_item_alternatives WHERE meal_item_id = $1',
            [mealItemId]
        );
        const result = await pool.query(
            'INSERT INTO nutrition_meal_item_alternatives (meal_item_id, food_item_id, amount, alt_order, id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [mealItemId, foodItemId, amount, (nextOrderResult.rows[0] as Row).next_order, createId()]
        );

        await touchPlanByMealItem(pool, mealItemId, req.user!.userId);

        const details = await pool.query(
            `SELECT nmia.id, nmia.meal_item_id, nmia.food_item_id, nmia.amount, nmia.alt_order,
                    fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                    fi.serving_size, fi.food_category
             FROM nutrition_meal_item_alternatives nmia JOIN food_items fi ON fi.id = nmia.food_item_id
             WHERE nmia.id = $1`,
            [(result.rows[0] as Row).id]
        );
        res.status(201).json(details.rows[0]);
    } catch (err) { next(err); }
}

export async function updateMealItemAlternative(req: Request, res: Response, next: NextFunction) {
    const { amount } = req.body as { amount?: unknown };
    try {
        const result = await pool.query(
            'UPDATE nutrition_meal_item_alternatives SET amount = $1 WHERE id = $2 RETURNING *', [amount, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Alternative not found' });
        await touchPlanByMealItem(pool, (result.rows[0] as Row).meal_item_id as string, req.user!.userId);
        const details = await pool.query(
            `SELECT nmia.id, nmia.meal_item_id, nmia.food_item_id, nmia.amount, nmia.alt_order,
                    fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                    fi.serving_size, fi.food_category
             FROM nutrition_meal_item_alternatives nmia JOIN food_items fi ON fi.id = nmia.food_item_id
             WHERE nmia.id = $1`,
            [(result.rows[0] as Row).id]
        );
        res.json(details.rows[0]);
    } catch (err) { next(err); }
}

export async function deleteMealItemAlternative(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query(
            'DELETE FROM nutrition_meal_item_alternatives WHERE id = $1 RETURNING *', [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Alternative not found' });
        await touchPlanByMealItem(pool, (result.rows[0] as Row).meal_item_id as string, req.user!.userId);
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

// Client food-swap audit trail, for support — read-only, workspace-scoped so
// a coach can only see swap history for their own workspace's meal items.
export async function getMealItemSwapHistory(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query(
            `SELECT h.id, h.from_food_item_id, h.to_food_item_id, h.from_amount, h.to_amount,
                    h.action, h.created_at,
                    ff.name_en AS from_food_name, tf.name_en AS to_food_name,
                    TRIM(CONCAT(c.fname, ' ', c.lname)) AS client_name
             FROM food_swap_history h
             JOIN nutrition_meal_items nmi ON nmi.id = h.meal_item_id
             JOIN nutrition_meals nm ON nm.id = nmi.meal_id
             JOIN nutrition_cycles nc ON nc.id = nm.cycle_id
             JOIN nutrition_plans np ON np.id = nc.plan_id
             LEFT JOIN food_items ff ON ff.id = h.from_food_item_id
             LEFT JOIN food_items tf ON tf.id = h.to_food_item_id
             LEFT JOIN clients c ON c.id = h.client_id
             WHERE h.meal_item_id = $1 AND np.workspace_id = $2
             ORDER BY h.created_at DESC`,
            [req.params.id, req.user!.workspaceId]
        );
        res.json(result.rows);
    } catch (err) { next(err); }
}
