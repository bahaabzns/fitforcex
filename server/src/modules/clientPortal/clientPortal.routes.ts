import { Router } from 'express';
import clientAuthMiddleware from '../../middleware/clientAuth';
import { loginLimiter } from '../../middleware/rateLimit';
import * as clientPortalController from './clientPortal.controller';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/login',  loginLimiter, clientPortalController.login);
router.post('/logout', clientPortalController.logout);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.get('/me',                   clientAuthMiddleware, clientPortalController.getMe);
router.get('/active-plan',          clientAuthMiddleware, clientPortalController.getActivePlan);
router.get('/active-training-plan', clientAuthMiddleware, clientPortalController.getActiveTrainingPlan);

// ── Form Requests ─────────────────────────────────────────────────────────────
router.get('/form-requests',                              clientAuthMiddleware, clientPortalController.getFormRequests);
router.get('/form-requests/:request_id',                  clientAuthMiddleware, clientPortalController.getFormRequest);
router.post('/form-requests/:request_id/submit',          clientAuthMiddleware, clientPortalController.submitFormRequest);

// ── Messaging ─────────────────────────────────────────────────────────────────
router.get('/messages',  clientAuthMiddleware, clientPortalController.getMessages);
router.post('/messages', clientAuthMiddleware, clientPortalController.sendMessage);

export default router;
