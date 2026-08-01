import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import * as transactionsController from './transactions.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

/**
 * @openapi
 * /transactions/proof/{filename}:
 *   get:
 *     summary: Serve a payment proof file
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: filename, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: File served
 *       404:
 *         description: File not found
 */
router.get('/proof/:filename', transactionsController.getProof);

/**
 * @openapi
 * /transactions/upload-proof:
 *   post:
 *     summary: Upload a payment proof file (stored in S3)
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               proof: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: File uploaded; S3 URL returned
 */
router.post('/upload-proof', transactionsController.uploadLimiter, transactionsController.upload.single('proof'), transactionsController.uploadProof);

/**
 * @openapi
 * /transactions/by-client/{clientId}:
 *   get:
 *     summary: List transactions for a specific client
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: clientId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of transactions for the client
 */
router.get('/by-client/:clientId', transactionsController.getByClient);

/**
 * @openapi
 * /transactions:
 *   get:
 *     summary: List all transactions in the workspace
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of transactions
 *   post:
 *     summary: Create a transaction record
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Transaction created
 *
 * /transactions/{id}:
 *   put:
 *     summary: Update a transaction
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Transaction updated
 *   delete:
 *     summary: Delete a transaction
 *     tags: [Transactions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Transaction deleted
 */
router.get('/',     transactionsController.getTransactions);
router.post('/',    transactionsController.createTransaction);
router.put('/:id',  transactionsController.updateTransaction);
router.delete('/:id', transactionsController.deleteTransaction);

export default router;
