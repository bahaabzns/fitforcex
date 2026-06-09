import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as invitationsController from './invitations.controller';

const router = Router();

router.use(authMiddleware);

router.get('/me', invitationsController.getMyInvitations);
router.post('/:id/accept', invitationsController.acceptInvitation);
router.post('/:id/decline', invitationsController.declineInvitation);

export default router;
