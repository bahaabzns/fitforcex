import { Router } from 'express';
import express from 'express';
import { handleWebhook, handleFawaterakWebhook } from './paymentsWebhook.controller';
import { webhookLimiter } from '../../middleware/rateLimit';

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
router.post('/', webhookLimiter, express.raw({ type: '*/*' }), handleWebhook);

/**
 * @openapi
 * /payments/webhook/fawaterak:
 *   post:
 *     summary: Fawaterak payment webhook receiver (paid / failed / cancelled)
 *     tags: [Payments Webhook]
 *     security: []
 *     description: >
 *       Called by Fawaterak; register this URL under Integration in the Fawaterak portal.
 *       The payload is never trusted: the invoice is re-checked against Fawaterak's API before acting.
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
router.post('/fawaterak', webhookLimiter, express.raw({ type: '*/*' }), handleFawaterakWebhook);

export default router;
