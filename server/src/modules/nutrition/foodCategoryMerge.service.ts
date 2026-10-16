import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// "Merge categories": a coach folds several of their food categories into one so the
// existing "same category" swap rule treats those foods as interchangeable. Pure data
// move — food_items.food_category is a plain string matched against
// food_categories.name_en, so a merge is "rewrite the strings, drop the source rows".
// Plans and swap history reference food_item_id, never a category, so they are untouched.

type Tx = Prisma.TransactionClient;

const NAME_MAX_LENGTH = 100;
const MIN_CATEGORIES_TO_MERGE = 2;
const MERGE_TX_TIMEOUT_MS = 60_000;
const MERGE_LIST_LIMIT = 10;
const SKIPPED_ITEMS_REPORT_LIMIT = 20;

export class MergeError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

export type CategoryRow = { id: string; name_en: string; name_ar: string | null };
type MovedItem = { id: string; from: string };
type MergeTarget = { id: string } | { name_en: string; name_ar: string | null };
export type MergeInput = { sourceIds: string[]; target: MergeTarget };

type MergePlan = {
    target: CategoryRow & { isNew: boolean };
    fillTargetAr: string | null;
    sources: Array<CategoryRow & { itemCount: number }>;
    movedItems: MovedItem[];
};

// Same normalisation in JS and SQL (collapse whitespace, trim, lowercase) so
// "  beef   products " matches "Beef Products" on both sides.
export function normalizeCategoryName(name: string): string {
    return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function displayName(name: string): string {
    return name.replace(/\s+/g, ' ').trim();
}

// Double backslash: inside a template literal a bare \s would be cooked to "s" and silently break the regex.
// Double backslash on purpose: in a template literal a bare \s is cooked to "s" and silently breaks the regex.
const SQL_NORMALIZED_CATEGORY = Prisma.sql`lower(btrim(regexp_replace(food_category, '\\s+', ' ', 'g')))`;
const SQL_NORMALIZED_NAME = Prisma.sql`lower(btrim(regexp_replace(name_en, '\\s+', ' ', 'g')))`;

// ── Input ───────────────────────────────────────────────────────────────────

function optionalName(value: unknown, field: string): string | null {
    if (value == null || value === '') return null;
    if (typeof value !== 'string') throw new MergeError(400, `${field} must be text`);
    const name = displayName(value);
    if (name.length > NAME_MAX_LENGTH) throw new MergeError(400, `${field} must be ${NAME_MAX_LENGTH} characters or fewer`);
    return name || null;
}

export function parseMergeInput(body: unknown): MergeInput {
    const { sourceIds, target } = (body ?? {}) as { sourceIds?: unknown; target?: unknown };

    if (!Array.isArray(sourceIds) || sourceIds.some((id) => typeof id !== 'string' || !id)) {
        throw new MergeError(400, 'sourceIds must be a list of category ids');
    }
    const uniqueIds = [...new Set(sourceIds as string[])];
    if (uniqueIds.length < MIN_CATEGORIES_TO_MERGE) {
        throw new MergeError(400, `Select at least ${MIN_CATEGORIES_TO_MERGE} different categories to merge`);
    }

    if (!target || typeof target !== 'object') throw new MergeError(400, 'target is required');
    const { id, name_en, name_ar } = target as Record<string, unknown>;
    if (typeof id === 'string' && id) return { sourceIds: uniqueIds, target: { id } };

    const nameEn = optionalName(name_en, 'name_en');
    if (!nameEn) throw new MergeError(400, 'Choose a category to keep or enter a new category name');
    return { sourceIds: uniqueIds, target: { name_en: nameEn, name_ar: optionalName(name_ar, 'name_ar') } };
}

// ── Plan (shared by preview and merge so the preview can never disagree) ───

async function resolveTarget(
    tx: Tx, workspaceId: string, selected: CategoryRow[], target: MergeTarget
): Promise<Pick<MergePlan, 'target' | 'fillTargetAr'>> {
    if ('id' in target) {
        const row = selected.find((category) => category.id === target.id);
        if (!row) throw new MergeError(400, 'The category to keep must be one of the selected categories');
        return { target: { ...row, isNew: false }, fillTargetAr: null };
    }

    // A name that already exists in this workspace is reused, never duplicated.
    const matches = await tx.$queryRaw<CategoryRow[]>`
        SELECT id, name_en, name_ar FROM food_categories
        WHERE workspace_id = ${workspaceId} AND ${SQL_NORMALIZED_NAME} = ${normalizeCategoryName(target.name_en)}
        ORDER BY id
    `;
    const existing = matches.find((row) => selected.some((s) => s.id === row.id)) ?? matches[0];
    if (existing) {
        // Never overwrite the coach's own Arabic name — only fill it in when empty.
        const fillTargetAr = !existing.name_ar && target.name_ar ? target.name_ar : null;
        return { target: { ...existing, isNew: false }, fillTargetAr };
    }
    return {
        target: { id: createId(), name_en: displayName(target.name_en), name_ar: target.name_ar, isNew: true },
        fillTargetAr: null,
    };
}

async function buildMergePlan(tx: Tx, workspaceId: string, input: MergeInput): Promise<MergePlan> {
    const selected = await tx.food_categories.findMany({
        where:  { workspace_id: workspaceId, id: { in: input.sourceIds } },
        select: { id: true, name_en: true, name_ar: true },
    });
    // Same answer for "doesn't exist" and "belongs to another workspace" — no id probing.
    if (selected.length !== input.sourceIds.length) throw new MergeError(404, 'Food category not found');

    const { target, fillTargetAr } = await resolveTarget(tx, workspaceId, selected, input.target);
    const sourceRows = selected.filter((category) => category.id !== target.id);
    if (sourceRows.length === 0) throw new MergeError(400, 'Cannot merge a category into itself');

    const sourceNames = [...new Set(sourceRows.map((s) => normalizeCategoryName(s.name_en)))];
    // Matches on the normalised string, so orphan items (a category string with no row,
    // or a case/spacing variant of a source name) move too. Items already holding the
    // target's exact name are left alone.
    const rows = await tx.$queryRaw<Array<{ id: string; previous_category: string }>>`
        SELECT id, food_category AS previous_category FROM food_items
        WHERE workspace_id = ${workspaceId}
          AND food_category IS NOT NULL
          AND ${SQL_NORMALIZED_CATEGORY} = ANY(${sourceNames}::text[])
          AND food_category <> ${target.name_en}
    `;
    const movedItems = rows.map((row) => ({ id: row.id, from: row.previous_category }));

    const countByName = new Map<string, number>();
    for (const item of movedItems) {
        const key = normalizeCategoryName(item.from);
        countByName.set(key, (countByName.get(key) ?? 0) + 1);
    }
    const sources = sourceRows.map((row) => ({ ...row, itemCount: countByName.get(normalizeCategoryName(row.name_en)) ?? 0 }));

    return { target, fillTargetAr, sources, movedItems };
}

// One merge/undo at a time per workspace, so two coaches (or two tabs) can't interleave
// and so "undo the latest merge" always has one unambiguous answer.
async function lockWorkspaceMerges(tx: Tx, workspaceId: string): Promise<void> {
    // $executeRaw, not $queryRaw: the function returns void, which Prisma can't deserialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`food_category_merge:${workspaceId}`}))`;
}

function describePlan(plan: MergePlan) {
    return {
        target:        { id: plan.target.isNew ? null : plan.target.id, name_en: plan.target.name_en, name_ar: plan.target.name_ar ?? plan.fillTargetAr, is_new: plan.target.isNew },
        items_to_move: plan.movedItems.length,
        sources:       plan.sources.map((s) => ({ id: s.id, name_en: s.name_en, name_ar: s.name_ar, item_count: s.itemCount })),
    };
}

// ── Preview ─────────────────────────────────────────────────────────────────

export async function previewMerge(workspaceId: string, input: MergeInput) {
    return describePlan(await buildMergePlan(prisma, workspaceId, input));
}

// ── Merge ───────────────────────────────────────────────────────────────────

export async function executeMerge(workspaceId: string, userId: string, input: MergeInput) {
    return prisma.$transaction(async (tx) => {
        await lockWorkspaceMerges(tx, workspaceId);
        const plan = await buildMergePlan(tx, workspaceId, input);

        if (plan.target.isNew) {
            await tx.food_categories.create({
                data: { id: plan.target.id, workspace_id: workspaceId, name_en: plan.target.name_en, name_ar: plan.target.name_ar },
            });
        } else if (plan.fillTargetAr) {
            await tx.food_categories.update({ where: { id: plan.target.id }, data: { name_ar: plan.fillTargetAr } });
        }

        // Explicit rewrite — deliberately not the rename cascade in updateFoodCategory.
        if (plan.movedItems.length > 0) {
            await tx.$executeRaw`
                UPDATE food_items SET food_category = ${plan.target.name_en}
                WHERE workspace_id = ${workspaceId} AND id = ANY(${plan.movedItems.map((item) => item.id)}::text[])
            `;
        }
        await tx.food_categories.deleteMany({ where: { workspace_id: workspaceId, id: { in: plan.sources.map((s) => s.id) } } });

        const log = await tx.food_category_merges.create({
            data: {
                id:                 createId(),
                workspace_id:       workspaceId,
                performed_by:       userId,
                target_category_id: plan.target.id,
                target_name_en:     plan.target.name_en,
                target_created:     plan.target.isNew,
                source_categories:  plan.sources.map((s) => ({ id: s.id, name_en: s.name_en, name_ar: s.name_ar })),
                moved_items:        plan.movedItems,
                items_moved:        plan.movedItems.length,
            },
        });

        return { merge_id: log.id, items_moved: plan.movedItems.length, ...describePlan(plan) };
    }, { timeout: MERGE_TX_TIMEOUT_MS });
}

// ── History ─────────────────────────────────────────────────────────────────

export async function listRecentMerges(workspaceId: string) {
    const merges = await prisma.food_category_merges.findMany({
        where:   { workspace_id: workspaceId },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take:    MERGE_LIST_LIMIT,
        select:  { id: true, performed_by: true, target_name_en: true, source_categories: true, items_moved: true, created_at: true, undone_at: true },
    });
    const userIds = [...new Set(merges.map((m) => m.performed_by).filter((id): id is string => !!id))];
    const users = await prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, fname: true, lname: true } });
    const userName = new Map(users.map((u) => [u.id, `${u.fname ?? ''} ${u.lname ?? ''}`.trim()]));

    // Only the newest merge that hasn't been undone can be undone.
    const latestUndoable = merges.find((m) => !m.undone_at);
    return merges.map((m) => ({
        id:                m.id,
        performed_by_name: m.performed_by ? userName.get(m.performed_by) ?? null : null,
        target_name_en:    m.target_name_en,
        source_categories: m.source_categories,
        items_moved:       m.items_moved,
        created_at:        m.created_at,
        undone_at:         m.undone_at,
        can_undo:          m.id === latestUndoable?.id,
    }));
}

// ── Undo ────────────────────────────────────────────────────────────────────

export async function undoMerge(workspaceId: string, userId: string, mergeId: string) {
    return prisma.$transaction(async (tx) => {
        await lockWorkspaceMerges(tx, workspaceId);

        const merge = await tx.food_category_merges.findFirst({ where: { id: mergeId, workspace_id: workspaceId } });
        if (!merge) throw new MergeError(404, 'Merge not found');
        if (merge.undone_at) throw new MergeError(409, 'This merge was already undone');

        const latest = await tx.food_category_merges.findFirst({
            where:   { workspace_id: workspaceId, undone_at: null },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            select:  { id: true },
        });
        if (latest?.id !== merge.id) throw new MergeError(409, 'Only the most recent merge can be undone');

        const sources = merge.source_categories as CategoryRow[];
        const movedItems = merge.moved_items as MovedItem[];

        // Items were set to the target's name at merge time; if the coach renamed the
        // target since, updateFoodCategory carried the items along, so use its current name.
        const targetRow = await tx.food_categories.findFirst({ where: { id: merge.target_category_id, workspace_id: workspaceId } });
        const expectedCategory = targetRow?.name_en ?? merge.target_name_en;

        const current = await tx.food_items.findMany({
            where:  { workspace_id: workspaceId, id: { in: movedItems.map((item) => item.id) } },
            select: { id: true, name_en: true, food_category: true },
        });
        const currentById = new Map(current.map((item) => [item.id, item]));

        const restorable = movedItems.filter((item) => currentById.get(item.id)?.food_category === expectedCategory);
        const skippedEdited = movedItems.filter((item) => currentById.has(item.id) && currentById.get(item.id)?.food_category !== expectedCategory);
        const skippedDeleted = movedItems.filter((item) => !currentById.has(item.id));

        const { recreated, reused } = await restoreSourceCategories(tx, workspaceId, sources);

        if (restorable.length > 0) {
            await tx.$executeRaw`
                UPDATE food_items fi SET food_category = v.previous_category
                FROM unnest(${restorable.map((item) => item.id)}::text[], ${restorable.map((item) => item.from)}::text[]) AS v(id, previous_category)
                WHERE fi.id = v.id AND fi.workspace_id = ${workspaceId}
            `;
        }

        const targetRemoved = await removeTargetIfUnused(tx, workspaceId, merge.target_created, targetRow);

        await tx.food_category_merges.update({ where: { id: merge.id }, data: { undone_at: new Date(), undone_by: userId } });

        return {
            merge_id:             merge.id,
            restored_items:       restorable.length,
            skipped_edited:       skippedEdited.length,
            skipped_deleted:      skippedDeleted.length,
            skipped_items:        skippedEdited.slice(0, SKIPPED_ITEMS_REPORT_LIMIT).map((item) => ({ id: item.id, name_en: currentById.get(item.id)?.name_en ?? null, reason: 'edited' })),
            recreated_categories: recreated,
            reused_categories:    reused,
            target_removed:       targetRemoved,
        };
    }, { timeout: MERGE_TX_TIMEOUT_MS });
}

async function restoreSourceCategories(tx: Tx, workspaceId: string, sources: CategoryRow[]) {
    const existing = await tx.food_categories.findMany({ where: { workspace_id: workspaceId }, select: { id: true, name_en: true } });
    const existingNames = new Set(existing.map((category) => normalizeCategoryName(category.name_en)));

    let recreated = 0;
    let reused = 0;
    for (const source of sources) {
        // The coach may have re-created a same-named category since — reuse it, don't duplicate.
        if (existingNames.has(normalizeCategoryName(source.name_en))) { reused += 1; continue; }
        await tx.food_categories.create({ data: { id: source.id, workspace_id: workspaceId, name_en: source.name_en, name_ar: source.name_ar } });
        existingNames.add(normalizeCategoryName(source.name_en));
        recreated += 1;
    }
    return { recreated, reused };
}

// A target created by the merge goes away with it — but only if nothing is left in it
// (items the coach added after the merge must not be orphaned).
async function removeTargetIfUnused(tx: Tx, workspaceId: string, targetCreated: boolean, targetRow: { id: string; name_en: string } | null): Promise<boolean> {
    if (!targetCreated || !targetRow) return false;
    const remaining = await tx.food_items.count({ where: { workspace_id: workspaceId, food_category: targetRow.name_en } });
    if (remaining > 0) return false;
    await tx.food_categories.delete({ where: { id: targetRow.id } });
    return true;
}
