import crypto from 'crypto';
import { env } from '../config/env';

// Paymob Accept API. Replaces lib/fawaterak.ts — unlike Fawaterak's static
// per-plan payment link, every Paymob checkout is a fresh, server-created order
// for the exact amount computed at request time (auth token → order → payment
// key → iframe [card] or wallet-pay [wallet]). See docs/billing-architecture-audit.md
// for why the old static-link design was a problem this naturally avoids.
//
// NOTE: the exact request/response field names below reflect Paymob's Accept API
// as documented at integration time. Paymob's docs are the source of truth —
// re-verify field names/endpoints against https://developers.paymob.com/egypt
// before going live, especially the webhook HMAC field order in verifyWebhookHmac
// and the transaction-inquiry shape in getTransactionStatus.

type BillingData = {
    firstName:  string;
    lastName:   string;
    email:      string;
    phone:      string;
};

interface CheckoutParams {
    amount:          number; // major currency units (e.g. EGP), converted to cents internally
    currency:        string;
    merchantOrderId: string; // our own workspace_payments.id — how we find the row again later
    coachName:       string;
    coachEmail:      string;
    coachPhone?:     string;
}

interface WalletCheckoutParams extends CheckoutParams {
    walletPhoneNumber: string;
}

// Auth tokens are short-lived (~1hr per Paymob's docs) — cache in-memory rather than
// re-authenticating on every request. Module-level singleton, fine for a single-instance
// server (same ceiling as the in-process schedulers documented in CLAUDE.md §11).
let cachedToken: { token: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 50 * 60 * 1000; // refresh a bit before Paymob's real ~1hr expiry

async function getAuthToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

    if (!env.PAYMOB_API_KEY) {
        throw Object.assign(new Error('Paymob is not configured (PAYMOB_API_KEY missing). Contact support.'), { status: 400 });
    }

    const response = await fetch(`${env.PAYMOB_BASE_URL}/api/auth/tokens`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ api_key: env.PAYMOB_API_KEY }),
        signal:  AbortSignal.timeout(15000),
    });
    const data = await response.json() as { token?: string };
    if (!response.ok || !data.token) {
        throw Object.assign(new Error(`Paymob auth failed: ${JSON.stringify(data)}`), { status: 502 });
    }

    cachedToken = { token: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
    return data.token;
}

async function createOrder(authToken: string, amountCents: number, currency: string, merchantOrderId: string): Promise<string> {
    const response = await fetch(`${env.PAYMOB_BASE_URL}/api/ecommerce/orders`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            auth_token:        authToken,
            delivery_needed:   false,
            amount_cents:      amountCents,
            currency,
            merchant_order_id: merchantOrderId,
            items:             [],
        }),
        signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as { id?: number; message?: string };
    if (!response.ok || data.id == null) {
        throw Object.assign(new Error(`Paymob order creation failed: ${JSON.stringify(data)}`), { status: 502 });
    }
    return String(data.id);
}

async function createPaymentKey(
    authToken: string, amountCents: number, orderId: string, currency: string,
    integrationId: string, billingData: BillingData
): Promise<string> {
    if (!integrationId) {
        throw Object.assign(new Error('Paymob is not configured for this payment method. Contact support.'), { status: 400 });
    }
    const response = await fetch(`${env.PAYMOB_BASE_URL}/api/acceptance/payment_keys`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            auth_token:     authToken,
            amount_cents:   amountCents,
            expiration:     3600,
            order_id:       orderId,
            currency,
            integration_id: integrationId,
            billing_data: {
                first_name:   billingData.firstName,
                last_name:    billingData.lastName || '-',
                email:        billingData.email,
                phone_number: billingData.phone,
                // Paymob requires these fields present even when nothing meaningful applies —
                // "NA" is Paymob's own documented placeholder convention.
                city: 'NA', country: 'NA', street: 'NA', building: 'NA',
                floor: 'NA', apartment: 'NA', state: 'NA', postal_code: 'NA',
            },
        }),
        signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as { token?: string; message?: string };
    if (!response.ok || !data.token) {
        throw Object.assign(new Error(`Paymob payment key request failed: ${JSON.stringify(data)}`), { status: 502 });
    }
    return data.token;
}

function toBillingData(coachName: string, coachEmail: string, coachPhone?: string): BillingData {
    const firstName = coachName.split(' ')[0] || coachName;
    const lastName  = coachName.split(' ').slice(1).join(' ');
    return { firstName, lastName, email: coachEmail, phone: coachPhone || '01000000000' };
}

/** Card checkout: auth → order → payment key → iframe URL. The frontend embeds `iframeUrl`
 *  in an overlay exactly like the old Fawaterak flow did. */
export async function createCardCheckout(params: CheckoutParams): Promise<{ orderId: string; iframeUrl: string }> {
    const authToken    = await getAuthToken();
    const amountCents  = Math.round(params.amount * 100);
    const orderId      = await createOrder(authToken, amountCents, params.currency, params.merchantOrderId);
    const paymentToken = await createPaymentKey(
        authToken, amountCents, orderId, params.currency,
        env.PAYMOB_INTEGRATION_ID_CARD, toBillingData(params.coachName, params.coachEmail, params.coachPhone)
    );
    return { orderId, iframeUrl: `${env.PAYMOB_BASE_URL}/api/acceptance/iframes/${env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}` };
}

/** Wallet checkout: same order/payment-key steps, then Paymob's wallet-pay endpoint returns a
 *  redirect URL (the customer's carrier OTP page) instead of an iframe token — wallet OTP pages
 *  generally refuse to render inside an iframe, so the frontend must open this as a top-level
 *  redirect, not an overlay (see settings/subscription and checkout page notes). */
export async function createWalletCheckout(params: WalletCheckoutParams): Promise<{ orderId: string; redirectUrl: string }> {
    const authToken    = await getAuthToken();
    const amountCents  = Math.round(params.amount * 100);
    const orderId      = await createOrder(authToken, amountCents, params.currency, params.merchantOrderId);
    const paymentToken = await createPaymentKey(
        authToken, amountCents, orderId, params.currency,
        env.PAYMOB_INTEGRATION_ID_WALLET, toBillingData(params.coachName, params.coachEmail, params.coachPhone)
    );

    const response = await fetch(`${env.PAYMOB_BASE_URL}/api/acceptance/payments/pay`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            source: { identifier: params.walletPhoneNumber, subtype: 'WALLET' },
            payment_token: paymentToken,
        }),
        signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as { redirect_url?: string; iframe_redirection_url?: string; message?: string };
    const redirectUrl = data.redirect_url || data.iframe_redirection_url;
    if (!response.ok || !redirectUrl) {
        throw Object.assign(new Error(`Paymob wallet payment failed: ${JSON.stringify(data)}`), { status: 502 });
    }
    return { orderId, redirectUrl };
}

/** Fawry checkout: same order/payment-key steps, then Paymob's pay endpoint (called with an
 *  "AGGREGATOR" source instead of a card/wallet one) returns a cash-payment reference number
 *  instead of a URL — the customer takes this to any Fawry outlet and pays in cash, no
 *  redirect/iframe at all. Field name/shape here ("bill_reference" nested under a Fawry-specific
 *  response key) is the least-certain part of this file — verify against a live Paymob sandbox
 *  transaction before relying on it (see DEBT.md). */
export async function createFawryCheckout(params: CheckoutParams): Promise<{ orderId: string; referenceCode: string }> {
    const authToken    = await getAuthToken();
    const amountCents  = Math.round(params.amount * 100);
    const orderId      = await createOrder(authToken, amountCents, params.currency, params.merchantOrderId);
    const paymentToken = await createPaymentKey(
        authToken, amountCents, orderId, params.currency,
        env.PAYMOB_INTEGRATION_ID_FAWRY, toBillingData(params.coachName, params.coachEmail, params.coachPhone)
    );

    const response = await fetch(`${env.PAYMOB_BASE_URL}/api/acceptance/payments/pay`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            source: { identifier: 'FAWRY', subtype: 'AGGREGATOR' },
            payment_token: paymentToken,
        }),
        signal: AbortSignal.timeout(15000),
    });
    const data = await response.json() as { bill_reference?: string | number; data?: { bill_reference?: string | number }; message?: string };
    const referenceCode = data.bill_reference ?? data.data?.bill_reference;
    if (!response.ok || referenceCode == null) {
        throw Object.assign(new Error(`Paymob Fawry payment failed: ${JSON.stringify(data)}`), { status: 502 });
    }
    return { orderId, referenceCode: String(referenceCode) };
}

/** Polled by GET /billing/payment-status/:paymentId while a checkout is in flight — mirrors
 *  the old Fawaterak getInvoiceStatus. Returns null (keep polling / webhook will arrive) on
 *  any lookup failure rather than throwing, same fallback behavior as before. */
export async function getTransactionStatus(orderId: string): Promise<{ success: boolean } | null> {
    try {
        const authToken = await getAuthToken();
        const response = await fetch(`${env.PAYMOB_BASE_URL}/api/ecommerce/orders/${orderId}?token=${authToken}`, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return null;
        const data = await response.json() as { payment_status?: string; success?: boolean };
        if (typeof data.success === 'boolean') return { success: data.success };
        if (data.payment_status) return { success: data.payment_status === 'paid' };
        return null;
    } catch {
        return null;
    }
}

/** Verifies Paymob's HMAC-SHA512 signature on both the server-to-server "Transaction Processed
 *  Callback" webhook and the browser "Transaction Response Callback" redirect — both use the
 *  same ordered-field-concatenation scheme over the transaction object, hashed with the
 *  integration's HMAC secret (found in the Paymob dashboard, separate from the API key).
 *  Field order below is Paymob's documented order at integration time — confirm unchanged
 *  against current docs before relying on this for a production cutover. */
export function verifyWebhookHmac(obj: Record<string, unknown>, hmacFromRequest: string | undefined): boolean {
    if (!env.PAYMOB_HMAC_SECRET || !hmacFromRequest) return false;

    const get = (path: string): string => {
        const value = path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object') ? (acc as Record<string, unknown>)[key] : undefined, obj);
        return value == null ? '' : String(value);
    };

    const orderedFields = [
        'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
        'id', 'integration_id', 'is_3d_secure', 'is_auction', 'is_capture', 'is_refunded',
        'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
        'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
    ];
    const concatenated = orderedFields.map(get).join('');

    const expected = crypto.createHmac('sha512', env.PAYMOB_HMAC_SECRET).update(concatenated).digest('hex');
    const expectedBuf  = Buffer.from(expected, 'hex');
    const providedBuf  = Buffer.from(hmacFromRequest, 'hex');
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
