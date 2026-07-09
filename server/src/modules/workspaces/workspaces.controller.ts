import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { DEFAULT_PERMISSIONS, VALID_ROLES } from '../../lib/defaultPermissions';
import { checkSeatLimit, checkWorkspaceLimit } from '../../lib/seatLimits';
import { prisma } from '../../lib/prisma';
import { normalizeEmail } from '../../utils/email';

// Must stay in sync with client/middleware.js RESERVED set
const RESERVED_SLUGS = new Set([
    'my', 'admin', 'www', 'api', 'mail', 'smtp',
    'app', 'portal', 'management', 'static', 'assets', 'cdn',
]);

export function normalizeSlug(raw: string): string {
    return raw
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export async function createWorkspace(req: Request, res: Response, next: NextFunction) {
    const { name, slug } = req.body as { name?: string; slug?: string };
    if (!name?.trim()) return res.status(400).json({ message: 'Workspace name is required' });

    try {
        await checkWorkspaceLimit(req.user!.userId, req.user!.workspaceId);

        const rawSlug      = slug?.trim() || name;
        let normalizedSlug = normalizeSlug(rawSlug) || `workspace-${Date.now()}`;

        if (RESERVED_SLUGS.has(normalizedSlug)) {
            return res.status(400).json({ message: `"${normalizedSlug}" is a reserved slug and cannot be used` });
        }

        const conflict = await prisma.workspaces.findFirst({
            where: { slug: normalizedSlug },
            select: { id: true },
        });
        if (conflict) normalizedSlug = `${normalizedSlug}-${Date.now()}`;

        const newWorkspaceId = createId();
        const workspace      = await prisma.workspaces.create({
            data: {
                id: newWorkspaceId, slug: normalizedSlug, name: name.trim(),
                owner_id: req.user!.userId, slug_customized: !!slug?.trim(),
            },
            select: { id: true, slug: true, name: true, owner_id: true, created_at: true },
        });

        const freePlan = await prisma.plans.findFirst({
            where: { name: 'free' },
            select: { id: true },
        });
        if (freePlan) {
            await prisma.workspace_subscriptions.create({
                data: { id: createId(), workspace_id: workspace.id, plan_id: freePlan.id },
            });
        }

        res.status(201).json(workspace);
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ message: httpErr.message });
        next(err);
    }
}

type WsDetailRow = Record<string, unknown>;

export async function getWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<WsDetailRow[]>`
            SELECT w.id, w.slug, w.name, w.owner_id, w.slug_customized, w.created_at,
                   p.name AS plan_name, p.display_name AS plan_display_name,
                   p.max_team_seats, p.max_workspaces,
                   u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
                   (SELECT COUNT(*)::int FROM workspace_members wm WHERE wm.workspace_id = w.id AND wm.is_active = TRUE) AS member_count,
                   (SELECT COUNT(*)::int FROM clients c WHERE c.workspace_id = w.id) AS client_count
            FROM workspaces w
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            JOIN users u ON u.id = w.owner_id
            WHERE w.id = ${req.user!.workspaceId} AND w.archived_at IS NULL
        `;
        if (!rows.length) return res.status(404).json({ message: 'Workspace not found' });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
}

export async function renameWorkspace(req: Request, res: Response, next: NextFunction) {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

    try {
        const updated = await prisma.workspaces.update({
            where:  { id: req.user!.workspaceId },
            data:   { name: name.trim() },
            select: { id: true, name: true },
        });

        await prisma.workspace_audit_log.create({
            data: {
                id: createId(), workspace_id: req.user!.workspaceId,
                actor_user_id: req.user!.userId, action: 'workspace_renamed',
                target_type: 'workspace', target_id: req.user!.workspaceId,
            },
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
}

export async function updateSlug(req: Request, res: Response, next: NextFunction) {
    const { slug } = req.body as { slug?: string };
    if (!slug?.trim()) return res.status(400).json({ message: 'Slug is required' });

    try {
        const ws = await prisma.workspaces.findFirst({
            where:  { id: req.user!.workspaceId },
            select: { slug_customized: true },
        });
        if (!ws) return res.status(404).json({ message: 'Workspace not found' });
        if (ws.slug_customized) {
            return res.status(403).json({ message: 'Slug customization is only allowed once' });
        }

        const normalized = normalizeSlug(slug.trim());
        if (!normalized) return res.status(400).json({ message: 'Slug must contain alphanumeric characters' });
        if (RESERVED_SLUGS.has(normalized)) {
            return res.status(400).json({ message: `"${normalized}" is a reserved slug and cannot be used` });
        }

        const conflict = await prisma.workspaces.findFirst({
            where: { slug: normalized, id: { not: req.user!.workspaceId } },
            select: { id: true },
        });
        if (conflict) return res.status(409).json({ message: 'Slug is already taken' });

        const updated = await prisma.workspaces.update({
            where:  { id: req.user!.workspaceId },
            data:   { slug: normalized, slug_customized: true },
            select: { id: true, slug: true, slug_customized: true },
        });
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

export async function archiveWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
        const updated = await prisma.workspaces.updateMany({
            where: { id: req.user!.workspaceId, owner_id: req.user!.userId, archived_at: null },
            data:  { archived_at: new Date() },
        });
        if (updated.count === 0) return res.status(404).json({ message: 'Workspace not found or already archived' });

        await prisma.workspace_audit_log.create({
            data: {
                id: createId(), workspace_id: req.user!.workspaceId,
                actor_user_id: req.user!.userId, action: 'workspace_archived',
                target_type: 'workspace', target_id: req.user!.workspaceId,
            },
        });

        res.json({ message: 'Workspace archived' });
    } catch (err) {
        next(err);
    }
}

type MemberRow = Record<string, unknown>;

export async function getMembers(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<MemberRow[]>`
            SELECT wm.id, wm.user_id, wm.role, wm.permissions, wm.is_active, wm.joined_at,
                   u.fname, u.lname, u.email
            FROM workspace_members wm
            JOIN users u ON u.id = wm.user_id
            WHERE wm.workspace_id = ${req.user!.workspaceId}
            ORDER BY wm.joined_at
        `;
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

export async function addMember(req: Request, res: Response, next: NextFunction) {
    const { email, role } = req.body as { email?: string; role?: string };
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!VALID_ROLES.includes(role!)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    try {
        await checkSeatLimit(req.user!.workspaceId);

        const targetUser = await prisma.users.findFirst({
            where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
            select: { id: true },
        });
        if (!targetUser) return res.status(400).json({ message: 'This email is not registered on FitForce' });

        if (targetUser.id === req.user!.userId) return res.status(400).json({ message: 'You cannot add yourself' });

        const workspace = await prisma.workspaces.findFirst({
            where:  { id: req.user!.workspaceId },
            select: { owner_id: true },
        });
        if (workspace?.owner_id === targetUser.id) {
            return res.status(400).json({ message: 'This person is already the workspace owner' });
        }

        const existing = await prisma.workspace_members.findFirst({
            where:  { workspace_id: req.user!.workspaceId, user_id: targetUser.id },
            select: { id: true },
        });
        if (existing) return res.status(409).json({ message: 'This person is already in your workspace' });

        try {
            const member = await prisma.workspace_members.create({
                data: {
                    id: createId(), workspace_id: req.user!.workspaceId, user_id: targetUser.id,
                    role: role!, permissions: DEFAULT_PERMISSIONS[role!] as unknown as Prisma.InputJsonValue,
                },
            });

            await prisma.workspace_audit_log.create({
                data: {
                    id: createId(), workspace_id: req.user!.workspaceId,
                    actor_user_id: req.user!.userId, action: 'member_added',
                    target_type: 'workspace_member', target_id: member.id,
                },
            });

            res.status(201).json(member);
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                return res.status(409).json({ message: 'This person is already in your workspace' });
            }
            throw err;
        }
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ message: httpErr.message });
        next(err);
    }
}

export async function updateMember(req: Request, res: Response, next: NextFunction) {
    const { role } = req.body as { role?: string };
    if (!VALID_ROLES.includes(role!)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const memberId = req.params.memberId as string;

    try {
        const member = await prisma.workspace_members.findFirst({
            where:  { id: memberId, workspace_id: req.user!.workspaceId },
            select: { id: true, user_id: true, role: true },
        });
        if (!member) return res.status(404).json({ message: 'Member not found' });

        if (member.user_id === req.user!.userId) {
            return res.status(403).json({ message: 'You cannot modify your own role' });
        }

        if (!req.user!.isOwner) {
            if (!req.user!.permissions?.team?.write) {
                return res.status(403).json({ message: 'Insufficient permissions' });
            }
            if (member.role === 'manager' || role === 'manager') {
                return res.status(403).json({ message: 'Managers cannot assign or modify the manager role' });
            }
        }

        const updated = await prisma.workspace_members.update({
            where: { id: memberId },
            data:  { role: role!, permissions: DEFAULT_PERMISSIONS[role!] as unknown as Prisma.InputJsonValue },
            select: { id: true, role: true, permissions: true },
        });

        await prisma.workspace_audit_log.create({
            data: {
                id: createId(), workspace_id: req.user!.workspaceId,
                actor_user_id: req.user!.userId, action: 'role_changed',
                target_type: 'workspace_member', target_id: memberId,
                metadata: { old_role: member.role, new_role: role } as unknown as Prisma.InputJsonValue,
            },
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
}

export async function updateMemberPermissions(req: Request, res: Response, next: NextFunction) {
    const { permissions } = req.body as { permissions?: unknown };
    if (!permissions || typeof permissions !== 'object') {
        return res.status(400).json({ message: 'Permissions object is required' });
    }

    const memberId = req.params.memberId as string;

    try {
        const memberCheck = await prisma.workspace_members.findFirst({
            where:  { id: memberId, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!memberCheck) return res.status(404).json({ message: 'Member not found' });

        const updated = await prisma.workspace_members.update({
            where:  { id: memberId },
            data:   { permissions: permissions as Prisma.InputJsonValue },
            select: { id: true, role: true, permissions: true },
        });

        await prisma.workspace_audit_log.create({
            data: {
                id: createId(), workspace_id: req.user!.workspaceId,
                actor_user_id: req.user!.userId, action: 'permissions_updated',
                target_type: 'workspace_member', target_id: memberId,
            },
        });

        res.json(updated);
    } catch (err) {
        next(err);
    }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
    const memberId = req.params.memberId as string;

    try {
        const member = await prisma.workspace_members.findFirst({
            where:  { id: memberId, workspace_id: req.user!.workspaceId },
            select: { id: true, user_id: true, role: true },
        });
        if (!member) return res.status(404).json({ message: 'Member not found' });

        if (member.user_id === req.user!.userId) {
            return res.status(400).json({ message: 'You cannot remove yourself' });
        }

        if (!req.user!.isOwner) {
            if (!req.user!.permissions?.team?.delete) {
                return res.status(403).json({ message: 'Insufficient permissions' });
            }
            if (member.role === 'manager') {
                return res.status(403).json({ message: 'Managers cannot remove other managers' });
            }
        }

        await prisma.workspace_members.delete({ where: { id: memberId } });

        await prisma.workspace_audit_log.create({
            data: {
                id: createId(), workspace_id: req.user!.workspaceId,
                actor_user_id: req.user!.userId, action: 'member_removed',
                target_type: 'workspace_member', target_id: memberId,
            },
        });

        res.json({ message: 'Member removed' });
    } catch (err) {
        next(err);
    }
}

type InviteRow = Record<string, unknown>;

export async function getInvitations(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<InviteRow[]>`
            SELECT wi.id, wi.invited_user_id, wi.role, wi.message, wi.status, wi.created_at,
                   u.fname, u.lname, u.email,
                   inv.fname AS invited_by_fname, inv.lname AS invited_by_lname
            FROM workspace_invitations wi
            JOIN users u   ON u.id  = wi.invited_user_id
            JOIN users inv ON inv.id = wi.invited_by_user_id
            WHERE wi.workspace_id = ${req.user!.workspaceId}
            ORDER BY wi.created_at DESC
        `;
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

export async function sendInvitation(req: Request, res: Response, next: NextFunction) {
    const { email, role, message } = req.body as { email?: string; role?: string; message?: string };
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!VALID_ROLES.includes(role!)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    if (!req.user!.isOwner && !req.user!.permissions?.team?.write) {
        return res.status(403).json({ message: 'Insufficient permissions' });
    }

    try {
        await checkSeatLimit(req.user!.workspaceId);

        const targetUser = await prisma.users.findFirst({
            where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
            select: { id: true },
        });
        if (!targetUser) return res.status(400).json({ message: 'This email is not registered on FitForce' });

        if (targetUser.id === req.user!.userId) return res.status(400).json({ message: 'You cannot invite yourself' });

        const workspace = await prisma.workspaces.findFirst({
            where:  { id: req.user!.workspaceId },
            select: { owner_id: true },
        });
        if (workspace?.owner_id === targetUser.id) {
            return res.status(400).json({ message: 'This person is already the workspace owner' });
        }

        const existingMember = await prisma.workspace_members.findFirst({
            where: { workspace_id: req.user!.workspaceId, user_id: targetUser.id, is_active: true },
            select: { id: true },
        });
        if (existingMember) return res.status(409).json({ message: 'This person is already in your workspace' });

        const existingInvite = await prisma.workspace_invitations.findFirst({
            where:  { workspace_id: req.user!.workspaceId, invited_user_id: targetUser.id, status: 'pending' },
            select: { id: true },
        });
        if (existingInvite) return res.status(409).json({ message: 'A pending invitation already exists for this user' });

        try {
            const invitation = await prisma.workspace_invitations.create({
                data: {
                    id: createId(), workspace_id: req.user!.workspaceId,
                    invited_by_user_id: req.user!.userId, invited_user_id: targetUser.id,
                    role: role!, message: message || null,
                },
                select: { id: true, workspace_id: true, invited_user_id: true, role: true, message: true, status: true, created_at: true },
            });

            await prisma.workspace_audit_log.create({
                data: {
                    id: createId(), workspace_id: req.user!.workspaceId,
                    actor_user_id: req.user!.userId, action: 'invite_sent',
                    target_type: 'invitation', target_id: invitation.id,
                },
            });

            res.status(201).json(invitation);
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                return res.status(409).json({ message: 'A pending invitation already exists for this user' });
            }
            throw err;
        }
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ message: httpErr.message });
        next(err);
    }
}

export async function cancelInvitation(req: Request, res: Response, next: NextFunction) {
    if (!req.user!.isOwner && !req.user!.permissions?.team?.write) {
        return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const invitationId = req.params.invitationId as string;

    try {
        const invitation = await prisma.workspace_invitations.findFirst({
            where:  { id: invitationId, workspace_id: req.user!.workspaceId },
            select: { id: true, status: true },
        });
        if (!invitation) return res.status(404).json({ message: 'Invitation not found' });
        if (invitation.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot cancel an invitation that has already been responded to' });
        }

        await prisma.workspace_invitations.delete({ where: { id: invitationId } });

        await prisma.workspace_audit_log.create({
            data: {
                id: createId(), workspace_id: req.user!.workspaceId,
                actor_user_id: req.user!.userId, action: 'invite_cancelled',
                target_type: 'invitation', target_id: invitationId,
            },
        });

        res.json({ message: 'Invitation cancelled' });
    } catch (err) {
        next(err);
    }
}

export async function transferOwnership(req: Request, res: Response, next: NextFunction) {
    const { memberId, ownerPassword } = req.body as { memberId?: string; ownerPassword?: string };
    if (!memberId)      return res.status(400).json({ message: 'Member ID is required' });
    if (!ownerPassword) return res.status(400).json({ message: 'Owner password is required' });

    try {
        const owner = await prisma.users.findFirst({
            where:  { id: req.user!.userId },
            select: { password: true },
        });
        if (!owner) return res.status(404).json({ message: 'Owner not found' });
        const valid = await bcrypt.compare(ownerPassword, owner.password!);
        if (!valid) return res.status(401).json({ message: 'Incorrect password' });

        const member = await prisma.workspace_members.findFirst({
            where:  { id: memberId, workspace_id: req.user!.workspaceId, is_active: true },
            select: { id: true, user_id: true },
        });
        if (!member) return res.status(400).json({ message: 'Member not found or is inactive' });
        const targetUserId = member.user_id;

        await prisma.$transaction(async (tx) => {
            await tx.workspaces.update({
                where: { id: req.user!.workspaceId },
                data:  { owner_id: targetUserId },
            });

            await tx.workspace_members.deleteMany({
                where: { user_id: targetUserId, workspace_id: req.user!.workspaceId },
            });

            await tx.workspace_members.create({
                data: {
                    id: createId(), workspace_id: req.user!.workspaceId, user_id: req.user!.userId,
                    role: 'manager', permissions: DEFAULT_PERMISSIONS.manager as unknown as Prisma.InputJsonValue,
                },
            });

            await tx.workspace_audit_log.create({
                data: {
                    id: createId(), workspace_id: req.user!.workspaceId,
                    actor_user_id: req.user!.userId, action: 'ownership_transferred',
                    target_type: 'workspace', target_id: req.user!.workspaceId,
                    metadata: { old_owner: req.user!.userId, new_owner: targetUserId } as unknown as Prisma.InputJsonValue,
                },
            });
        });

        res.json({ message: 'Ownership transferred successfully' });
    } catch (err) {
        next(err);
    }
}
