import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as messengerController from './messenger.controller';

const router = Router();

router.use(authMiddleware);

router.get('/threads',                          messengerController.getThreads);
router.post('/threads',                         messengerController.createThread);
router.get('/threads/:threadId/messages',       messengerController.getMessages);
router.post('/threads/:threadId/messages',      messengerController.sendMessage);
router.patch('/threads/:threadId/status',       messengerController.updateThreadStatus);

export default router;
