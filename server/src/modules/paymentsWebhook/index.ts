import { Router } from 'express';
import crypto from 'crypto';
import express from 'express';
import pool from '../../db';
import { env } from '../../config/env';
import { applyPayment } from '../billing/index';

const router = Router();

// Registered BEFORE express.json() in app.ts so the raw body is preserved for HMAC verification.
// No authMiddleware — Fawaterak is the caller, not a logged-in user.
router.post('/', express.raw({ type: '*/*' }), async (req, res) => {
    try {
        const rawBody = (req.body as Buffer).toString('utf8');
        let payload: Record<string, unknown>;

        try {
            payload = JSON.parse(rawBody);
        } catch {
            console.warn('[Webhook] Received non-JSON body');
            return res.status(200).send('OK');
        }

        const headerSig = (
            req.headers['x-fawaterak-signature'] ||
            req.headers['x-signature'] ||
            req.headers['signature'] ||
            ''
        ) as string;

        const bodySig   = String(payload.transactionHash || payload.hash || '');
        const candidate = headerSig || bodySig;

        if (env.FAWATERAK_SECRET_KEY && candidate) {
            const expected = crypto.createHmac('sha256', env.FAWATERAK_SECRET_KEY).update(rawBody).digest('hex');
            const candidateBuf = Buffer.from(candidate.replace(/^sha256=/, ''), 'hex');
            const expectedBuf  = Buffer.from(expected, 'hex');

            if (candidateBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(candidateBuf, expectedBuf)) {
                console.warn('[Webhook] Signature mismatch', { header: headerSig, bodyHash: bodySig, expected });
            }
        } else {
            console.warn('[Webhook] No signature to verify', { headers: Object.keys(req.headers), bodyKeys: Object.keys(payload) });
        }

        const invoiceId = String(payload.invoiceId || payload.invoice_id || '');
        const fawStatus = String(payload.status || '').toLowerCase();
        const isPaid    = fawStatus === 'paid' || payload.statusCode === 200;

        console.log('[Webhook] Full payload:', JSON.stringify(payload, null, 2));
        console.log('[Webhook] Received', { invoiceId, fawStatus, statusCode: payload.statusCode });

        const meta = payload.metaData as Record<string, unknown> | undefined;
        const customerRef = String(
            payload.customerRef || payload.customer_ref ||
            meta?.customerRef  || meta?.reference_id  || ''
        );

        let rows: Record<string, unknown>[] | undefined;

        if (invoiceId) {
            ({ rows } = await pool.query(
                `SELECT id, workspace_id, fawaterak_status FROM workspace_payments WHERE fawaterak_invoice_id = $1`,
                [invoiceId]
            ));
        }

        if ((!rows || !rows.length) && customerRef) {
            ({ rows } = await pool.query(
                `SELECT id, workspace_id, fawaterak_status FROM workspace_payments WHERE id = $1`,
                [customerRef]
            ));
        }

        if (!rows || !rows.length) {
            console.warn('[Webhook] No workspace_payment found', { invoiceId, customerRef });
            return res.status(200).send('OK');
        }

        const payment = rows[0];

        if (invoiceId && !payment.fawaterak_invoice_id) {
            await pool.query(`UPDATE workspace_payments SET fawaterak_invoice_id = $1 WHERE id = $2`, [invoiceId, payment.id]);
        }

        await pool.query(`UPDATE workspace_payments SET fawaterak_raw_webhook = $1 WHERE id = $2`, [payload, payment.id]);

        if (isPaid) {
            await applyPayment(payment.id as string, payment.workspace_id as string);
            console.log('[Webhook] Payment', payment.id, '→ paid, subscription extended');
        } else if (['failed', 'expired', 'cancelled'].includes(fawStatus)) {
            await pool.query(`UPDATE workspace_payments SET fawaterak_status = 'failed' WHERE id = $1`, [payment.id]);
            console.log('[Webhook] Payment', payment.id, '→ failed');
        } else if (fawStatus === 'refunded') {
            await pool.query(`UPDATE workspace_payments SET fawaterak_status = 'refunded' WHERE id = $1`, [payment.id]);
            console.log('[Webhook] Payment', payment.id, '→ refunded');
        } else {
            console.log('[Webhook] Unhandled status:', fawStatus, '— no action taken');
        }

        res.status(200).send('OK');
    } catch (err: unknown) {
        console.error('[Webhook] Unhandled error:', (err as Error).message);
        res.status(200).send('OK');
    }
});

export default router;
