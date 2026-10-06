import crypto from 'crypto';
import { env } from '../config/env';

// Fawaterak v2 API (https://fawaterak-api.readme.io). Every checkout is a fresh invoice
// created server-side for the exact amount (POST /invoiceInitPay) — no static payment links.
// Flow: pick the account's payment_method_id for card / wallet / Fawry → invoiceInitPay →
// the response carries a hosted-page URL (card), or a Fawry code / wallet reference.

export type FawaterakMethod = 'card' | 'wallet' | 'fawry';

interface CheckoutParams {
    method:          FawaterakMethod;
    amount:          number;
    currency:        string;
    merchantOrderId: string; // our workspace_payments.id — echoed back in webhooks via payLoad
    description:     string;
    coachName:       string;
    coachEmail:      string;
    coachPhone?:     string;
    walletPhoneNumber?: string;
    successUrl:      string;
    failUrl:         string;
    pendingUrl:      string;
}

const REQUEST_TIMEOUT_MS = 15000;
const FALLBACK_CUSTOMER_PHONE = '01000000000';

function assertConfigured(): void {
    if (!env.FAWATERAK_API_TOKEN) {
        throw Object.assign(new Error('Fawaterak is not configured (FAWATERAK_API_TOKEN missing). Contact support.'), { status: 400 });
    }
}

function resolveMethodId(method: FawaterakMethod): number {
    const rawId = { card: env.FAWATERAK_METHOD_ID_CARD, wallet: env.FAWATERAK_METHOD_ID_WALLET, fawry: env.FAWATERAK_METHOD_ID_FAWRY }[method];
    const methodId = Number(rawId);
    if (!rawId || !Number.isInteger(methodId)) {
        throw Object.assign(new Error('Fawaterak is not configured for this payment method. Contact support.'), { status: 400 });
    }
    return methodId;
}

async function fawaterakRequest<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<{ ok: boolean; body: T }> {
    assertConfigured();
    const response = await fetch(`${env.FAWATERAK_BASE_URL}/api/v2${path}`, {
        method:  init.method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.FAWATERAK_API_TOKEN}` },
        body:    init.body ? JSON.stringify(init.body) : undefined,
        signal:  AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { ok: response.ok, body: await response.json() as T };
}

/** Lists the payment methods enabled on our Fawaterak account — used to find the
 *  FAWATERAK_METHOD_ID_* values (they are account-specific) via the check script. */
export async function getPaymentMethods(): Promise<{ paymentId: number; name_en: string; name_ar: string; redirect: boolean }[]> {
    const { ok, body } = await fawaterakRequest<{ status?: string; data?: { paymentId: number; name_en: string; name_ar: string; redirect: boolean }[] }>(
        '/getPaymentmethods', { method: 'GET' }
    );
    if (!ok || body.status !== 'success' || !body.data) {
        throw Object.assign(new Error(`Fawaterak payment methods lookup failed: ${JSON.stringify(body)}`), { status: 502 });
    }
    return body.data;
}

type InvoiceInitPayResponse = {
    status?: string;
    message?: string | { cartTotal?: string[] };
    data?: {
        invoice_id?: number | string;
        invoice_key?: string;
        payment_data?: { redirectTo?: string; fawryCode?: string | number; meezaReference?: string | number; meezaQrCode?: string; amanCode?: string | number; masaryCode?: string | number };
    };
};

/** Creates the invoice and returns whichever completion channel the method produced:
 *  `paymentUrl` for the hosted page (normally every method, via redirectOption), with
 *  `referenceCode` / `qrPayload` only as a fallback if a method returns no URL. */
export async function createCheckout(params: CheckoutParams): Promise<{ orderId: string; paymentUrl?: string; referenceCode?: string; qrPayload?: string }> {
    const firstName = params.coachName.split(' ')[0] || params.coachName;
    const lastName  = params.coachName.split(' ').slice(1).join(' ') || '-';
    const customerPhone = params.method === 'wallet' ? params.walletPhoneNumber : params.coachPhone;

    const { ok, body } = await fawaterakRequest<InvoiceInitPayResponse>('/invoiceInitPay', {
        method: 'POST',
        body: {
            payment_method_id: resolveMethodId(params.method),
            cartTotal:         params.amount,
            currency:          params.currency,
            customer: { first_name: firstName, last_name: lastName, email: params.coachEmail, phone: customerPhone || FALLBACK_CUSTOMER_PHONE },
            redirectionUrls:   { successUrl: params.successUrl, failUrl: params.failUrl, pendingUrl: params.pendingUrl, ...(env.FAWATERAK_WEBHOOK_URL ? { webhookUrl: env.FAWATERAK_WEBHOOK_URL } : {}) },
            cartItems:         [{ name: params.description, price: params.amount, quantity: 1 }],
            // Hosted payment page for EVERY method (wallet/Fawry too) — Fawaterak runs the method-specific
            // steps itself, like its Shopify plugin does. Without this, wallet returns a bare Meeza
            // reference/QR that we'd have to walk the customer through ourselves.
            redirectOption:    true,
            payLoad:           { payment_id: params.merchantOrderId },
        },
    });

    const invoiceId = body.data?.invoice_id;
    if (!ok || body.status !== 'success' || invoiceId == null) {
        // Full gateway detail stays in the server log — the thrown message reaches the coach's screen.
        console.error('[Fawaterak] Invoice creation failed', JSON.stringify(body));
        if (typeof body.message === 'object' && body.message?.cartTotal) {
            throw Object.assign(new Error('This amount is too low to pay online. Choose another payment method or contact support.'), { status: 400 });
        }
        throw Object.assign(new Error('The payment service could not start this payment. Please try again or choose another payment method.'), { status: 502 });
    }

    const paymentData = body.data?.payment_data ?? {};
    const referenceCode = paymentData.fawryCode ?? paymentData.meezaReference ?? paymentData.amanCode ?? paymentData.masaryCode;
    if (!paymentData.redirectTo && referenceCode == null) {
        console.error('[Fawaterak] No payment channel returned', JSON.stringify(body));
        throw Object.assign(new Error('The payment service could not start this payment. Please try again or choose another payment method.'), { status: 502 });
    }

    return {
        orderId:       String(invoiceId),
        paymentUrl:    paymentData.redirectTo,
        referenceCode: paymentData.redirectTo || referenceCode == null ? undefined : String(referenceCode),
        // Meeza wallets: an EMV-QR text payload the customer scans in their wallet app.
        qrPayload:     paymentData.meezaQrCode,
    };
}

export type InvoiceOutcome = 'paid' | 'failed' | 'pending';

/** Polled while a checkout is in flight. 'failed' means every attempt on the invoice failed
 *  (a customer can retry on the hosted page, so one failed attempt among others isn't enough).
 *  Returns null (keep waiting for the webhook) on any lookup failure rather than throwing. */
export async function getInvoiceOutcome(invoiceId: string): Promise<InvoiceOutcome | null> {
    try {
        const { ok, body } = await fawaterakRequest<{ data?: { paid?: number | string | boolean; invoice_transactions?: { status?: string }[] } }>(
            `/getInvoiceData/${encodeURIComponent(invoiceId)}`, { method: 'GET' }
        );
        const invoice = body.data;
        if (!ok || invoice?.paid === undefined) return null;
        if (invoice.paid === 1 || invoice.paid === '1' || invoice.paid === true) return 'paid';

        const attempts = invoice.invoice_transactions ?? [];
        const allFailed = attempts.length > 0 && attempts.every(attempt => String(attempt.status).toLowerCase() === 'failed');
        return allFailed ? 'failed' : 'pending';
    } catch {
        return null;
    }
}

function safeEqualHex(expectedHex: string, providedHex: string | undefined): boolean {
    if (!providedHex) return false;
    const expected = Buffer.from(expectedHex, 'hex');
    const provided = Buffer.from(providedHex, 'hex');
    return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

function hmacSha256Hex(message: string): string {
    return crypto.createHmac('sha256', env.FAWATERAK_VENDOR_KEY).update(message).digest('hex');
}

/** Paid and failed webhooks: HMAC-SHA256 of InvoiceId/InvoiceKey/PaymentMethod with the vendor key. */
export function verifyInvoiceWebhookHash(payload: { invoice_id?: unknown; invoice_key?: unknown; payment_method?: unknown; hashKey?: unknown }): boolean {
    if (!env.FAWATERAK_VENDOR_KEY || typeof payload.hashKey !== 'string') return false;
    const message = `InvoiceId=${payload.invoice_id}&InvoiceKey=${payload.invoice_key}&PaymentMethod=${payload.payment_method}`;
    return safeEqualHex(hmacSha256Hex(message), payload.hashKey);
}

/** Cancelled webhooks (Fawry/Aman/Masary code expired) use a different string. */
export function verifyCancelWebhookHash(payload: { referenceId?: unknown; paymentMethod?: unknown; hashKey?: unknown }): boolean {
    if (!env.FAWATERAK_VENDOR_KEY || typeof payload.hashKey !== 'string') return false;
    const message = `referenceId=${payload.referenceId}&PaymentMethod=${payload.paymentMethod}`;
    return safeEqualHex(hmacSha256Hex(message), payload.hashKey);
}
