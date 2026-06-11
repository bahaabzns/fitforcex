import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { hashToken } from '../modules/auth/auth.service';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = req.cookies.token;
    if (!token) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;

        const session = await prisma.user_sessions.findUnique({
            where: { token_hash: hashToken(token) },
        });
        if (!session || session.revoked_at || session.expires_at < new Date()) {
            res.status(401).json({ message: 'Session expired or revoked' });
            return;
        }

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
