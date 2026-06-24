import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT     = 100;

/**
 * Notifications addressed to the current team user, scoped to their workspace.
 * recipient_type is always 'user' here — the client portal reads its own
 * ('client') notifications through the client-portal surface.
 */
function recipientScope(req: Request) {
    return {
        workspace_id:   req.user!.workspaceId,
        recipient_type: 'user',
        recipient_id:   req.user!.userId,
    } as const;
}

export async function listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const unreadOnly = req.query.unread === 'true';
        const rawLimit   = Number.parseInt(String(req.query.limit ?? ''), 10);
        const limit      = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

        const notifications = await prisma.notifications.findMany({
            where:   { ...recipientScope(req), ...(unreadOnly ? { read_at: null } : {}) },
            orderBy: { created_at: 'desc' },
            take:    limit,
        });

        res.json(notifications);
    } catch (err) {
        next(err);
    }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const count = await prisma.notifications.count({
            where: { ...recipientScope(req), read_at: null },
        });
        res.json({ count });
    } catch (err) {
        next(err);
    }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // updateMany (not update) so the recipient scope is part of the WHERE —
        // a user can never mark another user's or workspace's notification read.
        const { count } = await prisma.notifications.updateMany({
            where: { id: req.params.id as string, ...recipientScope(req), read_at: null },
            data:  { read_at: new Date() },
        });
        if (count === 0) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        res.json({ updated: count });
    } catch (err) {
        next(err);
    }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { count } = await prisma.notifications.updateMany({
            where: { ...recipientScope(req), read_at: null },
            data:  { read_at: new Date() },
        });
        res.json({ updated: count });
    } catch (err) {
        next(err);
    }
}
