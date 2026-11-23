import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import { ensureFormsQueueSchema } from './forms.controller';
import { heavyListGate } from '../../middleware/heavyRequestGate';
import * as formsController from './forms.controller';
import * as autoAssignController from './autoAssign.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('forms', action)(req, res, next);
});
router.use(async (_req: Request, _res: Response, next: NextFunction) => {
    try {
        await ensureFormsQueueSchema();
        next();
    } catch (err) {
        next(err);
    }
});

/**
 * @openapi
 * /forms:
 *   get:
 *     summary: List all forms in the workspace
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of forms
 *   post:
 *     summary: Create a form template
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Form created
 *
 * /forms/{id}:
 *   put:
 *     summary: Update a form
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Form updated
 *   delete:
 *     summary: Delete a form (blocked if it has any client assignments — archive instead via PUT status=archived)
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Form deleted
 *       409:
 *         description: Form has existing client submissions/assignments — archive it instead
 */
router.get('/',        formsController.getForms);
router.post('/',       formsController.createForm);
router.put('/:id',     formsController.updateForm);
router.delete('/:id',  formsController.deleteForm);

/**
 * @openapi
 * /forms/import/google-forms-preview:
 *   post:
 *     summary: Parse a Google Form into FitForce's question format (read-only preview, nothing is created)
 *     description: >
 *       Provide either `url` (server fetches the public page itself) or `html`
 *       (fallback for forms Google sign-in-gates from an anonymous fetch —
 *       e.g. any form with a File Upload question — where the coach pastes
 *       the page source from their own signed-in browser instead).
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:  { type: string, description: "A docs.google.com/forms/... link" }
 *               html: { type: string, description: "The form's page source, pasted (fallback when url fails with a sign-in wall)" }
 *     responses:
 *       200:
 *         description: "{ title_en, description_en, questions[], skipped[] }"
 *       400:
 *         description: Invalid input, or the form couldn't be read (private, sign-in required, or malformed)
 */
router.post('/import/google-forms-preview', formsController.importGoogleFormPreview);

/**
 * @openapi
 * /forms/{id}/questions:
 *   get:
 *     summary: List questions for a form
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of questions
 *   post:
 *     summary: Add a question to a form
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Question created
 *
 * /forms/{id}/questions/reorder:
 *   put:
 *     summary: Reorder questions in a form
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Questions reordered
 *
 * /forms/{id}/questions/{qid}:
 *   put:
 *     summary: Update a question
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: qid, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Question updated
 *   delete:
 *     summary: Delete a question (blocked if it has any recorded answers)
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: qid, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Question deleted
 *       409:
 *         description: Question has recorded answers — cannot be deleted
 */
router.get('/:id/questions',           formsController.getQuestions);
router.post('/:id/questions',          formsController.createQuestion);
router.put('/:id/questions/reorder',   formsController.reorderQuestions);
router.put('/:id/questions/:qid',      formsController.updateQuestion);
router.delete('/:id/questions/:qid',   formsController.deleteQuestion);

/**
 * @openapi
 * /forms/{id}/save-draft:
 *   post:
 *     summary: Save the builder's full local draft (form metadata + question set) in one batch
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Draft saved — returns the authoritative persisted form + question list
 *       409:
 *         description: One or more deleted questions have recorded answers, or a metric is double-linked
 */
router.post('/:id/save-draft',         formsController.saveDraft);

/**
 * @openapi
 * /forms/{id}/questions/{qid}/metric-preview:
 *   get:
 *     summary: Preview how many historical answers "Track as Metric" would backfill for this question
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: qid, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: "{ count, convertible }"
 *
 * /forms/{id}/questions/{qid}/track-as-metric:
 *   post:
 *     summary: Link this question to a metric and automatically backfill its historical answers
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: qid, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: "{ question, backfilledCount, versionChanged }"
 *       409:
 *         description: This metric is already tracked by another question in this form
 */
router.get('/:id/questions/:qid/metric-preview',    formsController.getMetricTrackingPreview);
router.post('/:id/questions/:qid/track-as-metric',  formsController.trackQuestionAsMetric);

/**
 * @openapi
 * /forms/requests:
 *   post:
 *     summary: Dispatch form requests to one or more clients
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Form requests created
 *
 * /forms/requests/client/{client_id}:
 *   get:
 *     summary: Get all form requests for a specific client
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: client_id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of form requests for the client
 *
 * /forms/requests/{request_id}:
 *   delete:
 *     summary: Cancel a form request
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: request_id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Request cancelled
 *
 * /forms/queue:
 *   get:
 *     summary: Get completed form submissions awaiting review
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of submitted form responses
 *
 * /forms/queue/review:
 *   patch:
 *     summary: Mark form submissions as reviewed
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Submissions marked as reviewed
 *
 * /forms/queue/assign:
 *   patch:
 *     summary: Assign queue items to a team member (or unassign when assignedTo is null). Owners/managers can send autoAssign=true to also make each affected client's future forms of that plan type go to the same person — works for one row or a whole bulk selection.
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Items assigned (autoAssign reports how many rules were set, the rule ids, or why none were)
 *
 * /forms/queue/auto-assign:
 *   get:
 *     summary: One page of clients with active auto-assign rules, newest first — one row per client with its nutrition and workout agent
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: Client name, email or code contains }
 *       - { in: query, name: planType, schema: { type: string, enum: [nutrition-plan, workout-plan] } }
 *       - { in: query, name: agentUserId, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [unavailable] }, description: Only rules whose agent can no longer receive plans }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [client, nutritionAgent, workoutAgent, setBy, enabledAt] } }
 *       - { in: query, name: sortDir, schema: { type: string, enum: [asc, desc] } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: pageSize, schema: { type: integer, minimum: 1, maximum: 100 } }
 *     responses:
 *       200:
 *         description: "{ items, total, totalRules, page, pageSize } — total counts clients, totalRules the rules matching the filters; each item has a nutrition and a workout cell (or null) with the agent and whether they are still available"
 *
 *   post:
 *     summary: Turn on auto-assign for a queue row (workspace owner/manager only) — the client's future forms of that plan type go to the row's current assignee
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Rule turned on (outcome enabled) or already on (outcome already_on)
 *       400:
 *         description: Row is unassigned, is not a plan form, or the assignee cannot receive plans
 *       403:
 *         description: Caller is not the owner or a manager
 *       404:
 *         description: Queue item not found
 *
 * /forms/queue/auto-assign/off-matching:
 *   post:
 *     summary: Turn off every active rule matching the filters (workspace owner/manager only), e.g. all rules of an agent who left. Needs at least one filter, or all=true.
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: "{ turnedOff } — number of rules switched off"
 *       400:
 *         description: Invalid filter, or no filter and all is not true
 *       403:
 *         description: Caller is not the owner or a manager
 *
 * /forms/queue/auto-assign/agents:
 *   get:
 *     summary: Who the agent dropdowns may offer, per plan type (owner and managers for both, trainers for workout, nutritionists for nutrition)
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: "{ nutrition: [{ id, name }], workout: [{ id, name }] }"
 *
 * /forms/queue/auto-assign/clients/{clientId}/off:
 *   patch:
 *     summary: Turn off both of a client's auto-assign rules (workspace owner/manager only)
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: "{ turnedOff } — number of rules switched off"
 *       403:
 *         description: Caller is not the owner or a manager
 *       404:
 *         description: The client has no active rules
 *
 * /forms/queue/auto-assign/clients/{clientId}/{planType}:
 *   put:
 *     summary: Set (or with agentUserId null, turn off) one client's auto-assign agent for one plan type (workspace owner/manager only)
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentUserId]
 *             properties:
 *               agentUserId: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: "{ outcome: set | turned_off | unchanged, rule }"
 *       400:
 *         description: Invalid plan type, or that person cannot receive this type of plan
 *       403:
 *         description: Caller is not the owner or a manager
 *       404:
 *         description: Client not found
 *
 * /forms/queue/auto-assign/{id}/off:
 *   patch:
 *     summary: Turn off one auto-assign rule (workspace owner/manager only); the rule row is kept as history
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Rule turned off
 *       403:
 *         description: Caller is not the owner or a manager
 *       404:
 *         description: Rule not found or already off
 *
 * /forms/queue/cancel:
 *   delete:
 *     summary: Bulk-cancel pending/scheduled queue requests
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Requests cancelled
 *
 * /forms/queue/archive:
 *   patch:
 *     summary: Archive (or restore) submitted/reviewed queue requests
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Requests archived or restored
 *
 * /forms/queue/labels:
 *   get:
 *     summary: List the workspace's Plans Queue labels
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of labels
 *   post:
 *     summary: Create a Plans Queue label (workspace owner/manager only)
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Label created
 *       403:
 *         description: Caller is not the workspace owner or a manager
 *       409:
 *         description: A label with this name already exists
 *
 * /forms/queue/labels/{id}:
 *   patch:
 *     summary: Rename/recolor a Plans Queue label (workspace owner/manager only)
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Label updated
 *   delete:
 *     summary: Delete a Plans Queue label (workspace owner/manager only) — affected queue items are un-labelled, not blocked
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Label deleted
 *
 * /forms/queue/label:
 *   patch:
 *     summary: Apply or clear a label on a single queue item
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Label applied/cleared
 */
router.post('/requests',                      formsController.createRequests);
router.get('/requests/client/:client_id',     formsController.getRequestsByClient);
router.delete('/requests/:request_id',        formsController.deleteRequest);
router.get('/queue',                          heavyListGate, formsController.getQueue);
router.patch('/queue/review',                 formsController.reviewQueue);
router.patch('/queue/assign',                 formsController.assignQueue);
router.get('/queue/auto-assign',              autoAssignController.getAutoAssignRules);
router.get('/queue/auto-assign/agents',       autoAssignController.getAutoAssignAgents);
router.post('/queue/auto-assign',             autoAssignController.enableAutoAssignRule);
router.post('/queue/auto-assign/off-matching', autoAssignController.turnOffMatchingAutoAssignRules);
router.patch('/queue/auto-assign/clients/:clientId/off', autoAssignController.turnOffAutoAssignClient);
router.put('/queue/auto-assign/clients/:clientId/:planType', autoAssignController.setAutoAssignClientAgent);
router.patch('/queue/auto-assign/:id/off',    autoAssignController.turnOffAutoAssignRule);
router.patch('/queue/archive',                formsController.archiveQueue);
router.delete('/queue/cancel',                formsController.cancelQueue);
router.get('/queue/labels',                   formsController.getQueueLabels);
router.post('/queue/labels',                  formsController.createQueueLabel);
router.patch('/queue/labels/:id',             formsController.updateQueueLabel);
router.delete('/queue/labels/:id',            formsController.deleteQueueLabel);
router.patch('/queue/label',                  formsController.assignQueueLabel);

export default router;
