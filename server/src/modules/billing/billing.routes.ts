import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as billingController from './billing.controller';

const router = Router();

/**
 * @openapi
 * /billing/callback:
 *   get:
 *     summary: Payment gateway callback (Paymob transaction response redirect — no auth)
 *     tags: [Billing]
 *     security: []
 *     responses:
 *       200:
 *         description: Payment result page rendered
 */
// No authMiddleware — Paymob redirects the browser here after payment.
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
 *     summary: Create a Paymob checkout (card or wallet) for a subscription plan/variation switch
 *     tags: [Billing]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId, variationId]
 *             properties:
 *               planId:            { type: string }
 *               variationId:       { type: string }
 *               paymentMethod:     { type: string, enum: [card, wallet, fawry], default: card }
 *               walletPhoneNumber: { type: string, description: Required when paymentMethod is wallet }
 *     responses:
 *       200:
 *         description: Checkout created — paymentUrl is a card iframe URL or a wallet redirect URL, or referenceCode is set for Fawry cash payments
 *
 * /billing/addons:
 *   get:
 *     summary: List add-ons the workspace's current plan may buy
 *     tags: [Billing]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of purchasable add-ons with current usage/cap
 *
 * /billing/create-addon-invoice:
 *   post:
 *     summary: Create a Paymob checkout (card or wallet) for an add-on purchase
 *     tags: [Billing]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [addonId]
 *             properties:
 *               addonId:           { type: string }
 *               paymentMethod:     { type: string, enum: [card, wallet, fawry], default: card }
 *               walletPhoneNumber: { type: string, description: Required when paymentMethod is wallet }
 *     responses:
 *       200:
 *         description: Checkout created — paymentUrl is a card iframe URL or a wallet redirect URL, or referenceCode is set for Fawry cash payments
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
router.get('/addons',                    billingController.getAvailableAddons);
router.post('/create-addon-invoice',     billingController.createAddonInvoice);
router.get('/payment-status/:paymentId', billingController.getPaymentStatus);

export default router;
