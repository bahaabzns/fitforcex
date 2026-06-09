import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import requireOwner from '../../middleware/requireOwner';
import requirePermission from '../../middleware/requirePermission';
import * as workspacesController from './workspaces.controller';

const router = Router();

router.use(authMiddleware);

function sameWorkspace(req: Request, res: Response, next: NextFunction): void {
    if (req.params.id !== req.user!.workspaceId) {
        res.status(403).json({ message: 'You do not have access to this workspace' });
        return;
    }
    next();
}

// ── Workspace ─────────────────────────────────────────────────────────────────
router.post('/',           workspacesController.createWorkspace);
router.get('/:id',         sameWorkspace, workspacesController.getWorkspace);
router.patch('/:id/name',  sameWorkspace, requireOwner, workspacesController.renameWorkspace);
router.put('/:id/slug',    sameWorkspace, requireOwner, workspacesController.updateSlug);
router.delete('/:id',      sameWorkspace, requireOwner, workspacesController.archiveWorkspace);

// ── Members ───────────────────────────────────────────────────────────────────
router.get('/:id/members',                              sameWorkspace, requirePermission('team', 'read'),  workspacesController.getMembers);
router.post('/:id/members',                             sameWorkspace, requireOwner,                       workspacesController.addMember);
router.put('/:id/members/:memberId',                    sameWorkspace,                                     workspacesController.updateMember);
router.put('/:id/members/:memberId/permissions',        sameWorkspace, requireOwner,                       workspacesController.updateMemberPermissions);
router.delete('/:id/members/:memberId',                 sameWorkspace,                                     workspacesController.removeMember);

// ── Invitations ───────────────────────────────────────────────────────────────
router.get('/:id/invitations',                          sameWorkspace, requirePermission('team', 'read'),  workspacesController.getInvitations);
router.post('/:id/invitations',                         sameWorkspace,                                     workspacesController.sendInvitation);
router.delete('/:id/invitations/:invitationId',         sameWorkspace,                                     workspacesController.cancelInvitation);

// ── Ownership ─────────────────────────────────────────────────────────────────
router.post('/:id/transfer-ownership', sameWorkspace, requireOwner, workspacesController.transferOwnership);

export default router;
