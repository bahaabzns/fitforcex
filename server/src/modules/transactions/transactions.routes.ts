import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import * as transactionsController from './transactions.controller';

const router = Router();

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

router.get('/proof/:filename',   transactionsController.getProof);
router.post('/upload-proof',     transactionsController.uploadLimiter, transactionsController.upload.single('proof'), transactionsController.uploadProof);
router.get('/by-client/:clientId', transactionsController.getByClient);
router.get('/',                  transactionsController.getTransactions);
router.post('/',                 transactionsController.createTransaction);
router.put('/:id',               transactionsController.updateTransaction);
router.delete('/:id',            transactionsController.deleteTransaction);

export default router;
