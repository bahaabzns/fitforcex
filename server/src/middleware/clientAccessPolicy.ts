import { Request, Response, NextFunction } from 'express';
import { getEffectiveAccessForClient } from '../modules/subscriptionPolicies/subscriptionPolicies.service';
import type { PermissionKey } from '../utils/subscriptionPolicy';

/**
 * Computes the authenticated client's effective access once per request and
 * attaches it to req.clientAccess. Mount on the portal router AFTER
 * clientAuthMiddleware and BEFORE the feature routes. Never blocks here — the
 * gates below decide what to do with the result.
 */
export async function loadClientAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.client) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    try {
        const effective = await getEffectiveAccessForClient(req.client.clientId, req.client.workspaceId);
        req.clientAccess = effective;
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Blocks a feature route when the client has lost portal access entirely
 * (keep_portal_access = false for their status). Apply to feature routes only —
 * never to /me, /logout or /access, so the portal can still render the status card.
 */
export function requirePortalOpen(req: Request, res: Response, next: NextFunction): void {
    const access = req.clientAccess;
    if (!access || access.access.keep_portal_access) {
        next();
        return;
    }
    res.status(403).json({
        error:  'Your portal access is currently restricted.',
        code:   'PORTAL_RESTRICTED',
        status: access.status,
    });
}

/**
 * Per-action guard. Use on a specific route to block when a flag is off, e.g.
 * requireClientAccess('allow_messaging').
 */
export function requireClientAccess(permission: PermissionKey) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const access = req.clientAccess;
        if (access && access.access[permission] !== true) {
            res.status(403).json({
                error:      'This action is not available on your current subscription.',
                code:       'ACCESS_RESTRICTED',
                permission,
                status:     access.status,
            });
            return;
        }
        next();
    };
}

/**
 * Like requireClientAccess but passes when ANY of the listed flags is on.
 * Used for form-requests, which cover both assessments and check-ins.
 */
export function requireAnyClientAccess(permissions: PermissionKey[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const access = req.clientAccess;
        if (access && !permissions.some(p => access.access[p] === true)) {
            res.status(403).json({
                error:       'This section is not available on your current subscription.',
                code:        'ACCESS_RESTRICTED',
                permissions,
                status:      access.status,
            });
            return;
        }
        next();
    };
}
