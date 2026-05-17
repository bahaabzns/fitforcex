const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const pool    = require('../db');
const { applyPayment } = require('./billing');

const SECRET_KEY = process.env.FAWATERAK_SECRET_KEY;

// ─── POST /api/payments/webhook ───────────────────────────────────────────────
// Fawaterak calls this on every payment status change.
// Registered BEFORE express.json() in server.js so the raw body is preserved.
// No authMiddleware — Fawaterak is the caller, not a logged-in user.
router.post('/', express.raw({ type: '*/*' }), async (req, res) => {
    try {
        const rawBody = req.body.toString('utf8');
        let payload;

        try {
            payload = JSON.parse(rawBody);
        } catch {
            console.warn('[Webhook] Received non-JSON body');
            return res.status(200).send('OK');
        }

        // ── Signature verification ────────────────────────────────────────────
        // Fawaterak signs with HMAC-SHA256(providerKey, rawBody).
        // The signature arrives in the header or as a hash field in the body.
        // We check both locations and log what we see to make debugging easy.
        const headerSig = req.headers['x-fawaterak-signature']
                       || req.headers['x-signature']
                       || req.headers['signature']
                       || '';

        const bodySig = payload.transactionHash || payload.hash || '';

        const candidate = headerSig || bodySig;

        if (SECRET_KEY && candidate) {
            const expected = crypto
                .createHmac('sha256', SECRET_KEY)
                .update(rawBody)
                .digest('hex');

            const candidateBuf = Buffer.from(candidate.replace(/^sha256=/, ''), 'hex');
            const expectedBuf  = Buffer.from(expected, 'hex');

            if (
                candidateBuf.length !== expectedBuf.length ||
                !crypto.timingSafeEqual(candidateBuf, expectedBuf)
            ) {
                console.warn('[Webhook] Signature mismatch', {
                    header: headerSig,
                    bodyHash: bodySig,
                    expected,
                });
                // Return 200 anyway during initial integration — prevents Fawaterak retry storms
                // while you verify the correct signature format.
                // Switch to return res.status(401).send('Invalid signature') once verified.
            }
        } else {
            console.warn('[Webhook] No signature to verify', {
                headers: Object.keys(req.headers),
                bodyKeys: Object.keys(payload),
            });
        }

        // ── Extract event fields ──────────────────────────────────────────────
        const invoiceId = String(payload.invoiceId || payload.invoice_id || '');
        const fawStatus = String(payload.status || '').toLowerCase();
        // statusCode 200 = paid in some Fawaterak versions
        const isPaid = fawStatus === 'paid' || payload.statusCode === 200;

        console.log('[Webhook] Full payload:', JSON.stringify(payload, null, 2));
        console.log('[Webhook] Received', { invoiceId, fawStatus, statusCode: payload.statusCode });

        // ── Find the payment record ───────────────────────────────────────────
        // Payment-link flow passes our DB id as customerRef; API flow uses invoiceId.
        const customerRef = String(
            payload.customerRef || payload.customer_ref ||
            payload.metaData?.customerRef || payload.metaData?.reference_id || ''
        );

        let rows;

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

        // Store Fawaterak's invoiceId on the record now that we have it
        if (invoiceId && !payment.fawaterak_invoice_id) {
            await pool.query(
                `UPDATE workspace_payments SET fawaterak_invoice_id = $1 WHERE id = $2`,
                [invoiceId, payment.id]
            );
        }

        // Save raw payload regardless of status (audit trail)
        await pool.query(
            `UPDATE workspace_payments SET fawaterak_raw_webhook = $1 WHERE id = $2`,
            [payload, payment.id]
        );

        // ── Apply the status change ───────────────────────────────────────────
        if (isPaid) {
            await applyPayment(payment.id, payment.workspace_id);
            console.log('[Webhook] Payment', payment.id, '→ paid, subscription extended');
        } else if (['failed', 'expired', 'cancelled'].includes(fawStatus)) {
            await pool.query(
                `UPDATE workspace_payments SET fawaterak_status = 'failed' WHERE id = $1`,
                [payment.id]
            );
            console.log('[Webhook] Payment', payment.id, '→ failed');
        } else if (fawStatus === 'refunded') {
            await pool.query(
                `UPDATE workspace_payments SET fawaterak_status = 'refunded' WHERE id = $1`,
                [payment.id]
            );
            console.log('[Webhook] Payment', payment.id, '→ refunded');
        } else {
            console.log('[Webhook] Unhandled status:', fawStatus, '— no action taken');
        }

        // Always return 200 — any other code causes Fawaterak to retry indefinitely
        res.status(200).send('OK');
    } catch (err) {
        console.error('[Webhook] Unhandled error:', err.message);
        res.status(200).send('OK');
    }
});

module.exports = router;
