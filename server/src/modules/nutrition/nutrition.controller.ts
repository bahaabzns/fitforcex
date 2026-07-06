import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { PoolClient } from 'pg';
import {
    toIsoDateOrNull,
    serializePlanRow,
    serializePlanRows,
    normalizeOrderedList,
    insertOrderedChildren,
    replaceClientPlansTransactional,
    activateSinglePlan,
    saveSinglePlanDraft,
} from '../../lib/planEngine';
import pool from '../../db';
import { prisma } from '../../lib/prisma';
import { toNumberOrNull } from './nutrition.service';
import { recordEvent } from '../../lib/events';

type Row = Record<string, unknown>;

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
                NULLIF(TRIM(COALESCE(c.fname, '') || ' ' || COALESCE(c.lname, '')), '') AS client_name,
                NULLIF(TRIM(COALESCE(u.fname, '') || ' ' || COALESCE(u.lname, '')), '') AS creator_name,
                (SELECT COUNT(*)::int FROM nutrition_cycles nc WHERE nc.plan_id = np.id) AS cycle_count,
                (SELECT ROUND(AVG(nc.goal_calories))::int FROM nutrition_cycles nc WHERE nc.plan_id = np.id AND nc.goal_calories IS NOT NULL) AS avg_calories,
                (SELECT ROUND(AVG(nc.goal_protein))::int  FROM nutrition_cycles nc WHERE nc.plan_id = np.id AND nc.goal_protein  IS NOT NULL) AS avg_protein,
                (SELECT ROUND(AVG(nc.goal_carbs))::int    FROM nutrition_cycles nc WHERE nc.plan_id = np.id AND nc.goal_carbs    IS NOT NULL) AS avg_carbs,
                (SELECT ROUND(AVG(nc.goal_fats))::int     FROM nutrition_cycles nc WHERE nc.plan_id = np.id AND nc.goal_fats     IS NOT NULL) AS avg_fats
             FROM nutrition_plans np
             LEFT JOIN clients c ON c.id = np.client_id
             LEFT JOIN users u ON u.id = np.created_by
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
            `SELECT np.*, (SELECT COUNT(*) FROM nutrition_cycles WHERE plan_id = np.id)::int AS cycle_count
             FROM nutrition_plans np
             WHERE np.workspace_id = $1 AND np.client_id = $2
             ORDER BY np.created_at DESC`,
            [req.user!.workspaceId, req.query.clientId as string]
        );
        res.json(serializePlanRows(result.rows));
    } catch (err) { next(err); }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
    try {
        const planResult = await pool.query(
            'SELECT * FROM nutrition_plans WHERE id = $1 AND workspace_id = $2',
            [req.params.id, req.user!.workspaceId]
        );
        if (!planResult.rows.length) return res.status(404).json({ error: 'Nutrition plan not found' });

        const cyclesResult = await pool.query(
            'SELECT * FROM nutrition_cycles WHERE plan_id = $1 ORDER BY cycle_order ASC',
            [req.params.id]
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
                            `SELECT nmi.id, nmi.food_item_id, nmi.amount, nmi.meal_item_order,
                                    fi.name_en AS name, fi.name_ar, fi.serving_unit, fi.calories_per_serving,
                                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                                    fi.serving_size, fi.food_category
                             FROM nutrition_meal_items nmi
                             JOIN food_items fi ON fi.id = nmi.food_item_id
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
        const plan = planResult.rows[0] as Row;

        res.json({
            id: plan.id, name: plan.name, client_id: plan.client_id, status: plan.status,
            created_at: serializedPlan.created_at, updated_at: serializedPlan.updated_at, cycles,
        });
    } catch (err) { next(err); }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
    const { name, client_id } = req.body as { name?: string; client_id?: string };
    try {
        const planResult = await pool.query(
            'INSERT INTO nutrition_plans (name, client_id, workspace_id, id) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, client_id, req.user!.workspaceId, createId()]
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

                    const insertedPlan = await dbClient.query(
                        `INSERT INTO nutrition_plans (name, client_id, workspace_id, status, created_at, updated_at, created_by, id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                        [
                            (plan.name as string) || `Plan ${pIndex + 1}`,
                            clientId, req.user!.workspaceId,
                            plan.status === 'active' ? 'active' : 'inactive',
                            createdAt, updatedAt,
                            (plan.created_by as string | null) ?? req.user!.userId,
                            createId(),
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
                        `UPDATE nutrition_plans SET status = CASE WHEN id = $1 THEN 'active' ELSE 'inactive' END
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
    const { clientId, plan, activePlanId = null } = req.body as { clientId: string; plan: Row; activePlanId?: string | null };

    try {
        let existingCreatedBy: string | null = null;

        const result = await saveSinglePlanDraft({
            pool, plan, clientId, coachId: req.user!.workspaceId, activePlanId,
            loadExistingPlan: async ({ dbClient, planId, clientId: cId, coachId }: { dbClient: PoolClient; planId: string; clientId: string; coachId: string }) => {
                const existing = await dbClient.query(
                    `SELECT id, created_at, created_by FROM nutrition_plans WHERE id = $1 AND workspace_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
                existingCreatedBy = (existing.rows[0] as Row)?.created_by as string ?? null;
                return existing.rows[0] ?? null;
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
                    `INSERT INTO nutrition_plans (name, client_id, workspace_id, status, created_at, updated_at, created_by, id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                    [
                        (incomingPlan.name as string) || 'Untitled Plan',
                        cId, coachId,
                        incomingPlan.status === 'active' ? 'active' : 'inactive',
                        createdAt, updatedAt, createdBy, createId(),
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
            activatePlanInTransaction: async ({ dbClient, planId, clientId: cId, coachId }: { dbClient: PoolClient; planId: unknown; clientId: string; coachId: string }) => {
                await dbClient.query(
                    `UPDATE nutrition_plans SET status = CASE WHEN id = $1 THEN 'active' ELSE 'inactive' END
                     WHERE workspace_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
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

        res.json(result);
    } catch (err) { next(err); }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
    const { name, status } = req.body as { name?: string; status?: string };
    try {
        const result = await pool.query(
            'UPDATE nutrition_plans SET name = $1, status = $2, updated_at = NOW() WHERE id = $3 AND workspace_id = $4 RETURNING *',
            [name, status, req.params.id, req.user!.workspaceId]
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
    try {
        const updatedPlan = await activateSinglePlan({
            pool,
            tableName:      'nutrition_plans',
            planId:         req.params.id as string,
            coachId:        req.user!.workspaceId,
            clientIdColumn: 'client_id',
        });
        if (!updatedPlan) return res.status(404).json({ error: 'Plan not found' });

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

        res.json(updatedPlan);
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
            'INSERT INTO nutrition_plans (name, client_id, workspace_id, status, id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [`Copy of ${plan.name}`, plan.client_id, req.user!.workspaceId, plan.status, createId()]
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

        await dbClient.query('UPDATE nutrition_plans SET updated_at = NOW() WHERE id = $1', [cycle.plan_id]);
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
        await pool.query('UPDATE nutrition_plans SET updated_at = NOW() WHERE id = $1', [planId]);
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
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

export async function deleteCycle(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query('DELETE FROM nutrition_cycles WHERE id = $1 RETURNING *', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Cycle not found' });
        await pool.query('UPDATE nutrition_plans SET updated_at = NOW() WHERE id = $1', [(result.rows[0] as Row).plan_id]);
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

        await dbClient.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)',
            [meal.cycle_id]
        );
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
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)', [cycleId]
        );
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
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)',
            [(result.rows[0] as Row).cycle_id]
        );
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}

export async function deleteMeal(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query('DELETE FROM nutrition_meals WHERE id = $1 RETURNING *', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Meal not found' });
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT plan_id FROM nutrition_cycles WHERE id = $1)',
            [(result.rows[0] as Row).cycle_id]
        );
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
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT nc.plan_id FROM nutrition_cycles nc JOIN nutrition_meals nm ON nm.cycle_id = nc.id WHERE nm.id = $1)',
            [mealId]
        );
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
        res.json({ success: true });
    } catch (err) { next(err); }
}

export async function updateMealItem(req: Request, res: Response, next: NextFunction) {
    const { amount } = req.body as { amount?: unknown };
    try {
        const result = await pool.query(
            'UPDATE nutrition_meal_items SET amount = $1 WHERE id = $2 RETURNING *', [amount, req.params.id]
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
        await pool.query(
            'UPDATE nutrition_plans SET updated_at = NOW() WHERE id = (SELECT nc.plan_id FROM nutrition_cycles nc JOIN nutrition_meals nm ON nm.cycle_id = nc.id WHERE nm.id = $1)',
            [(result.rows[0] as Row).meal_id]
        );
        res.json(itemDetailsResult.rows[0]);
    } catch (err) { next(err); }
}

export async function deleteMealItem(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query('DELETE FROM nutrition_meal_items WHERE id = $1 RETURNING *', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Meal item not found' });
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
        res.json(result.rows[0]);
    } catch (err) { next(err); }
}
