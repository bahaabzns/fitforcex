/**
 * Creates an invoice on Fawaterak.
 * Returns { invoiceId: string, paymentUrl: string }
 */
async function createInvoice({ coachName, coachEmail, coachPhone, amount, description, referenceId, successUrl, failureUrl }) {
    const BASE_URL = process.env.FAWATERAK_BASE_URL;
    const API_KEY  = process.env.FAWATERAK_SECRET_KEY || process.env.FAWATERAK_API_KEY;

    const firstName = coachName.split(' ')[0] || coachName;
    const lastName  = coachName.split(' ').slice(1).join(' ') || '-';

    const payload = {
        token: API_KEY,
        payment_method_id: 1,
        cartTotal: amount,
        currency: 'EGP',
        customer: {
            first_name: firstName,
            last_name:  lastName,
            email:      coachEmail,
            phone:      coachPhone || '01000000000',
        },
        redirectionUrls: {
            successUrl,
            failUrl: failureUrl,
        },
        cartItems: [
            { name: description, price: amount, quantity: 1 },
        ],
        metaData: {
            reference_id: String(referenceId),
        },
    };

    const response = await fetch(`${BASE_URL}/invoice/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (!response.ok || data?.status !== 'success') {
        throw Object.assign(
            new Error(`Fawaterak invoice creation failed: ${JSON.stringify(data)}`),
            { status: 502 }
        );
    }

    return {
        invoiceId:  String(data.data.invoiceId),
        paymentUrl: data.data.url,
    };
}

/**
 * Fetches the current status of an invoice directly from Fawaterak.
 * Used as a fallback when the webhook hasn't arrived yet.
 */
async function getInvoiceStatus(invoiceId) {
    const BASE_URL = process.env.FAWATERAK_BASE_URL;
    const API_KEY  = process.env.FAWATERAK_SECRET_KEY || process.env.FAWATERAK_API_KEY;

    const response = await fetch(`${BASE_URL}/invoices/${invoiceId}`, {
        headers: { token: API_KEY },
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.data ?? null;
}

module.exports = { createInvoice, getInvoiceStatus };
