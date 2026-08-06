import { Router } from 'express';
import express from 'express';
import { handleWebhook } from './paymentsWebhook.controller';

const router = Router();

/**
 * @openapi
 * /payments/webhook:
 *   post:
 *     summary: Paymob payment webhook receiver
 *     tags: [Payments Webhook]
 *     security: []
 *     description: >
 *       Called by Paymob after a payment event ("Transaction Processed Callback").
 *       Registered before express.json() so the raw body is preserved for HMAC signature
 *       verification. Not callable by end users — Paymob is the caller.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 *       400:
 *         description: Invalid signature or malformed payload
 */
// Registered BEFORE express.json() in app.ts so the raw body is preserved for HMAC verification.
// No authMiddleware — Paymob is the caller, not a logged-in user.
router.post('/', express.raw({ type: '*/*' }), handleWebhook);

export default router;
