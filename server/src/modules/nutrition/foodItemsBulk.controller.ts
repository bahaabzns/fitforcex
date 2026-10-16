import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';

// Bulk actions on the coach's food items (nutrition/food-items page: select rows →
// change category / delete). Everything is scoped to req.user.workspaceId, and the
// whole id list is checked up front: if any id isn't one of this workspace's items
// the request fails as a whole (404) and nothing is written.

const BULK_MAX_IDS = 5000;
const CATEGORY_NAME_MAX_LENGTH = 100;

class BulkError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

function parseIds(body: unknown): string[] {
    const { ids } = (body ?? {}) as { ids?: unknown };
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string' || !id)) {
        throw new BulkError(400, 'ids must be a non-empty list of food item ids');
    }
    const unique = [...new Set(ids as string[])];
    if (unique.length > BULK_MAX_IDS) throw new BulkError(400, `At most ${BULK_MAX_IDS} food items per request`);
    return unique;
}

async function assertAllInWorkspace(workspaceId: string, ids: string[]): Promise<void> {
    const found = await prisma.food_items.count({ where: { workspace_id: workspaceId, id: { in: ids } } });
    if (found !== ids.length) throw new BulkError(404, 'Food item not found');
}

// '' / null clears the category; otherwise it must be one of this workspace's categories,
// so a bulk move can never create the orphan strings a typo would.
async function parseTargetCategory(workspaceId: string, value: unknown): Promise<string | null> {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.length > CATEGORY_NAME_MAX_LENGTH) throw new BulkError(400, 'Invalid food category');
    const exists = await prisma.food_categories.findFirst({ where: { workspace_id: workspaceId, name_en: value }, select: { id: true } });
    if (!exists) throw new BulkError(400, 'Food category not found');
    return value;
}

function handle(action: (req: Request, res: Response) => Promise<void>) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await action(req, res);
        } catch (err) {
            if (err instanceof BulkError) return void res.status(err.status).json({ error: err.message });
            next(err);
        }
    };
}

export const bulkChangeFoodItemCategory = handle(async (req, res) => {
    const workspaceId = req.user!.workspaceId as string;
    const ids = parseIds(req.body);
    const category = await parseTargetCategory(workspaceId, (req.body as { food_category?: unknown }).food_category);

    const updated = await prisma.$transaction(async (tx) => {
        const found = await tx.food_items.count({ where: { workspace_id: workspaceId, id: { in: ids } } });
        if (found !== ids.length) throw new BulkError(404, 'Food item not found');
        const result = await tx.food_items.updateMany({ where: { workspace_id: workspaceId, id: { in: ids } }, data: { food_category: category } });
        return result.count;
    });
    res.json({ updated });
});

// How much of the coach's diet plans use these foods. Deleting a food item cascades to
// the plan entries that use it, so the UI shows this before asking to confirm.
export const getFoodItemsUsage = handle(async (req, res) => {
    const workspaceId = req.user!.workspaceId as string;
    const ids = parseIds(req.body);
    await assertAllInWorkspace(workspaceId, ids);

    const [entries] = await prisma.$queryRaw<Array<{ meal_items: number; plans: number }>>`
        SELECT count(DISTINCT nmi.id)::int AS meal_items, count(DISTINCT np.id)::int AS plans
        FROM nutrition_meal_items nmi
        JOIN nutrition_meals nm  ON nm.id = nmi.meal_id
        JOIN nutrition_cycles nc ON nc.id = nm.cycle_id
        JOIN nutrition_plans np  ON np.id = nc.plan_id
        WHERE nmi.food_item_id = ANY(${ids}::text[])
    `;
    const alternatives = await prisma.nutrition_meal_item_alternatives.count({ where: { food_item_id: { in: ids } } });
    res.json({ meal_items: entries.meal_items, plans: entries.plans, alternatives });
});

export const bulkDeleteFoodItems = handle(async (req, res) => {
    const workspaceId = req.user!.workspaceId as string;
    const ids = parseIds(req.body);

    const deleted = await prisma.$transaction(async (tx) => {
        const found = await tx.food_items.count({ where: { workspace_id: workspaceId, id: { in: ids } } });
        if (found !== ids.length) throw new BulkError(404, 'Food item not found');
        const result = await tx.food_items.deleteMany({ where: { workspace_id: workspaceId, id: { in: ids } } });
        return result.count;
    });
    res.json({ deleted });
});
