import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function clientAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies.client_token;
    if (!token) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
        req.client = {
            clientId:    decoded.clientId,
            workspaceId: decoded.workspaceId,
        };
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}

export default clientAuthMiddleware;
