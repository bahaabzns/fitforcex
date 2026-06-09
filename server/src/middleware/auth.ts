import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies.token;
    if (!token) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
        req.user = {
            userId:      decoded.userId,
            workspaceId: decoded.workspaceId,
            role:        decoded.role,
            permissions: decoded.permissions ?? null,
            isOwner:     decoded.role === 'owner',
        };
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}

export default authMiddleware;
