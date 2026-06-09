import { Request, Response, NextFunction } from 'express';

// Must be used after authMiddleware — relies on req.user.isOwner.
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    if (!req.user.isOwner) {
        res.status(403).json({ message: 'Only the workspace owner can perform this action' });
        return;
    }
    next();
}

export default requireOwner;
