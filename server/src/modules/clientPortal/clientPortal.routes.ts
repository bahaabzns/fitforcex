import { Router } from 'express';
import clientAuthMiddleware from '../../middleware/clientAuth';
import { attachmentUploader } from '../../lib/messageAttachments';
import {
    loadClientAccess,
    requirePortalOpen,
    requireClientAccess,
    requireAnyClientAccess,
} from '../../middleware/clientAccessPolicy';
import { loginLimiter, workspaceDiscoveryLimiter } from '../../middleware/rateLimit';
import * as clientPortalController from './clientPortal.controller';
import * as clientPortalNotificationsController from './clientPortalNotifications.controller';
import * as clientPortalInsightsController from './clientPortalInsights.controller';
import * as clientPortalFoodSwapController from './clientPortalFoodSwap.controller';
import { screenshotUploader, uploadScreenshot } from '../insights/insights.controller';

const router = Router();

// Authenticated + access-loaded chain (no portal-open gate — used by /me and /access).
const authed = [clientAuthMiddleware, loadClientAccess];
// Feature chain: also blocks entirely when keep_portal_access is off.
const open   = [clientAuthMiddleware, loadClientAccess, requirePortalOpen];

/**
 * @openapi
 * /client-portal/discover-workspace:
 *   post:
 *     summary: Email-first workspace discovery for the mobile login flow
 *     tags: [Client Portal]
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
 *         description: One or more workspaces matched this email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workspaces:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       slug:       { type: string }
 *                       name:       { type: string }
 *                       logoUrl:    { type: string, nullable: true }
 *                       clientName: { type: string, nullable: true }
 *       400:
 *         description: Invalid email
 *       404:
 *         description: No account found with this email
 */
router.post('/discover-workspace', workspaceDiscoveryLimiter, clientPortalController.discoverWorkspace);

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
 * /client-portal/meal-items/{mealItemId}/swap-search:
 *   get:
 *     summary: Search foods in the same category as the current meal item for an equivalent swap
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: mealItemId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: query
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Current food plus candidate alternatives (same food category) with pre-computed equivalent amounts
 */
router.get(
    '/meal-items/:mealItemId/swap-search',
    ...open,
    requireClientAccess('view_nutrition_plans'),
    clientPortalFoodSwapController.searchSwapAlternatives
);

/**
 * @openapi
 * /client-portal/meal-items/{mealItemId}/swap:
 *   post:
 *     summary: Swap a meal item's food for a backend-computed equivalent amount
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: mealItemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alternativeFoodId: { type: string }
 *     responses:
 *       200:
 *         description: Swap applied
 */
router.post(
    '/meal-items/:mealItemId/swap',
    ...open,
    requireClientAccess('allow_food_swap'),
    clientPortalFoodSwapController.swapMealItemFood
);

/**
 * @openapi
 * /client-portal/meal-items/{mealItemId}/swap/reset:
 *   post:
 *     summary: Reset a swapped meal item back to the coach's original prescription
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: mealItemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reset applied
 */
router.post(
    '/meal-items/:mealItemId/swap/reset',
    ...open,
    requireClientAccess('allow_food_swap'),
    clientPortalFoodSwapController.resetMealItemFood
);

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
 *
 * /client-portal/form-requests/{request_id}/answers/{question_id}:
 *   patch:
 *     summary: Edit a single previously submitted answer — logs a form_response_edits entry
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: request_id, required: true, schema: { type: string } }
 *       - { in: path, name: question_id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answer]
 *             properties:
 *               answer: { type: string }
 *     responses:
 *       200:
 *         description: "{ success, answer }"
 *       400:
 *         description: Form not submitted yet
 *       404:
 *         description: Request or answer not found
 */
router.get('/form-requests',                     ...open, requireAnyClientAccess(['view_assessments', 'view_checkins']), clientPortalController.getFormRequests);
router.get('/form-requests/:request_id',         ...open, requireAnyClientAccess(['view_assessments', 'view_checkins']), clientPortalController.getFormRequest);
router.post('/form-requests/:request_id/submit', ...open, requireClientAccess('allow_submit_checkins'), clientPortalController.submitFormRequest);
router.patch('/form-requests/:request_id/answers/:question_id', ...open, requireClientAccess('allow_submit_checkins'), clientPortalController.editFormAnswer);

/**
 * @openapi
 * /client-portal/action-items:
 *   get:
 *     summary: Things needing the client's attention — pending forms, new/restarted plans, subscription renewal
 *     tags: [Client Portal]
 *     responses:
 *       200:
 *         description: List of action items, most urgent first
 */
router.get('/action-items', ...open, clientPortalController.getActionItems);

router.post('/uploads/photo', ...open, clientPortalController.photoUploader.single('photo'), clientPortalController.uploadPhoto);

/**
 * @openapi
 * /client-portal/uploads/attachment/{category}:
 *   post:
 *     summary: Upload a file for an "attachment" form question, validated against the question's configured category
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: category, required: true, schema: { type: string, enum: [images, documents, videos, any] } }
 *     responses:
 *       201:
 *         description: "{ url, name, mime, size }"
 *       400:
 *         description: Invalid category, no file, or a file outside the category's allowlist
 */
router.post('/uploads/attachment/:category', ...open, clientPortalController.uploadAttachmentMiddleware, clientPortalController.uploadAttachment);

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
 * /client-portal/messages/attachments:
 *   post:
 *     summary: Upload and send an image, voice note, or file attachment to the coach team
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:            { type: string, format: binary }
 *               body:            { type: string, maxLength: 5000 }
 *               durationSeconds: { type: number }
 *     responses:
 *       201:
 *         description: Attachment message created
 *       400:
 *         description: No file uploaded
 *
 * /client-portal/messages/{messageId}:
 *   patch:
 *     summary: Edit a previously sent text message
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: messageId, required: true, schema: { type: string } }
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
 *       200:
 *         description: Message updated
 *       403:
 *         description: Not the message's sender
 *       404:
 *         description: Message not found
 *   delete:
 *     summary: Soft-delete a previously sent message
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: messageId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Message deleted (tombstoned)
 *       403:
 *         description: Not the message's sender
 *       404:
 *         description: Message not found
 */
router.post('/messages/attachments', ...open, requireClientAccess('allow_messaging'), attachmentUploader.single('file'), clientPortalController.sendMessageAttachment);
router.patch('/messages/:messageId', ...open, requireClientAccess('allow_messaging'), clientPortalController.editMessage);
router.delete('/messages/:messageId', ...open, requireClientAccess('allow_messaging'), clientPortalController.deleteMessage);

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
 * /client-portal/workout-logs/draft:
 *   get:
 *     summary: Find an in-progress (not yet finished) draft for a training day, if any — Instant Save's cross-device/cross-session resume path
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: day_id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: The draft (id, plan_id, day_id, day_index, started_at, exercises), or null if none
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
 * /client-portal/workout-logs/exercise-insights:
 *   get:
 *     summary: Progress chart, personal records, recent sessions and trend insights for one exercise
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: exercise_library_id, schema: { type: string } }
 *       - { in: query, name: exercise_id, schema: { type: string } }
 *     responses:
 *       200:
 *         description: "{ progressPoints, recentSessions, personalRecords, insights, timeline }"
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
 *   put:
 *     summary: >
 *       Instant Save — upsert a workout log by a client-generated id. Used for
 *       both the debounced in-progress autosave (completed:false) and Finish
 *       (completed:true), so both target the same row instead of Finish
 *       creating a second one. A no-op once the row is already completed —
 *       a finished session is an immutable snapshot.
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Draft saved, or (completed:true) the finished session's summary
 *       400:
 *         description: Validation failed
 *       403:
 *         description: This id belongs to another client's workout log
 *   delete:
 *     summary: Delete a logged session
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
// Specific routes before the parameterized /:id (§8.6).
// Logging a session needs the training plan; reading history needs progress-history view.
router.get('/workout-logs',                   ...open, requireClientAccess('view_progress_history'), clientPortalController.getWorkoutLogs);
router.post('/workout-logs',                  ...open, requireClientAccess('view_training_plans'),   clientPortalController.createWorkoutLog);
router.get('/workout-logs/draft',             ...open, requireClientAccess('view_training_plans'),   clientPortalController.getWorkoutLogDraft);
router.get('/workout-logs/previous',          ...open, requireClientAccess('view_training_plans'),   clientPortalController.getWorkoutLogPrevious);
router.get('/workout-logs/exercise-progress', ...open, requireClientAccess('view_progress_history'), clientPortalController.getExerciseProgress);
router.get('/workout-logs/exercise-insights', ...open, requireClientAccess('view_progress_history'), clientPortalController.getExerciseInsights);
router.get('/workout-logs/exercises',         ...open, requireClientAccess('view_progress_history'), clientPortalController.getLoggedExercises);
router.get('/workout-logs/:id',               ...open, requireClientAccess('view_progress_history'), clientPortalController.getWorkoutLog);
router.put('/workout-logs/:id',               ...open, requireClientAccess('view_training_plans'),   clientPortalController.upsertWorkoutLog);
router.delete('/workout-logs/:id',            ...open, requireClientAccess('view_progress_history'), clientPortalController.deleteWorkoutLog);

/**
 * @openapi
 * /client-portal/transformation:
 *   get:
 *     summary: Client's own tracked metric history and form submission timeline
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: "{ metrics: [{ id, name, unit, type, icon, history }], timeline: [...] }"
 */
router.get('/transformation', ...open, clientPortalController.getPortalTransformation);

/**
 * @openapi
 * /client-portal/notifications:
 *   get:
 *     summary: List the current client's notifications (newest first)
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: unread, required: false, schema: { type: boolean }, description: When true, only unread notifications }
 *       - { in: query, name: limit,  required: false, schema: { type: integer, default: 30, maximum: 100 } }
 *     responses:
 *       200: { description: Array of notifications }
 *
 * /client-portal/notifications/unread-count:
 *   get:
 *     summary: Count the current client's unread notifications (bell badge)
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: "{ count: number }" }
 *
 * /client-portal/notifications/read-all:
 *   patch:
 *     summary: Mark all of the current client's notifications as read
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: "{ updated: number }" }
 *
 * /client-portal/notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [Client Portal]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "{ updated: number }" }
 *       404: { description: Notification not found }
 */
// Specific routes before the parameterized one (CLAUDE.md §8.6).
router.get('/notifications',              ...open, clientPortalNotificationsController.listNotifications);
router.get('/notifications/unread-count', ...open, clientPortalNotificationsController.getUnreadCount);
router.patch('/notifications/read-all',   ...open, clientPortalNotificationsController.markAllRead);
router.patch('/notifications/:id/read',   ...open, clientPortalNotificationsController.markRead);

/**
 * @openapi
 * /client-portal/insights:
 *   post:
 *     summary: Submit organic feedback (bug, feature request, or a standalone rating)
 *     tags: [Client Portal, Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Insight created }
 *       400: { description: Invalid sourceType or missing required field }
 *
 * /client-portal/prompts/active:
 *   get:
 *     summary: Get the currently active Founder Prompt targeted at this client, if any and not yet answered
 *     tags: [Client Portal, Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: The active prompt, or null }
 *
 * /client-portal/prompts/post-session:
 *   get:
 *     summary: Get the recurring Post-Session Feedback prompt shown on the Training Mode completion page
 *     tags: [Client Portal, Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: The prompt, or null if not currently active }
 *
 * /client-portal/prompts/{id}/respond:
 *   post:
 *     summary: Answer an active Founder Prompt
 *     tags: [Client Portal, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Response recorded }
 *       404: { description: This prompt is no longer active }
 */
router.post('/insights',            ...open, clientPortalInsightsController.submitInsight);
router.post('/insights/screenshot', ...open, screenshotUploader.single('file'), uploadScreenshot);
router.get('/prompts/active',              ...open, clientPortalInsightsController.getActivePrompt);
router.get('/prompts/post-session',        ...open, clientPortalInsightsController.getPostSessionPrompt);
router.get('/prompts/for-trigger/:event',  ...open, clientPortalInsightsController.getPromptForTrigger);
router.post('/prompts/:id/respond',        ...open, clientPortalInsightsController.respondToPrompt);
router.post('/prompts/:id/dismiss',        ...open, clientPortalInsightsController.dismissPrompt);
router.post('/prompts/:id/started',        ...open, clientPortalInsightsController.startPrompt);

export default router;
