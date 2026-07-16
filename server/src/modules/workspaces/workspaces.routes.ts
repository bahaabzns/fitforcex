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

/**
 * @openapi
 * /workspaces:
 *   post:
 *     summary: Create a new workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Workspace created
 *
 * /workspaces/{id}:
 *   get:
 *     summary: Get workspace details
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Workspace details
 *       403:
 *         description: Not a member of this workspace
 *   delete:
 *     summary: Archive (soft-delete) a workspace (owner only)
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Workspace archived
 *       403:
 *         description: Not the owner
 *
 * /workspaces/{id}/name:
 *   patch:
 *     summary: Rename a workspace (owner only)
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Name updated
 *
 * /workspaces/{id}/slug:
 *   put:
 *     summary: Update the workspace URL slug (owner only)
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Slug updated
 *
 * /workspaces/{id}/renewal-link:
 *   patch:
 *     summary: Set the URL the client portal's "Renew Subscription" button opens (owner only)
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Renewal link updated
 */
router.post('/',           workspacesController.createWorkspace);
router.get('/:id',         sameWorkspace, workspacesController.getWorkspace);
router.patch('/:id/name',          sameWorkspace, requireOwner, workspacesController.renameWorkspace);
router.patch('/:id/renewal-link',  sameWorkspace, requireOwner, workspacesController.updateRenewalLink);
router.put('/:id/slug',            sameWorkspace, requireOwner, workspacesController.updateSlug);
router.delete('/:id',      sameWorkspace, requireOwner, workspacesController.archiveWorkspace);

/**
 * @openapi
 * /workspaces/{id}/members:
 *   get:
 *     summary: List workspace members
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of workspace members
 *   post:
 *     summary: Add a member to the workspace (owner only)
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Member added
 *
 * /workspaces/{id}/members/{memberId}:
 *   put:
 *     summary: Update a member's role
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: memberId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Member updated
 *   delete:
 *     summary: Remove a member from the workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: memberId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Member removed
 *
 * /workspaces/{id}/members/{memberId}/permissions:
 *   put:
 *     summary: Update a member's module permissions (owner only)
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: memberId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Permissions updated
 */
router.get('/:id/members',                           sameWorkspace, requirePermission('team', 'read'), workspacesController.getMembers);
router.post('/:id/members',                          sameWorkspace, requireOwner, workspacesController.addMember);
router.put('/:id/members/:memberId',                 sameWorkspace, workspacesController.updateMember);
router.put('/:id/members/:memberId/permissions',     sameWorkspace, requireOwner, workspacesController.updateMemberPermissions);
router.delete('/:id/members/:memberId',              sameWorkspace, workspacesController.removeMember);

/**
 * @openapi
 * /workspaces/{id}/invitations:
 *   get:
 *     summary: List pending invitations for the workspace
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of invitations
 *   post:
 *     summary: Send an invitation to a new team member
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Invitation sent
 *
 * /workspaces/{id}/invitations/{invitationId}:
 *   delete:
 *     summary: Cancel a pending invitation
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: invitationId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Invitation cancelled
 *
 * /workspaces/{id}/transfer-ownership:
 *   post:
 *     summary: Transfer workspace ownership to another member (owner only)
 *     tags: [Workspaces]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Ownership transferred
 */
router.get('/:id/invitations',                       sameWorkspace, requirePermission('team', 'read'), workspacesController.getInvitations);
router.post('/:id/invitations',                      sameWorkspace, workspacesController.sendInvitation);
router.delete('/:id/invitations/:invitationId',      sameWorkspace, workspacesController.cancelInvitation);

router.post('/:id/transfer-ownership', sameWorkspace, requireOwner, workspacesController.transferOwnership);

export default router;
