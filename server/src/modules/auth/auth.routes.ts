import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import requireOwner from '../../middleware/requireOwner';
import { loginLimiter } from '../../middleware/rateLimit';
import * as authController from './auth.controller';

const router = Router();

router.post('/register',          authController.register);
router.post('/login',             loginLimiter, authController.login);
router.get('/me',                 authController.getMe);
router.post('/logout',            authController.logout);

router.post('/switch-workspace',  authMiddleware, authController.switchWorkspace);
router.put('/default-workspace',  authMiddleware, authController.setDefaultWorkspace);
router.put('/workspace-slug',     authMiddleware, requireOwner, authController.updateWorkspaceSlug);

router.post('/send-verification', authMiddleware, loginLimiter, authController.sendVerification);
router.post('/verify-email',      authMiddleware, authController.verifyEmail);

router.post('/forgot-password',   loginLimiter, authController.forgotPassword);
router.post('/reset-password',    loginLimiter, authController.resetPassword);

router.patch('/profile',          authMiddleware, authController.updateProfile);

export default router;
