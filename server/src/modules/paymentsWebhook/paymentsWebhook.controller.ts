import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import * as paymob from '../../lib/paymob';
import { applyPayment } from '../billing/index';
import { recordEvent, ownerRecipients } from '../../lib/events';

// Paymob's server-to-server "Transaction Processed Callback". Unlike the old Fawaterak
// handler — which only logged a warning on a bad signature and processed the payment
// anyway (the flagged gap in docs/billing-architecture-audit.md) — a signature that
// doesn't verify is rejected outright and the payment is not touched.
export async function handleWebhook(req: Request, res: Response) {
    try {
        const rawBody = (req.body as Buffer).toString('utf8');
        let payload: { type?: string; obj?: Record<string, unknown> };

        try {
            payload = JSON.parse(rawBody);
        } catch {
            console.warn('[Webhook] Received non-JSON body');
            return res.status(400).send('Invalid payload');
        }

        const obj = payload.obj;
        const hmac = req.query.hmac as string | undefined;
        if (!obj || !paymob.verifyWebhookHmac(obj, hmac)) {
            console.warn('[Webhook] Signature mismatch or missing transaction object — rejected');
            return res.status(400).send('Invalid signature');
        }

        const orderId        = String((obj.order as { id?: unknown } | undefined)?.id ?? '');
        const merchantOrderId = String((obj.order as { merchant_order_id?: unknown } | undefined)?.merchant_order_id ?? '');
        const success         = obj.success === true;
        const isVoided        = obj.is_voided === true;
        const isRefunded       = obj.is_refunded === true;

        console.log('[Webhook] Received', { orderId, merchantOrderId, success, isVoided, isRefunded });

        // merchant_order_id is the workspace_payments.id we set at checkout creation time
        // (createInvoice/createAddonInvoice) — the primary lookup. gateway_reference_id
        // (Paymob's order id) is a fallback for the rare case a merchant_order_id round-trip
        // gets lost, mirroring the old invoiceId/customerRef dual-lookup.
        let payment = merchantOrderId
            ? await prisma.workspace_payments.findFirst({
                  where:  { id: merchantOrderId },
                  select: { id: true, workspace_id: true, gateway_reference_id: true, gateway_status: true },
              })
            : null;

        if (!payment && orderId) {
            payment = await prisma.workspace_payments.findFirst({
                where:  { gateway_reference_id: orderId },
                select: { id: true, workspace_id: true, gateway_reference_id: true, gateway_status: true },
            });
        }

        if (!payment) {
            console.warn('[Webhook] No workspace_payment found', { orderId, merchantOrderId });
            return res.status(200).send('OK');
        }

        if (orderId && !payment.gateway_reference_id) {
            await prisma.workspace_payments.update({
                where: { id: payment.id },
                data:  { gateway_reference_id: orderId },
            });
        }

        await prisma.workspace_payments.update({
            where: { id: payment.id },
            data:  { gateway_raw_webhook: obj as Prisma.InputJsonValue },
        });

        if (success) {
            await applyPayment(payment.id, payment.workspace_id);
            console.log('[Webhook] Payment', payment.id, '→ paid, subscription extended');
            await recordEvent({
                workspaceId: payment.workspace_id,
                type:        'billing.payment_received',
                title:       'Your subscription payment was received',
                recipients:  await ownerRecipients(payment.workspace_id),
                actor:       { type: 'system' },
                entity:      { type: 'workspace_payment', id: payment.id },
            });
        } else if (isRefunded) {
            await prisma.workspace_payments.update({ where: { id: payment.id }, data: { gateway_status: 'refunded' } });
            console.log('[Webhook] Payment', payment.id, '→ refunded');
        } else if (isVoided) {
            await prisma.workspace_payments.update({ where: { id: payment.id }, data: { gateway_status: 'failed' } });
            console.log('[Webhook] Payment', payment.id, '→ voided/failed');
            await recordEvent({
                workspaceId: payment.workspace_id,
                type:        'billing.payment_failed',
                importance:  'alert',
                title:       'Your subscription payment failed',
                recipients:  await ownerRecipients(payment.workspace_id),
                actor:       { type: 'system' },
                entity:      { type: 'workspace_payment', id: payment.id },
            });
        } else {
            console.log('[Webhook] Unsuccessful, non-terminal transaction — no action taken');
        }

        res.status(200).send('OK');
    } catch (err: unknown) {
        console.error('[Webhook] Unhandled error:', (err as Error).message);
        res.status(200).send('OK');
    }
}
