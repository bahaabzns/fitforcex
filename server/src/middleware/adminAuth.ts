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
    // req.hostname is the API's OWN destination host — the frontend always calls
    // one fixed NEXT_PUBLIC_API_URL regardless of which subdomain the page is on,
    // so this was checking a value that can never differ from that fixed API
    // host, making the whole gate permanently unsatisfiable. The Origin header
    // (set by the browser to the page's real origin on every cross-origin
    // request — which is all of them here, since API host != page host) is the
    // only signal that actually reflects "admin.fitforce.app" vs "my.fitforce.app".
    let subdomain = '';
    try {
        const origin = req.get('origin');
        if (origin) subdomain = new URL(origin).hostname.split('.')[0];
    } catch {
        // malformed Origin header — falls through to the rejection below
    }
    if (!['admin', 'management'].includes(subdomain)) {
        res.status(403).json({ error: 'Admin access not permitted from this domain' });
        return;
    }
    next();
}

export default adminAuthMiddleware;
