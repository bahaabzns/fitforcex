import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as invitationsController from './invitations.controller';

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /invitations/me:
 *   get:
 *     summary: List pending workspace invitations for the current user
 *     tags: [Invitations]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of pending invitations
 *
 * /invitations/{id}/accept:
 *   post:
 *     summary: Accept a workspace invitation
 *     tags: [Invitations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Invitation accepted; user added to workspace
 *       404:
 *         description: Invitation not found or already used
 *
 * /invitations/{id}/decline:
 *   post:
 *     summary: Decline a workspace invitation
 *     tags: [Invitations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Invitation declined
 */
router.get('/me',             invitationsController.getMyInvitations);
router.post('/:id/accept',    invitationsController.acceptInvitation);
router.post('/:id/decline',   invitationsController.declineInvitation);

export default router;
