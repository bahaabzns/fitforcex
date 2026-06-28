import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';

const VALID_TYPES = ['number', 'image'] as const;
type MetricType = typeof VALID_TYPES[number];

const DEFAULT_METRICS: Array<{ name: string; type: MetricType; unit: string | null; icon: string }> = [
    { name: 'Weight',      type: 'number', unit: 'kg', icon: '⚖️' },
    { name: 'Waist',       type: 'number', unit: 'cm', icon: '📏' },
    { name: 'Hip',         type: 'number', unit: 'cm', icon: '📏' },
    { name: 'Chest',       type: 'number', unit: 'cm', icon: '📏' },
    { name: 'Body Fat',    type: 'number', unit: '%',  icon: '📊' },
    { name: 'Left Arm',    type: 'number', unit: 'cm', icon: '💪' },
    { name: 'Right Arm',   type: 'number', unit: 'cm', icon: '💪' },
    { name: 'Front Photo', type: 'image',  unit: null, icon: '📷' },
    { name: 'Side Photo',  type: 'image',  unit: null, icon: '📷' },
    { name: 'Back Photo',  type: 'image',  unit: null, icon: '📷' },
];

export async function seedWorkspaceMetrics(workspaceId: string): Promise<number> {
    await prisma.metrics.createMany({
        data: DEFAULT_METRICS.map(m => ({
            id:           createId(),
            workspace_id: workspaceId,
            name:         m.name,
            type:         m.type,
            unit:         m.unit,
            icon:         m.icon,
        })),
        skipDuplicates: true,
    });
    return DEFAULT_METRICS.length;
}

export async function listMetrics(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;

        const existing = await prisma.metrics.findMany({
            where:   { workspace_id: workspaceId, deleted_at: null },
            orderBy: { name: 'asc' },
        });

        // Auto-seed defaults the first time a workspace accesses metrics.
        if (existing.length === 0) {
            await seedWorkspaceMetrics(workspaceId);
            const seeded = await prisma.metrics.findMany({
                where:   { workspace_id: workspaceId, deleted_at: null },
                orderBy: { name: 'asc' },
            });
            return res.json(seeded);
        }

        res.json(existing);
    } catch (err) {
        next(err);
    }
}

export async function createMetric(req: Request, res: Response, next: NextFunction) {
    const { name, type, unit, icon, description } = req.body as Record<string, unknown>;

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
        return res.status(400).json({ error: 'name is required' });
    }
    if (!type || !VALID_TYPES.includes(type as MetricType)) {
        return res.status(400).json({ error: 'type must be number or image' });
    }

    try {
        const metric = await prisma.metrics.create({
            data: {
                id:           createId(),
                workspace_id: req.user!.workspaceId,
                name:         name.trim(),
                type:         type as string,
                unit:         (unit as string | undefined) || null,
                icon:         (icon as string | undefined) || null,
                description:  (description as string | undefined) || null,
            },
        });
        res.status(201).json(metric);
    } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') {
            return res.status(409).json({ error: 'A metric with this name already exists' });
        }
        next(err);
    }
}

export async function updateMetric(req: Request, res: Response, next: NextFunction) {
    const { name, unit, icon, description } = req.body as Record<string, unknown>;
    const id = req.params.id as string;

    try {
        const existing = await prisma.metrics.findFirst({
            where: { id, workspace_id: req.user!.workspaceId, deleted_at: null },
        });
        if (!existing) return res.status(404).json({ error: 'Metric not found' });

        const updated = await prisma.metrics.update({
            where: { id },
            data: {
                name:        name        !== undefined ? (name as string).trim()        : existing.name,
                unit:        unit        !== undefined ? (unit as string | null)        : existing.unit,
                icon:        icon        !== undefined ? (icon as string | null)        : existing.icon,
                description: description !== undefined ? (description as string | null) : existing.description,
                updated_at:  new Date(),
            },
        });
        res.json(updated);
    } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') {
            return res.status(409).json({ error: 'A metric with this name already exists' });
        }
        next(err);
    }
}

export async function deleteMetric(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;

    try {
        const existing = await prisma.metrics.findFirst({
            where: { id, workspace_id: req.user!.workspaceId, deleted_at: null },
        });
        if (!existing) return res.status(404).json({ error: 'Metric not found' });

        await prisma.metrics.update({
            where: { id },
            data:  { deleted_at: new Date() },
        });
        res.json({ deleted: id });
    } catch (err) {
        next(err);
    }
}
