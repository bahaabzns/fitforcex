import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { serializePackage, serializePackages } from './packages.serializer';

const PLAN_UPDATE_MODES = ['restart', 'extend'];
const DEFAULT_FORM_KINDS = ['assessment', 'checkin'];

// Shared include shape for both a single package and the list — a variation's
// default forms + their resolved titles are fetched via one Prisma `include`,
// not a per-variation query (Package Lifecycle Phase 1, §14.6 N+1 prevention).
const VARIATIONS_INCLUDE = {
    package_variations: {
        orderBy: { id: 'asc' as const },
        include: {
            package_default_forms: {
                orderBy: { sort_order: 'asc' as const },
                include: { forms: { select: { id: true, title_en: true, title_ar: true } } },
            },
        },
    },
};

function getPackageWithVariations(id: string, workspaceId: string) {
    return prisma.packages.findFirst({
        where: { id, workspace_id: workspaceId },
        include: VARIATIONS_INCLUDE,
    });
}

type DefaultFormInput = { formId?: string; kind?: string; intervalDays?: number };

/** Validates a variation's defaultForms array; throws with a user-facing message on the first violation. */
function validateDefaultForms(defaultForms: unknown, variationLabel: string): DefaultFormInput[] {
    if (defaultForms === undefined || defaultForms === null) return [];
    if (!Array.isArray(defaultForms)) throw new Error(`defaultForms for ${variationLabel} must be an array`);
    return defaultForms.map((raw, i) => {
        const f = raw as DefaultFormInput;
        if (!f.formId?.trim()) throw new Error(`defaultForms[${i}] for ${variationLabel} is missing formId`);
        if (!f.kind || !DEFAULT_FORM_KINDS.includes(f.kind)) throw new Error(`defaultForms[${i}] for ${variationLabel} has an invalid kind`);
        if (f.kind === 'checkin' && !(Number.isFinite(f.intervalDays) && Number(f.intervalDays) > 0)) {
            throw new Error(`defaultForms[${i}] for ${variationLabel} needs a positive intervalDays (kind=checkin)`);
        }
        return f;
    });
}

function validatePlanUpdateMode(mode: unknown, variationLabel: string): string {
    if (mode === undefined || mode === null) return 'extend';
    if (typeof mode !== 'string' || !PLAN_UPDATE_MODES.includes(mode)) {
        throw new Error(`planUpdateMode for ${variationLabel} must be 'restart' or 'extend'`);
    }
    return mode;
}

function toPositiveIntOrNull(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export async function getPackages(req: Request, res: Response, next: NextFunction) {
    try {
        const pkgs = await prisma.packages.findMany({
            where: { workspace_id: req.user!.workspaceId },
            include: VARIATIONS_INCLUDE,
            orderBy: { name: 'asc' },
        });
        res.json(serializePackages(pkgs));
    } catch (err) { next(err); }
}

export async function createPackage(req: Request, res: Response, next: NextFunction) {
    const { name, variations } = req.body as { name?: string; variations?: Record<string, unknown>[] };
    if (!name?.trim()) return res.status(400).json({ error: 'Package name is required' });
    if (!Array.isArray(variations) || variations.length === 0) return res.status(400).json({ error: 'At least one variation is required' });

    try {
        const pkg = await prisma.$transaction(async (tx) => {
            const created = await tx.packages.create({
                data: { id: createId(), workspace_id: req.user!.workspaceId, name: name.trim() },
            });

            const variationsWithDefaults = variations.map(v => {
                const dur   = Number(v.duration);
                const price = Number(v.price);
                const label = (v.name as string) || 'variation';
                if (!(v.name as string)?.trim()) throw new Error('Variation name is required');
                if (!Number.isFinite(dur)   || dur   <= 0) throw new Error('Duration must be a positive number');
                if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
                if (!(v.currency as string)?.trim())       throw new Error('Currency is required');
                const defaultForms = validateDefaultForms(v.defaultForms, label);
                const planUpdateMode = validatePlanUpdateMode(v.planUpdateMode, label);
                return {
                    id:          createId(),
                    package_id:  created.id,
                    name:        (v.name as string).trim(),
                    description: (v.description as string | undefined)?.trim() || null,
                    duration:    dur,
                    price,
                    currency:    (v.currency as string).trim(),
                    nutrition_cycle_days: toPositiveIntOrNull(v.nutritionCycleDays),
                    training_cycle_days:  toPositiveIntOrNull(v.trainingCycleDays),
                    review_offset_days:   toPositiveIntOrNull(v.reviewOffsetDays),
                    plan_update_mode:     planUpdateMode,
                    defaultForms,
                };
            });

            await tx.package_variations.createMany({
                data: variationsWithDefaults.map(({ defaultForms, ...rest }) => rest),
            });

            const defaultFormRows = variationsWithDefaults.flatMap(v =>
                v.defaultForms.map((f, i) => ({
                    id: createId(),
                    package_variation_id: v.id,
                    form_id: f.formId as string,
                    kind: f.kind as string,
                    interval_days: f.kind === 'checkin' ? Number(f.intervalDays) : null,
                    sort_order: i + 1,
                }))
            );
            if (defaultFormRows.length > 0) {
                await tx.package_default_forms.createMany({ data: defaultFormRows });
            }

            return tx.packages.findUnique({
                where: { id: created.id },
                include: VARIATIONS_INCLUDE,
            });
        });

        res.status(201).json(serializePackage(pkg));
    } catch (err) { next(err); }
}

export async function updatePackage(req: Request, res: Response, next: NextFunction) {
    const { id, name, active, variations } = req.body as {
        id?: string; name?: string; active?: boolean; variations?: Record<string, unknown>[];
    };
    if (!id) return res.status(400).json({ error: 'Package id is required' });

    try {
        const existing = await prisma.packages.findFirst({ where: { id, workspace_id: req.user!.workspaceId } });
        if (!existing) return res.status(404).json({ error: 'Package not found' });

        await prisma.$transaction(async (tx) => {
            if (name !== undefined || active !== undefined) {
                await tx.packages.update({
                    where: { id },
                    data: {
                        name:       name   !== undefined ? name.trim() : existing.name,
                        active:     active !== undefined ? active       : existing.active,
                        updated_at: new Date(),
                    },
                });
            }

            if (Array.isArray(variations)) {
                // Package Lifecycle Phase 0 discovery: this used to blanket
                // delete-and-recreate every variation (fresh id each time),
                // which was harmless before anything referenced a variation's
                // id — but clients/transactions now hold package_variation_id
                // FKs (ON DELETE SET NULL), so minting a new id on every save
                // silently orphaned every client on that variation. Existing
                // variations are now updated in place, preserving their id;
                // only genuinely new variations get a fresh one.
                const existing_variations = await tx.package_variations.findMany({
                    where: { package_id: id },
                    select: { id: true },
                });
                const existingIds = new Set(existing_variations.map(v => v.id));

                type VariationFields = {
                    name: string; description: string | null; duration: number; price: number; currency: string;
                    active: boolean; nutrition_cycle_days: number | null; training_cycle_days: number | null;
                    review_offset_days: number | null; plan_update_mode: string;
                };
                const toCreate: (VariationFields & { id: string; package_id: string })[] = [];
                const toUpdate: { id: string; data: VariationFields }[] = [];
                const defaultFormsByVariationId: Record<string, DefaultFormInput[]> = {};
                const keptIds = new Set<string>();

                for (const v of variations) {
                    const dur   = Number(v.duration);
                    const price = Number(v.price);
                    const label = (v.name as string) || 'variation';
                    if (!(v.name as string)?.trim()) throw new Error('Variation name is required');
                    if (!Number.isFinite(dur)   || dur   <= 0) throw new Error('Duration must be a positive number');
                    if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
                    if (!(v.currency as string)?.trim())       throw new Error('Currency is required');
                    const defaultForms = validateDefaultForms(v.defaultForms, label);
                    const planUpdateMode = validatePlanUpdateMode(v.planUpdateMode, label);

                    const fields: VariationFields = {
                        name:        (v.name as string).trim(),
                        description: (v.description as string | undefined)?.trim() || null,
                        duration:    dur,
                        price,
                        currency:    (v.currency as string).trim(),
                        active:      (v.active as boolean) ?? true,
                        nutrition_cycle_days: toPositiveIntOrNull(v.nutritionCycleDays),
                        training_cycle_days:  toPositiveIntOrNull(v.trainingCycleDays),
                        review_offset_days:   toPositiveIntOrNull(v.reviewOffsetDays),
                        plan_update_mode:     planUpdateMode,
                    };

                    const rawId = typeof v.id === 'string' ? v.id : null;
                    const variationId = rawId && existingIds.has(rawId) ? rawId : createId();
                    if (rawId && existingIds.has(rawId)) {
                        keptIds.add(variationId);
                        toUpdate.push({ id: variationId, data: fields });
                    } else {
                        toCreate.push({ id: variationId, package_id: id, ...fields });
                    }
                    defaultFormsByVariationId[variationId] = defaultForms;
                }

                // Variations that existed before but weren't sent back are the ones the coach removed.
                const idsToDelete = [...existingIds].filter(eid => !keptIds.has(eid));
                if (idsToDelete.length > 0) {
                    await tx.package_variations.deleteMany({ where: { id: { in: idsToDelete } } });
                }

                for (const u of toUpdate) {
                    await tx.package_variations.update({ where: { id: u.id }, data: u.data });
                    await tx.package_default_forms.deleteMany({ where: { package_variation_id: u.id } });
                }
                if (toCreate.length > 0) {
                    await tx.package_variations.createMany({ data: toCreate });
                }

                const defaultFormRows = Object.entries(defaultFormsByVariationId).flatMap(([variationId, forms]) =>
                    forms.map((f, i) => ({
                        id: createId(),
                        package_variation_id: variationId,
                        form_id: f.formId as string,
                        kind: f.kind as string,
                        interval_days: f.kind === 'checkin' ? Number(f.intervalDays) : null,
                        sort_order: i + 1,
                    }))
                );
                if (defaultFormRows.length > 0) {
                    await tx.package_default_forms.createMany({ data: defaultFormRows });
                }
            }
        });

        res.json(serializePackage(await getPackageWithVariations(id, req.user!.workspaceId)));
    } catch (err) { next(err); }
}

export async function deletePackage(req: Request, res: Response, next: NextFunction) {
    const { packageId, variationId } = req.body as { packageId?: string; variationId?: string };
    if (!packageId) return res.status(400).json({ error: 'packageId is required' });

    try {
        const pkg = await prisma.packages.findFirst({ where: { id: packageId, workspace_id: req.user!.workspaceId } });
        if (!pkg) return res.status(404).json({ error: 'Package not found' });

        // No variationId → delete the whole package and all of its variations.
        if (!variationId) {
            await prisma.package_variations.deleteMany({ where: { package_id: packageId } });
            await prisma.packages.delete({ where: { id: packageId } });
            return res.json({ deleted: 'package', id: packageId });
        }

        await prisma.package_variations.deleteMany({ where: { id: variationId, package_id: packageId } });

        const remaining = await prisma.package_variations.count({ where: { package_id: packageId } });
        if (remaining === 0) {
            await prisma.packages.delete({ where: { id: packageId } });
            return res.json({ deleted: 'package', id: packageId });
        }

        res.json(serializePackage(await getPackageWithVariations(packageId, req.user!.workspaceId)));
    } catch (err) { next(err); }
}
