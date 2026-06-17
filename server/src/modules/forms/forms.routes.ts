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
 *     summary: Delete a form
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Form deleted
 */
router.get('/',        formsController.getForms);
router.post('/',       formsController.createForm);
router.put('/:id',     formsController.updateForm);
router.delete('/:id',  formsController.deleteForm);

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
 *     summary: Delete a question
 *     tags: [Forms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: qid, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Question deleted
 */
router.get('/:id/questions',           formsController.getQuestions);
router.post('/:id/questions',          formsController.createQuestion);
router.put('/:id/questions/reorder',   formsController.reorderQuestions);
router.put('/:id/questions/:qid',      formsController.updateQuestion);
router.delete('/:id/questions/:qid',   formsController.deleteQuestion);

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
 */
router.post('/requests',                      formsController.createRequests);
router.get('/requests/client/:client_id',     formsController.getRequestsByClient);
router.delete('/requests/:request_id',        formsController.deleteRequest);
router.get('/queue',                          formsController.getQueue);
router.patch('/queue/review',                 formsController.reviewQueue);
router.patch('/queue/assign',                 formsController.assignQueue);

export default router;
