import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import { ensureFormsQueueSchema } from './forms.controller';
import * as formsController from './forms.controller';

const router = Router();

router.use(authMiddleware);
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
 *     summary: Assign queue items to a team member (or unassign when assignedTo is null)
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Items assigned
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
 */
router.post('/requests',                      formsController.createRequests);
router.get('/requests/client/:client_id',     formsController.getRequestsByClient);
router.delete('/requests/:request_id',        formsController.deleteRequest);
router.get('/queue',                          formsController.getQueue);
router.patch('/queue/review',                 formsController.reviewQueue);
router.patch('/queue/assign',                 formsController.assignQueue);
router.patch('/queue/archive',                formsController.archiveQueue);
router.delete('/queue/cancel',                formsController.cancelQueue);

export default router;
