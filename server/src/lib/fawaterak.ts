import { env } from '../config/env';

interface CreateInvoiceParams {
    coachName:    string;
    coachEmail:   string;
    coachPhone?:  string;
    amount:       number;
    description:  string;
    referenceId:  string | number;
    successUrl:   string;
    failureUrl:   string;
}

export async function createInvoice({
    coachName, coachEmail, coachPhone, amount, description, referenceId, successUrl, failureUrl,
}: CreateInvoiceParams): Promise<{ invoiceId: string; paymentUrl: string }> {
    const firstName = coachName.split(' ')[0] || coachName;
    const lastName  = coachName.split(' ').slice(1).join(' ') || '-';
    const apiKey    = env.FAWATERAK_SECRET_KEY || env.FAWATERAK_API_KEY;

    const payload = {
        token:             apiKey,
        payment_method_id: 1,
        cartTotal:         amount,
        currency:          'EGP',
        customer: {
            first_name: firstName,
            last_name:  lastName,
            email:      coachEmail,
            phone:      coachPhone || '01000000000',
        },
        redirectionUrls: { successUrl, failUrl: failureUrl },
        cartItems: [{ name: description, price: amount, quantity: 1 }],
        metaData:  { reference_id: String(referenceId) },
    };

    const response = await fetch(`${env.FAWATERAK_BASE_URL}/invoice/create`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(15000),
    });

    const data = await response.json() as { status: string; data: { invoiceId: string | number; url: string } };

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

export async function getInvoiceStatus(invoiceId: string): Promise<unknown> {
    const apiKey = env.FAWATERAK_SECRET_KEY || env.FAWATERAK_API_KEY;
    const response = await fetch(`${env.FAWATERAK_BASE_URL}/invoices/${invoiceId}`, {
        headers: { token: apiKey },
        signal:  AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json() as { data?: unknown };
    return data?.data ?? null;
}
