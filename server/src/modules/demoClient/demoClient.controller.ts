import { Request, Response, NextFunction } from 'express';
import { deleteDemoClient, ensureDemoClient, getDemoStatus, markWelcomeSeen } from './demoClient.service';

/**
 * Called when the coach opens the dashboard: creates the demo client if this workspace is eligible
 * (first time only), then reports whether to show it and the welcome screen.
 */
export async function getStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        await ensureDemoClient(workspaceId);
        res.json(await getDemoStatus(workspaceId));
    } catch (err) {
        next(err);
    }
}

export async function acknowledgeWelcome(req: Request, res: Response, next: NextFunction) {
    try {
        await markWelcomeSeen(req.user!.workspaceId);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

export async function removeDemoClient(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await deleteDemoClient(req.user!.workspaceId);
        if (!deleted) return res.status(404).json({ error: 'No demo client to delete' });
        res.json({ deleted: true });
    } catch (err) {
        next(err);
    }
}
