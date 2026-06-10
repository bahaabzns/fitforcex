import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies.admin_token;
    if (!token) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    try {
        const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET) as jwt.JwtPayload;
        if (!decoded.isAdmin) {
            throw new Error('Not an admin token');
        }
        req.admin = decoded as { isAdmin: boolean; [key: string]: unknown };
        next();
    } catch {
        res.status(401).json({ message: 'Invalid admin token' });
    }
}

export function requireAdminSubdomain(req: Request, res: Response, next: NextFunction): void {
    if (env.NODE_ENV !== 'production') {
        return next();
    }
    const subdomain = req.hostname?.split('.')[0] ?? '';
    if (!['admin', 'management'].includes(subdomain)) {
        res.status(403).json({ error: 'Admin access not permitted from this domain' });
        return;
    }
    next();
}

export default adminAuthMiddleware;
