import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// Exported so anywhere that needs to classify a workspace's status in bulk (e.g. the admin
// workspace list's status column/filter) uses the exact same threshold as the gate, instead
// of a second hardcoded copy that could drift.
export const READONLY_GRACE_DAYS = 3;

/**
 * Founder decision: payments are the only source of truth for whether a workspace's
 * subscription is in good standing — computed live from `expires_at` (set only by a real
 * successful payment, via applyPayment, or an explicit admin override), never from the
 * separately-maintained `workspace_subscriptions.status` string. That field is written by
 * several different code paths and nothing previously enforced it.
 *
 * Single source of truth for the computation — used by both the gate below and
 * `billing.controller.ts:getSubscription` (so the API response the frontend reads never
 * disagrees with what the gate actually enforces). A null `expires_at` means "never expires"
 * (Free plan, or an admin grant) and is always in good standing.
 */
export async function getWorkspaceAccessStatus(workspaceId: string): Promise<{
    inGoodStanding: boolean; isReadOnly: boolean; expiresAt: Date | null; readOnlyAt: Date | null;
}> {
    const sub = await prisma.workspace_subscriptions.findUnique({
        where:  { workspace_id: workspaceId },
        select: { expires_at: true },
    });
    if (!sub || sub.expires_at === null) {
        return { inGoodStanding: true, isReadOnly: false, expiresAt: null, readOnlyAt: null };
    }

    const readOnlyAt = new Date(sub.expires_at.getTime() + READONLY_GRACE_DAYS * 86400000);
    const isReadOnly = readOnlyAt <= new Date();
    return { inGoodStanding: !isReadOnly, isReadOnly, expiresAt: sub.expires_at, readOnlyAt };
}

/**
 * GETs always pass — an expired subscription is read-only, not a full lockout, so a coach can
 * still see their data while they renew; only mutations are blocked, after the grace window
 * past the actual expiry.
 *
 * Mount as `router.use(authMiddleware, subscriptionAccessGate)` on any coach-authenticated
 * router — after auth (needs req.user.workspaceId), before route handlers. Deliberately not
 * applied to the billing router, so an expired workspace can still pay to unblock itself.
 */
export async function subscriptionAccessGate(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.method === 'GET') { next(); return; }

    const workspaceId = req.user?.workspaceId;
    if (!workspaceId) { next(); return; } // no identity yet — downstream auth will reject it

    const { isReadOnly } = await getWorkspaceAccessStatus(workspaceId);
    if (!isReadOnly) { next(); return; }

    res.status(402).json({
        error:   'subscription_expired',
        message: 'Your subscription has expired. Renew to continue making changes.',
    });
}

export default subscriptionAccessGate;
