import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { DEFAULT_PERMISSIONS } from '../../lib/defaultPermissions';
import { checkSeatLimit } from '../../lib/seatLimits';
import { prisma } from '../../lib/prisma';

export async function getMyInvitations(req: Request, res: Response, next: NextFunction) {
    try {
        const invitations = await prisma.workspace_invitations.findMany({
            where: { invited_user_id: req.user!.userId, status: 'pending' },
            select: {
                id: true, role: true, message: true, created_at: true,
                workspaces: { select: { id: true, slug: true, name: true } },
                users_workspace_invitations_invited_by_user_idTousers: {
                    select: { fname: true, lname: true },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        res.json(invitations.map(inv => ({
            id:        inv.id,
            role:      inv.role,
            message:   inv.message,
            createdAt: inv.created_at,
            workspace: inv.workspaces,
            invitedBy: inv.users_workspace_invitations_invited_by_user_idTousers,
        })));
    } catch (err) { next(err); }
}

export async function acceptInvitation(req: Request, res: Response, next: NextFunction) {
    const invitationId = req.params.id as string;

    try {
        const invitation = await prisma.workspace_invitations.findFirst({
            where: { id: invitationId, invited_user_id: req.user!.userId, status: 'pending' },
        });
        if (!invitation) return res.status(404).json({ message: 'Invitation not found or already responded' });

        await checkSeatLimit(invitation.workspace_id);

        let member: Awaited<ReturnType<typeof prisma.workspace_members.create>>;

        await prisma.$transaction(async (tx) => {
            member = await tx.workspace_members.create({
                data: {
                    id:           createId(),
                    workspace_id: invitation.workspace_id,
                    user_id:      req.user!.userId,
                    role:         invitation.role,
                    permissions:  DEFAULT_PERMISSIONS[invitation.role] ?? {},
                },
            });

            await tx.workspace_invitations.update({
                where: { id: invitationId },
                data:  { status: 'accepted', responded_at: new Date() },
            });

            await tx.workspace_audit_log.create({
                data: {
                    id:            createId(),
                    workspace_id:  invitation.workspace_id,
                    actor_user_id: req.user!.userId,
                    action:        'member_added',
                    target_type:   'workspace_member',
                    target_id:     member!.id,
                },
            });
        });

        const workspace = await prisma.workspaces.findUnique({
            where: { id: invitation.workspace_id },
            select: { id: true, slug: true, name: true },
        });

        res.json({ member: member!, workspace });
    } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if (e.status) return res.status(e.status).json({ message: e.message });
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return res.status(409).json({ message: 'You are already a member of this workspace' });
        }
        next(err);
    }
}

export async function declineInvitation(req: Request, res: Response, next: NextFunction) {
    const invitationId = req.params.id as string;

    try {
        const updated = await prisma.workspace_invitations.updateMany({
            where: { id: invitationId, invited_user_id: req.user!.userId, status: 'pending' },
            data:  { status: 'declined', responded_at: new Date() },
        });
        if (updated.count === 0) return res.status(404).json({ message: 'Invitation not found or already responded' });
        res.json({ message: 'Invitation declined' });
    } catch (err) { next(err); }
}
