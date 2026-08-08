import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import requireOwner from '../../middleware/requireOwner';
import { loginLimiter } from '../../middleware/rateLimit';
import * as authController from './auth.controller';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:          { type: string, minLength: 2 }
 *               email:         { type: string, format: email }
 *               password:      { type: string, minLength: 8 }
 *               workspaceName: { type: string, description: "Optional platform or brand name shown at checkout; falls back to a default name if omitted" }
 *     responses:
 *       201:
 *         description: Account created; auth cookie set
 *       400:
 *         description: Validation error or email already registered
 */
router.post('/register', authController.register);

/**
 * @openapi
 * /auth/check-availability:
 *   post:
 *     summary: Check whether an email/phone can be used to register (validation only, no account created)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, phone]
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *     responses:
 *       200:
 *         description: Email and phone are available
 *       400:
 *         description: Validation error (missing/malformed field)
 *       409:
 *         description: Email or phone already registered to another account
 */
router.post('/check-availability', loginLimiter, authController.checkSignupAvailability);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in and receive an auth cookie
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Authenticated; httpOnly cookie set
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, authController.login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile and workspace info
 *       401:
 *         description: Not authenticated
 */
router.get('/me', authMiddleware, authController.getMe);

/**
 * @openapi
 * /auth/clone-status:
 *   get:
 *     summary: Default-libraries clone status for the active workspace (onboarding)
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Clone status (pending|cloning|ready|failed) and library counts
 */
router.get('/clone-status', authMiddleware, authController.getCloneStatus);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out and revoke the current session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out; cookie cleared
 */
router.post('/logout', authController.logout);

/**
 * @openapi
 * /auth/switch-workspace:
 *   post:
 *     summary: Switch the active workspace for the current session
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workspaceId]
 *             properties:
 *               workspaceId: { type: string }
 *     responses:
 *       200:
 *         description: New auth cookie issued for the selected workspace
 *       403:
 *         description: User is not a member of that workspace
 */
router.post('/switch-workspace', authMiddleware, authController.switchWorkspace);

/**
 * @openapi
 * /auth/default-workspace:
 *   put:
 *     summary: Set the user's default workspace
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workspaceId]
 *             properties:
 *               workspaceId: { type: string }
 *     responses:
 *       200:
 *         description: Default workspace updated
 */
router.put('/default-workspace', authMiddleware, authController.setDefaultWorkspace);

/**
 * @openapi
 * /auth/workspace-slug:
 *   put:
 *     summary: Update the workspace URL slug (owner only)
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slug]
 *             properties:
 *               slug: { type: string }
 *     responses:
 *       200:
 *         description: Slug updated
 *       403:
 *         description: Not the workspace owner
 */
router.put('/workspace-slug', authMiddleware, requireOwner, authController.updateWorkspaceSlug);

/**
 * @openapi
 * /auth/send-verification:
 *   post:
 *     summary: Send email verification link
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 */
router.post('/send-verification', authMiddleware, loginLimiter, authController.sendVerification);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     summary: Verify email with the token from the verification email
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired token
 */
router.post('/verify-email', authMiddleware, authController.verifyEmail);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset email sent (always 200 to prevent email enumeration)
 */
router.post('/forgot-password', loginLimiter, authController.forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using the token from the reset email
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:    { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Token invalid or expired
 */
router.post('/reset-password', loginLimiter, authController.resetPassword);

/**
 * @openapi
 * /auth/profile:
 *   patch:
 *     summary: Update the authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:              { type: string }
 *               preferredLanguage: { type: string, enum: [en, ar] }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch('/profile', authMiddleware, authController.updateProfile);

export default router;
