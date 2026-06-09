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

// ── Forms ──────────────────────────────────────────────────────────────────────
router.get('/',              formsController.getForms);
router.post('/',             formsController.createForm);
router.put('/:id',           formsController.updateForm);
router.delete('/:id',        formsController.deleteForm);

// ── Questions ──────────────────────────────────────────────────────────────────
router.get('/:id/questions',              formsController.getQuestions);
router.post('/:id/questions',             formsController.createQuestion);
router.put('/:id/questions/reorder',      formsController.reorderQuestions);
router.put('/:id/questions/:qid',         formsController.updateQuestion);
router.delete('/:id/questions/:qid',      formsController.deleteQuestion);

// ── Form Requests ──────────────────────────────────────────────────────────────
router.post('/requests',                         formsController.createRequests);
router.get('/requests/client/:client_id',        formsController.getRequestsByClient);
router.delete('/requests/:request_id',           formsController.deleteRequest);
router.get('/queue',                             formsController.getQueue);
router.patch('/queue/review',                    formsController.reviewQueue);

export default router;
