import { Request, Response, NextFunction } from 'express';
import { createStarterPackage, dismissGettingStarted, getGettingStarted } from './gettingStarted.service';

export async function getStatus(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await getGettingStarted(req.user!.workspaceId, req.user!.isOwner === true));
    } catch (err) {
        next(err);
    }
}

export async function dismiss(req: Request, res: Response, next: NextFunction) {
    try {
        if (req.user!.isOwner !== true) return res.status(403).json({ message: 'Only the workspace owner can hide the checklist' });
        await dismissGettingStarted(req.user!.workspaceId);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

export async function starterPackage(req: Request, res: Response, next: NextFunction) {
    try {
        if (req.user!.isOwner !== true) return res.status(403).json({ message: 'Only the workspace owner can create the starter package' });
        res.json(await createStarterPackage(req.user!.workspaceId));
    } catch (err) {
        next(err);
    }
}
