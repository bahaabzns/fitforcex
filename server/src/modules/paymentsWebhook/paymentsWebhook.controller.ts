import { Request, Response } from 'express';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { applyPayment } from '../billing/index';
import { recordEvent, ownerRecipients } from '../../lib/events';

export async function handleWebhook(req: Request, res: Response) {
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

        let payment: { id: string; workspace_id: string; fawaterak_invoice_id: string | null; fawaterak_status: string } | null = null;

        if (invoiceId) {
            payment = await prisma.workspace_payments.findFirst({
                where: { fawaterak_invoice_id: invoiceId },
                select: { id: true, workspace_id: true, fawaterak_invoice_id: true, fawaterak_status: true },
            });
        }

        if (!payment && customerRef) {
            payment = await prisma.workspace_payments.findFirst({
                where: { id: customerRef },
                select: { id: true, workspace_id: true, fawaterak_invoice_id: true, fawaterak_status: true },
            });
        }

        if (!payment) {
            console.warn('[Webhook] No workspace_payment found', { invoiceId, customerRef });
            return res.status(200).send('OK');
        }

        if (invoiceId && !payment.fawaterak_invoice_id) {
            await prisma.workspace_payments.update({
                where: { id: payment.id },
                data:  { fawaterak_invoice_id: invoiceId },
            });
        }

        await prisma.workspace_payments.update({
            where: { id: payment.id },
            data:  { fawaterak_raw_webhook: payload as Prisma.InputJsonValue },
        });

        if (isPaid) {
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
        } else if (['failed', 'expired', 'cancelled'].includes(fawStatus)) {
            await prisma.workspace_payments.update({ where: { id: payment.id }, data: { fawaterak_status: 'failed' } });
            console.log('[Webhook] Payment', payment.id, '→ failed');
            await recordEvent({
                workspaceId: payment.workspace_id,
                type:        'billing.payment_failed',
                importance:  'alert',
                title:       'Your subscription payment failed',
                recipients:  await ownerRecipients(payment.workspace_id),
                actor:       { type: 'system' },
                entity:      { type: 'workspace_payment', id: payment.id },
            });
        } else if (fawStatus === 'refunded') {
            await prisma.workspace_payments.update({ where: { id: payment.id }, data: { fawaterak_status: 'refunded' } });
            console.log('[Webhook] Payment', payment.id, '→ refunded');
        } else {
            console.log('[Webhook] Unhandled status:', fawStatus, '— no action taken');
        }

        res.status(200).send('OK');
    } catch (err: unknown) {
        console.error('[Webhook] Unhandled error:', (err as Error).message);
        res.status(200).send('OK');
    }
}
