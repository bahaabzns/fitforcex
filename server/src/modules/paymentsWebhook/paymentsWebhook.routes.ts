import { Router } from 'express';
import express from 'express';
import { handleWebhook } from './paymentsWebhook.controller';

const router = Router();

// Registered BEFORE express.json() in app.ts so the raw body is preserved for HMAC verification.
// No authMiddleware — Fawaterak is the caller, not a logged-in user.
router.post('/', express.raw({ type: '*/*' }), handleWebhook);

export default router;
