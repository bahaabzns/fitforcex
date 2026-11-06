import { Request, Response, NextFunction } from 'express';
import { DEMO_EVENT, recordDemoEventIfDemoClient } from './demoClient.service';

/**
 * Route middleware for plan-builder saves (the body carries `clientId`): once the save succeeds, notes that the
 * coach edited the demo client. Does nothing for real clients, and never delays or fails the request.
 */
export function trackDemoEdit(req: Request, res: Response, next: NextFunction): void {
    res.on('finish', () => {
        const clientId = (req.body as { clientId?: unknown } | undefined)?.clientId;
        if (res.statusCode >= 400 || typeof clientId !== 'string' || !req.user) return;
        void recordDemoEventIfDemoClient(req.user.workspaceId, clientId, DEMO_EVENT.EDITED);
    });
    next();
}
