import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import * as paymob from '../../lib/paymob';
import * as fawaterak from '../../lib/fawaterak';
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
            const activated = await applyPayment(payment.id, payment.workspace_id);
            console.log('[Webhook] Payment', payment.id, '→ paid, subscription extended');
            if (activated) {
                await recordEvent({
                    workspaceId: payment.workspace_id,
                    type:        'billing.payment_received',
                    title:       'Your subscription payment was received',
                    recipients:  await ownerRecipients(payment.workspace_id),
                    actor:       { type: 'system' },
                    entity:      { type: 'workspace_payment', id: payment.id },
                });
            }
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

// ── Fawaterak ────────────────────────────────────────────────────────────────────────────
// A webhook is only a hint that "something changed on invoice X". Nothing in the payload is
// trusted: we find OUR payment row, then ask Fawaterak's API (authenticated with our own token)
// what happened to THAT row's invoice, and act on that answer. A forged or replayed payload can
// therefore never activate a subscription, and a change in Fawaterak's hashKey scheme can never
// silently stop real payments (Fawry cash payments happen long after the browser is closed, so
// the webhook is their only activation path). The hashKey is still checked, but only to log
// drift — see verifyInvoiceWebhookHash.

type FawaterakPayload = {
    hashKey?: string; invoice_id?: string | number; invoice_key?: string; payment_method?: string;
    invoice_status?: string; referenceId?: string | number; paymentMethod?: string; pay_load?: unknown;
};

const PAYMENT_LOOKUP_SELECT = { id: true, workspace_id: true, gateway: true, gateway_status: true, gateway_reference_id: true } as const;

function parseFawaterakBody(rawBody: string): FawaterakPayload | null {
    try {
        return JSON.parse(rawBody) as FawaterakPayload;
    } catch {
        const form = Object.fromEntries(new URLSearchParams(rawBody));
        return Object.keys(form).length ? form as FawaterakPayload : null;
    }
}

// pay_load is echoed back as whatever we sent in payLoad — an object, or a JSON string
// depending on the webhook type.
function extractPaymentId(payLoad: unknown): string | null {
    let parsed = payLoad;
    if (typeof payLoad === 'string') {
        try { parsed = JSON.parse(payLoad); } catch { return null; }
    }
    const paymentId = (parsed as { payment_id?: unknown } | null)?.payment_id;
    return typeof paymentId === 'string' && paymentId ? paymentId : null;
}

async function findFawaterakPayment(payload: FawaterakPayload) {
    if (payload.invoice_id != null) {
        const byInvoice = await prisma.workspace_payments.findFirst({ where: { gateway: 'fawaterak', gateway_reference_id: String(payload.invoice_id) }, select: PAYMENT_LOOKUP_SELECT });
        if (byInvoice) return byInvoice;
    }
    const paymentId = extractPaymentId(payload.pay_load);
    return paymentId ? prisma.workspace_payments.findFirst({ where: { id: paymentId, gateway: 'fawaterak' }, select: PAYMENT_LOOKUP_SELECT }) : null;
}

async function failPayment(payment: { id: string; workspace_id: string }): Promise<void> {
    await prisma.workspace_payments.update({ where: { id: payment.id }, data: { gateway_status: 'failed' } });
    await recordEvent({
        workspaceId: payment.workspace_id,
        type:        'billing.payment_failed',
        importance:  'alert',
        title:       'Your subscription payment failed',
        recipients:  await ownerRecipients(payment.workspace_id),
        actor:       { type: 'system' },
        entity:      { type: 'workspace_payment', id: payment.id },
    });
}

export async function handleFawaterakWebhook(req: Request, res: Response) {
    try {
        const payload = parseFawaterakBody((req.body as Buffer).toString('utf8'));
        if (!payload) {
            console.warn('[Fawaterak Webhook] Unparseable body');
            return res.status(400).send('Invalid payload');
        }

        const payment = await findFawaterakPayment(payload);
        if (!payment) {
            // Not ours (another store on the same account, a refund notice, a probe) — acknowledge so it isn't retried.
            console.warn('[Fawaterak Webhook] No matching workspace_payment', { invoiceId: payload.invoice_id });
            return res.status(200).send('OK');
        }
        if (payment.gateway_status === 'paid') return res.status(200).send('OK'); // already settled — replay

        if (!payment.gateway_reference_id) {
            // Webhook beat our own write of the invoice id — can't verify yet; the success-page poll covers it.
            console.warn('[Fawaterak Webhook] Payment has no invoice id yet', { paymentId: payment.id });
            return res.status(200).send('OK');
        }

        const isCancel = payload.invoice_id == null && payload.referenceId != null;
        const hashValid = isCancel ? fawaterak.verifyCancelWebhookHash(payload) : fawaterak.verifyInvoiceWebhookHash(payload);
        if (!hashValid) console.warn('[Fawaterak Webhook] hashKey did not verify — continuing on API confirmation only', { paymentId: payment.id });

        const outcome = await fawaterak.getInvoiceOutcome(payment.gateway_reference_id);
        if (outcome === null) {
            console.error('[Fawaterak Webhook] Could not confirm invoice with Fawaterak — asking for a retry', { paymentId: payment.id });
            return res.status(503).send('Retry later');
        }

        if (hashValid) {
            await prisma.workspace_payments.update({ where: { id: payment.id }, data: { gateway_raw_webhook: payload as Prisma.InputJsonValue } });
        }

        if (outcome === 'paid') {
            // applyPayment is idempotent; it reports whether THIS call activated the payment, so a
            // replay (or the success-page poll winning the race) never double-notifies.
            const activated = await applyPayment(payment.id, payment.workspace_id);
            if (activated) {
                await recordEvent({
                    workspaceId: payment.workspace_id,
                    type:        'billing.payment_received',
                    title:       'Your subscription payment was received',
                    recipients:  await ownerRecipients(payment.workspace_id),
                    actor:       { type: 'system' },
                    entity:      { type: 'workspace_payment', id: payment.id },
                });
            }
        } else if (outcome === 'failed' && payment.gateway_status === 'pending') {
            await failPayment(payment);
        }

        res.status(200).send('OK');
    } catch (err: unknown) {
        console.error('[Fawaterak Webhook] Unhandled error:', (err as Error).message);
        // 500 (unlike the Paymob handler's 200): a transient failure here should make the gateway retry.
        res.status(500).send('Error');
    }
}
