import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import * as paymentMethodsController from './paymentMethods.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

/**
 * @openapi
 * /payment-methods:
 *   get:
 *     summary: List payment methods for the workspace
 *     tags: [Payment Methods]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of payment methods
 *   post:
 *     summary: Add a payment method
 *     tags: [Payment Methods]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Payment method added
 *   put:
 *     summary: Update a payment method
 *     tags: [Payment Methods]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payment method updated
 *   delete:
 *     summary: Remove a payment method
 *     tags: [Payment Methods]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payment method removed
 */
router.get('/',    paymentMethodsController.getPaymentMethods);
router.post('/',   paymentMethodsController.createPaymentMethod);
router.put('/',    paymentMethodsController.updatePaymentMethod);
router.delete('/', paymentMethodsController.deletePaymentMethod);

export default router;
