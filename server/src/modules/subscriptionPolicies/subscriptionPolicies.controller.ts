import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import {
    getGlobalPolicies,
    saveGlobalPolicies,
    getPackageOverrides,
    savePackageOverrides,
    logSubscriptionAudit,
} from './subscriptionPolicies.service';

const permissionsSchema = z.object({
    keep_portal_access:         z.boolean(),
    view_training_plans:        z.boolean(),
    view_nutrition_plans:       z.boolean(),
    view_progress_history:      z.boolean(),
    view_assessments:           z.boolean(),
    view_checkins:              z.boolean(),
    allow_messaging:            z.boolean(),
    allow_submit_checkins:      z.boolean(),
    allow_booking_appointments: z.boolean(),
    allow_download_files:       z.boolean(),
    allow_food_swap:            z.boolean(),
});

const expiredSchema = permissionsSchema.extend({
    grace_period_days: z.number().int().min(0).max(3650),
});

const updateGlobalSchema = z.object({
    expired: expiredSchema,
    frozen:  permissionsSchema,
});

// For package overrides: an object sets the override, null clears it, omitted leaves it.
const updatePackageSchema = z.object({
    expired: expiredSchema.nullable().optional(),
    frozen:  permissionsSchema.nullable().optional(),
});

export async function getPolicies(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await getGlobalPolicies(req.user!.workspaceId));
    } catch (err) { next(err); }
}

export async function updatePolicies(req: Request, res: Response, next: NextFunction) {
    const parsed = updateGlobalSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    try {
        await saveGlobalPolicies(req.user!.workspaceId, parsed.data);
        await logSubscriptionAudit({
            workspaceId: req.user!.workspaceId,
            actorType:   'coach',
            actorUserId: req.user!.userId,
            eventType:   'policy.update',
            metadata:    { scope: 'global' },
        });
        res.json(await getGlobalPolicies(req.user!.workspaceId));
    } catch (err) { next(err); }
}

export async function getPackagePolicy(req: Request, res: Response, next: NextFunction) {
    const packageId = req.params.packageId as string;
    try {
        const pkg = await prisma.packages.findFirst({
            where:  { id: packageId, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!pkg) return res.status(404).json({ error: 'Package not found' });

        res.json(await getPackageOverrides(req.user!.workspaceId, packageId));
    } catch (err) { next(err); }
}

export async function updatePackagePolicy(req: Request, res: Response, next: NextFunction) {
    const packageId = req.params.packageId as string;
    const parsed = updatePackageSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    try {
        const pkg = await prisma.packages.findFirst({
            where:  { id: packageId, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!pkg) return res.status(404).json({ error: 'Package not found' });

        await savePackageOverrides(req.user!.workspaceId, packageId, parsed.data);
        await logSubscriptionAudit({
            workspaceId: req.user!.workspaceId,
            actorType:   'coach',
            actorUserId: req.user!.userId,
            eventType:   'policy.update',
            metadata:    { scope: 'package', packageId },
        });
        res.json(await getPackageOverrides(req.user!.workspaceId, packageId));
    } catch (err) { next(err); }
}
