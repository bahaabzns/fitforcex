import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import requireOwner from '../../middleware/requireOwner';
import { observationAttachmentUploader } from '../../lib/observationAttachments';
import * as clientsController from './clients.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('clients', action)(req, res, next);
});

/**
 * @openapi
 * /clients/limit-check:
 *   get:
 *     summary: Check if the workspace can add more clients under its current plan
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Limit status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canAdd:  { type: boolean }
 *                 current: { type: integer }
 *                 limit:   { type: integer }
 */
router.get('/limit-check', clientsController.checkClientLimitHandler);

/**
 * @openapi
 * /clients:
 *   get:
 *     summary: List all active clients in the workspace
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of clients
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Client'
 *   post:
 *     summary: Create a new client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fname, lname]
 *             properties:
 *               fname: { type: string }
 *               lname: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: Client created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       400:
 *         description: Validation error
 */
router.get('/', clientsController.getClients);
router.post('/', clientsController.createClient);

/**
 * @openapi
 * /clients/{id}:
 *   get:
 *     summary: Get a single client by ID
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Client record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       404:
 *         description: Client not found
 *   put:
 *     summary: Update a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Client'
 *     responses:
 *       200:
 *         description: Client updated
 *       404:
 *         description: Client not found
 *   delete:
 *     summary: Archive a client (default delete — preserves all data, reversible)
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Client archived
 *       404:
 *         description: Client not found
 *       409:
 *         description: Client is already archived
 */
router.get('/:id', clientsController.getClient);
router.put('/:id', clientsController.updateClient);
router.delete('/:id', clientsController.archiveClient);

/**
 * @openapi
 * /clients/{id}/restore:
 *   post:
 *     summary: Restore an archived client to active operations
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Client restored
 *       409:
 *         description: Client is not archived
 *
 * /clients/{id}/audit:
 *   get:
 *     summary: Activity timeline for a client (archive/restore/delete + status changes)
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of audit events, newest first
 *
 * /clients/{id}/permanent:
 *   delete:
 *     summary: Permanently delete an archived client (owner only, name confirmation)
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [confirmName]
 *             properties:
 *               confirmName: { type: string, description: Exact "First Last" of the client }
 *     responses:
 *       200:
 *         description: Client permanently deleted (anonymized or hard-deleted per workspace strategy)
 *       400:
 *         description: Name confirmation did not match
 *       403:
 *         description: Owner permission required
 *       409:
 *         description: Only archived clients can be permanently deleted
 */
router.post('/:id/restore', clientsController.restoreClient);
router.get('/:id/audit', clientsController.getClientAudit);
router.delete('/:id/permanent', requireOwner, clientsController.permanentDeleteClient);

/**
 * @openapi
 * /clients/{id}/freezes:
 *   get:
 *     summary: List freeze periods for a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of freeze records
 *   post:
 *     summary: Add a freeze period to a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startDate, endDate]
 *             properties:
 *               startDate: { type: string, format: date }
 *               endDate:   { type: string, format: date }
 *     responses:
 *       201:
 *         description: Freeze created
 *
 * /clients/{id}/freezes/{freezeId}:
 *   delete:
 *     summary: Remove a freeze period
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: freezeId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Freeze removed
 */
router.get('/:id/package-defaults', clientsController.getClientPackageDefaults);
router.get('/:id/freezes', clientsController.getFreezes);
router.post('/:id/freezes', clientsController.createFreeze);
router.delete('/:id/freezes/:freezeId', clientsController.deleteFreeze);

/**
 * @openapi
 * /clients/{id}/set-password:
 *   post:
 *     summary: Set or reset the portal login password for a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Password set
 */
router.post('/:id/set-password', clientsController.setPassword);

/**
 * @openapi
 * /clients/{id}/workout-logs:
 *   get:
 *     summary: List a client's logged workout sessions
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of session summaries
 *
 * /clients/{id}/exercise-progress:
 *   get:
 *     summary: Progress time series for one of the client's exercises
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: query, name: exercise_library_id, schema: { type: string } }
 *       - { in: query, name: exercise_id, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Ascending array of progress points
 *
 * /clients/{id}/exercise-insights:
 *   get:
 *     summary: Combined exercise insights — progress chart, PRs, coaching signals, history
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: query, name: exercise_library_id, schema: { type: string } }
 *       - { in: query, name: exercise_id, schema: { type: string } }
 *     responses:
 *       200:
 *         description: progressPoints, recentSessions, personalRecords, insights, timeline
 *       400:
 *         description: exercise_library_id or exercise_id required
 *       404:
 *         description: Client not found
 *
 * /clients/{id}/workout-logs/{logId}:
 *   get:
 *     summary: Get one of the client's logged sessions with its sets
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: logId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Session detail
 *       404:
 *         description: Not found
 */
router.get('/:id/workout-logs',        clientsController.getClientWorkoutLogs);
router.get('/:id/exercise-progress',   clientsController.getClientExerciseProgress);
router.get('/:id/exercise-insights',   clientsController.getClientExerciseInsights);
router.get('/:id/logged-exercises',    clientsController.getClientLoggedExercises);
router.get('/:id/workout-logs/:logId', clientsController.getClientWorkoutLog);

/**
 * @openapi
 * /clients/{id}/transformation:
 *   get:
 *     summary: Tracked metric history and form submission timeline for a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: "{ metrics: [{ id, name, unit, type, icon, history }], timeline: [...] }"
 *       404:
 *         description: Client not found
 */
router.get('/:id/transformation', clientsController.getClientTransformation);

// Observations — see @openapi blocks in clients.controller.ts for full schema.
router.get('/:id/observations', clientsController.getObservations);
router.post('/:id/observations', observationAttachmentUploader.single('file'), clientsController.createObservation);
router.patch('/:id/observations/:obsId', observationAttachmentUploader.single('file'), clientsController.updateObservation);
router.delete('/:id/observations/:obsId', clientsController.deleteObservation);

export default router;
