import { Request, Response, NextFunction } from 'express';
import { CapabilityKey, hasCapability } from '../lib/planCapabilities';

// Must be used after authMiddleware. Blocks coach write routes when the workspace's plan
// (or subscription standing) doesn't carry the capability. Error shape mirrors
// requireClientAccess: a stable `code` the UI can switch on.
export function requireCapability(key: CapabilityKey) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const workspaceId = req.user?.workspaceId;
        if (!workspaceId) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        try {
            if (await hasCapability(workspaceId, key)) {
                next();
                return;
            }
            res.status(403).json({
                error:      'This feature is not included in your current plan.',
                code:       'CAPABILITY_LOCKED',
                capability: key,
            });
        } catch (err) {
            next(err);
        }
    };
}

export default requireCapability;
