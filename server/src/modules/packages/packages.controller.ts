import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { serializePackage, serializePackages } from './packages.serializer';

function getPackageWithVariations(id: string, workspaceId: string) {
    return prisma.packages.findFirst({
        where: { id, workspace_id: workspaceId },
        include: { package_variations: { orderBy: { id: 'asc' } } },
    });
}

export async function getPackages(req: Request, res: Response, next: NextFunction) {
    try {
        const pkgs = await prisma.packages.findMany({
            where: { workspace_id: req.user!.workspaceId },
            include: { package_variations: { orderBy: { id: 'asc' } } },
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

            const varData = variations.map(v => {
                const dur   = Number(v.duration);
                const price = Number(v.price);
                if (!(v.name as string)?.trim()) throw new Error('Variation name is required');
                if (!Number.isFinite(dur)   || dur   <= 0) throw new Error('Duration must be a positive number');
                if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
                if (!(v.currency as string)?.trim())       throw new Error('Currency is required');
                return {
                    id:          createId(),
                    package_id:  created.id,
                    name:        (v.name as string).trim(),
                    description: (v.description as string | undefined)?.trim() || null,
                    duration:    dur,
                    price,
                    currency:    (v.currency as string).trim(),
                };
            });

            await tx.package_variations.createMany({ data: varData });

            return tx.packages.findUnique({
                where: { id: created.id },
                include: { package_variations: { orderBy: { id: 'asc' } } },
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
                await tx.package_variations.deleteMany({ where: { package_id: id } });
                const varData = variations.map(v => {
                    const dur   = Number(v.duration);
                    const price = Number(v.price);
                    if (!(v.name as string)?.trim()) throw new Error('Variation name is required');
                    if (!Number.isFinite(dur)   || dur   <= 0) throw new Error('Duration must be a positive number');
                    if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
                    if (!(v.currency as string)?.trim())       throw new Error('Currency is required');
                    return {
                        id:          createId(),
                        package_id:  id,
                        name:        (v.name as string).trim(),
                        description: (v.description as string | undefined)?.trim() || null,
                        duration:    dur,
                        price,
                        currency:    (v.currency as string).trim(),
                        active:      (v.active as boolean) ?? true,
                    };
                });
                await tx.package_variations.createMany({ data: varData });
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
