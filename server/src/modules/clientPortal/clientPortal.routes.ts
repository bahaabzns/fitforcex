import { Router } from 'express';
import clientAuthMiddleware from '../../middleware/clientAuth';
import { loginLimiter } from '../../middleware/rateLimit';
import * as clientPortalController from './clientPortal.controller';

const router = Router();

/**
 * @openapi
 * /client-portal/login:
 *   post:
 *     summary: Client portal login
 *     tags: [Client Portal]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [coachSlug, email, password]
 *             properties:
 *               coachSlug: { type: string }
 *               email:     { type: string, format: email }
 *               password:  { type: string }
 *     responses:
 *       200:
 *         description: Authenticated; client cookie set
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, clientPortalController.login);

/**
 * @openapi
 * /client-portal/logout:
 *   post:
 *     summary: Log out of the client portal
 *     tags: [Client Portal]
 *     security: []
 *     responses:
 *       200:
 *         description: Cookie cleared
 */
router.post('/logout', clientPortalController.logout);

/**
 * @openapi
 * /client-portal/me:
 *   get:
 *     summary: Get the authenticated client's profile
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Client profile
 *       401:
 *         description: Not authenticated
 */
router.get('/me', clientAuthMiddleware, clientPortalController.getMe);

/**
 * @openapi
 * /client-portal/active-plan:
 *   get:
 *     summary: Get the client's currently active nutrition plan
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active nutrition plan or null
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NutritionPlan'
 */
router.get('/active-plan', clientAuthMiddleware, clientPortalController.getActivePlan);

/**
 * @openapi
 * /client-portal/active-training-plan:
 *   get:
 *     summary: Get the client's currently active workout plan
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active workout plan or null
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WorkoutPlan'
 */
router.get('/active-training-plan', clientAuthMiddleware, clientPortalController.getActiveTrainingPlan);

/**
 * @openapi
 * /client-portal/form-requests:
 *   get:
 *     summary: List pending form requests for the client
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of form requests
 *
 * /client-portal/form-requests/{request_id}:
 *   get:
 *     summary: Get a single form request with its questions
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: request_id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Form request with questions
 *       404:
 *         description: Form request not found
 *
 * /client-portal/form-requests/{request_id}/submit:
 *   post:
 *     summary: Submit answers for a form request
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: request_id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId: { type: string }
 *                     answer:     { type: string }
 *     responses:
 *       200:
 *         description: Form submitted
 */
router.get('/form-requests',                     clientAuthMiddleware, clientPortalController.getFormRequests);
router.get('/form-requests/:request_id',         clientAuthMiddleware, clientPortalController.getFormRequest);
router.post('/form-requests/:request_id/submit', clientAuthMiddleware, clientPortalController.submitFormRequest);

/**
 * @openapi
 * /client-portal/messages:
 *   get:
 *     summary: Get message thread between client and coach team
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Messages in the client's thread
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *   post:
 *     summary: Send a message to the coach team
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, maxLength: 5000 }
 *     responses:
 *       201:
 *         description: Message sent; real-time event emitted to workspace room
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 */
router.get('/messages',  clientAuthMiddleware, clientPortalController.getMessages);
router.post('/messages', clientAuthMiddleware, clientPortalController.sendMessage);

export default router;
