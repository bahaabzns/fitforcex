import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as billingController from './billing.controller';

const router = Router();

/**
 * @openapi
 * /billing/callback:
 *   get:
 *     summary: Payment gateway callback (Fawaterak iframe redirect — no auth)
 *     tags: [Billing]
 *     security: []
 *     responses:
 *       200:
 *         description: Payment result page rendered
 */
// No authMiddleware — Fawaterak redirects the iframe here after payment.
router.get('/callback', billingController.handleCallback);

router.use(authMiddleware);

router.use((req, res, next) => {
    if (!req.user!.isOwner) {
        return res.status(403).json({ error: 'Only the workspace owner can manage billing' });
    }
    next();
});

/**
 * @openapi
 * /billing/subscription:
 *   get:
 *     summary: Get the current workspace subscription
 *     tags: [Billing]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Subscription details
 *       403:
 *         description: Only the workspace owner can access billing
 *
 * /billing/plans:
 *   get:
 *     summary: List available subscription plans
 *     tags: [Billing]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of available plans with pricing
 *
 * /billing/create-invoice:
 *   post:
 *     summary: Create a payment invoice for a subscription upgrade
 *     tags: [Billing]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId:    { type: string }
 *               discountId: { type: string }
 *     responses:
 *       200:
 *         description: Invoice created with payment URL
 *
 * /billing/payment-status/{paymentId}:
 *   get:
 *     summary: Poll the status of a payment
 *     tags: [Billing]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: paymentId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Payment status
 */
router.get('/subscription',              billingController.getSubscription);
router.get('/plans',                     billingController.getPlans);
router.post('/create-invoice',           billingController.createInvoice);
router.get('/payment-status/:paymentId', billingController.getPaymentStatus);

export default router;
