import { Router } from 'express';
import clientAuthMiddleware from '../../middleware/clientAuth';
import {
    loadClientAccess,
    requirePortalOpen,
    requireClientAccess,
    requireAnyClientAccess,
} from '../../middleware/clientAccessPolicy';
import { loginLimiter } from '../../middleware/rateLimit';
import * as clientPortalController from './clientPortal.controller';

const router = Router();

// Authenticated + access-loaded chain (no portal-open gate — used by /me and /access).
const authed = [clientAuthMiddleware, loadClientAccess];
// Feature chain: also blocks entirely when keep_portal_access is off.
const open   = [clientAuthMiddleware, loadClientAccess, requirePortalOpen];

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
 * /client-portal/workspace:
 *   get:
 *     summary: Public workspace lookup for the mobile branded-login screen
 *     tags: [Client Portal]
 *     security: []
 *     parameters:
 *       - { in: query, name: slug, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Workspace branding identity
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug:       { type: string }
 *                 name:       { type: string }
 *                 logoUrl:    { type: string, nullable: true }
 *                 brandColor: { type: string, nullable: true }
 *       404:
 *         description: Workspace not found
 */
router.get('/workspace', clientPortalController.getWorkspace);

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
router.get('/me', ...authed, clientPortalController.getMe);

/**
 * @openapi
 * /client-portal/access:
 *   get:
 *     summary: Get the client's effective subscription access (status + flags)
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: "{ status, withinGrace, access: { ...10 flags } }"
 */
router.get('/access', ...authed, clientPortalController.getAccess);

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
router.get('/active-plan', ...open, requireClientAccess('view_nutrition_plans'), clientPortalController.getActivePlan);

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
router.get('/active-training-plan', ...open, requireClientAccess('view_training_plans'), clientPortalController.getActiveTrainingPlan);

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
router.get('/form-requests',                     ...open, requireAnyClientAccess(['view_assessments', 'view_checkins']), clientPortalController.getFormRequests);
router.get('/form-requests/:request_id',         ...open, requireAnyClientAccess(['view_assessments', 'view_checkins']), clientPortalController.getFormRequest);
router.post('/form-requests/:request_id/submit', ...open, requireClientAccess('allow_submit_checkins'), clientPortalController.submitFormRequest);

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
router.get('/messages',  ...open, requireClientAccess('allow_messaging'), clientPortalController.getMessages);
router.post('/messages', ...open, requireClientAccess('allow_messaging'), clientPortalController.sendMessage);

/**
 * @openapi
 * /client-portal/workout-logs:
 *   get:
 *     summary: List the client's logged workout sessions (newest first)
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of session summaries
 *   post:
 *     summary: Save a finished Training Mode session
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [started_at, ended_at, exercises]
 *             properties:
 *               plan_id:    { type: string, nullable: true }
 *               day_id:     { type: string, nullable: true }
 *               day_index:  { type: integer, nullable: true }
 *               notes:      { type: string, nullable: true }
 *               started_at: { type: string, format: date-time }
 *               ended_at:   { type: string, format: date-time }
 *               exercises:  { type: array, items: { type: object } }
 *     responses:
 *       201:
 *         description: Session saved; returns id + summary
 *       400:
 *         description: Validation failed
 *
 * /client-portal/workout-logs/previous:
 *   get:
 *     summary: Previous logged sets per exercise for a training day
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: day_id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Map of exercise_id to previously logged sets
 *
 * /client-portal/workout-logs/exercise-progress:
 *   get:
 *     summary: Progress time series for one exercise across sessions
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: exercise_library_id, schema: { type: string } }
 *       - { in: query, name: exercise_id, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Ascending array of progress points
 *
 * /client-portal/workout-logs/{id}:
 *   get:
 *     summary: Get a single logged session with its sets
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Session detail
 *       404:
 *         description: Not found
 */
// Specific routes before the parameterized /:id (§8.6).
// Logging a session needs the training plan; reading history needs progress-history view.
router.get('/workout-logs',                   ...open, requireClientAccess('view_progress_history'), clientPortalController.getWorkoutLogs);
router.post('/workout-logs',                  ...open, requireClientAccess('view_training_plans'),   clientPortalController.createWorkoutLog);
router.get('/workout-logs/previous',          ...open, requireClientAccess('view_training_plans'),   clientPortalController.getWorkoutLogPrevious);
router.get('/workout-logs/exercise-progress', ...open, requireClientAccess('view_progress_history'), clientPortalController.getExerciseProgress);
router.get('/workout-logs/exercises',         ...open, requireClientAccess('view_progress_history'), clientPortalController.getLoggedExercises);
router.get('/workout-logs/:id',               ...open, requireClientAccess('view_progress_history'), clientPortalController.getWorkoutLog);

export default router;
