import { Request, Response, NextFunction } from 'express';

// Must be used after authMiddleware — relies on req.user.isOwner and req.user.permissions.
export function requirePermission(module: string, action = 'read') {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;
        if (!user) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        if (user.isOwner) {
            next();
            return;
        }
        const allowed = user.permissions?.[module]?.[action] === true;
        if (!allowed) {
            res.status(403).json({ message: 'Permission denied' });
            return;
        }
        next();
    };
}

export default requirePermission;
