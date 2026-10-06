import crypto from 'crypto';
import { env } from '../../src/config/env';
import { createCheckout, getInvoiceOutcome, verifyInvoiceWebhookHash, verifyCancelWebhookHash } from '../../src/lib/fawaterak';

const VENDOR_KEY = 'test-vendor-key';

function sign(message: string): string {
    return crypto.createHmac('sha256', VENDOR_KEY).update(message).digest('hex');
}

describe('fawaterak webhook hashes', () => {
    beforeAll(() => { (env as { FAWATERAK_VENDOR_KEY: string }).FAWATERAK_VENDOR_KEY = VENDOR_KEY; });

    const paid = { invoice_id: 1001, invoice_key: 'abc', payment_method: 'Visa-Mastercard' };

    test('accepts a correctly signed paid/failed payload', () => {
        const hashKey = sign('InvoiceId=1001&InvoiceKey=abc&PaymentMethod=Visa-Mastercard');
        expect(verifyInvoiceWebhookHash({ ...paid, hashKey })).toBe(true);
    });

    test('rejects a tampered invoice id', () => {
        const hashKey = sign('InvoiceId=1001&InvoiceKey=abc&PaymentMethod=Visa-Mastercard');
        expect(verifyInvoiceWebhookHash({ ...paid, invoice_id: 1002, hashKey })).toBe(false);
    });

    test('rejects a missing or malformed hashKey', () => {
        expect(verifyInvoiceWebhookHash(paid)).toBe(false);
        expect(verifyInvoiceWebhookHash({ ...paid, hashKey: 'zz' })).toBe(false);
    });

    test('verifies cancel webhooks with their own string', () => {
        const hashKey = sign('referenceId=77&PaymentMethod=Fawry');
        expect(verifyCancelWebhookHash({ referenceId: 77, paymentMethod: 'Fawry', hashKey })).toBe(true);
        expect(verifyCancelWebhookHash({ referenceId: 78, paymentMethod: 'Fawry', hashKey })).toBe(false);
    });
});

describe('fawaterak createCheckout', () => {
    const base = {
        amount: 1000, currency: 'EGP', merchantOrderId: 'pay_1', description: 'FitForce Pro',
        coachName: 'Sara Ali', coachEmail: 's@x.com', successUrl: 's', failUrl: 'f', pendingUrl: 'p',
    };

    beforeEach(() => {
        Object.assign(env, { FAWATERAK_API_TOKEN: 'tok', FAWATERAK_METHOD_ID_CARD: '2', FAWATERAK_METHOD_ID_WALLET: '4', FAWATERAK_METHOD_ID_FAWRY: '3' });
    });
    afterEach(() => { jest.restoreAllMocks(); });

    function mockFetch(data: unknown) {
        return jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data }) } as Response);
    }

    test('card returns the hosted URL and sends our payment id in payLoad', async () => {
        const spy = mockFetch({ invoice_id: 55, invoice_key: 'k', payment_data: { redirectTo: 'https://pay/x' } });
        const result = await createCheckout({ ...base, method: 'card' });
        expect(result).toEqual({ orderId: '55', paymentUrl: 'https://pay/x', referenceCode: undefined });
        const sent = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
        expect(sent.payment_method_id).toBe(2);
        expect(sent.payLoad).toEqual({ payment_id: 'pay_1' });
        expect(sent.redirectOption).toBe(true);
    });

    test('fawry returns the cash reference code', async () => {
        mockFetch({ invoice_id: 56, payment_data: { fawryCode: 998877 } });
        const result = await createCheckout({ ...base, method: 'fawry' });
        expect(result.referenceCode).toBe('998877');
        expect(result.paymentUrl).toBeUndefined();
    });

    test('wallet sends the wallet number as the customer phone', async () => {
        const spy = mockFetch({ invoice_id: 57, payment_data: { redirectTo: 'https://pay/w' } });
        await createCheckout({ ...base, method: 'wallet', walletPhoneNumber: '01012345678' });
        const sent = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
        expect(sent.customer.phone).toBe('01012345678');
    });

    test('throws a 502 when the gateway returns no payment channel', async () => {
        mockFetch({ invoice_id: 58, payment_data: {} });
        await expect(createCheckout({ ...base, method: 'card' })).rejects.toMatchObject({ status: 502 });
    });

    test('throws a 400 when the method id is not configured', async () => {
        Object.assign(env, { FAWATERAK_METHOD_ID_FAWRY: '' });
        await expect(createCheckout({ ...base, method: 'fawry' })).rejects.toMatchObject({ status: 400 });
    });
});

describe('fawaterak getInvoiceOutcome', () => {
    beforeEach(() => { Object.assign(env, { FAWATERAK_API_TOKEN: 'tok' }); });
    afterEach(() => { jest.restoreAllMocks(); });

    function mockInvoice(data: unknown, ok = true) {
        jest.spyOn(global, 'fetch').mockResolvedValue({ ok, json: async () => ({ status: 'success', data }) } as Response);
    }

    test('paid when the invoice is paid', async () => {
        mockInvoice({ paid: 1, invoice_transactions: [{ status: 'paid' }] });
        expect(await getInvoiceOutcome('1')).toBe('paid');
    });

    test('failed when every attempt failed', async () => {
        mockInvoice({ paid: 0, invoice_transactions: [{ status: 'failed' }, { status: 'Failed' }] });
        expect(await getInvoiceOutcome('1')).toBe('failed');
    });

    test('pending when an attempt is still unpaid or there are no attempts', async () => {
        mockInvoice({ paid: 0, invoice_transactions: [{ status: 'failed' }, { status: 'Unpaid' }] });
        expect(await getInvoiceOutcome('1')).toBe('pending');
        mockInvoice({ paid: 0, invoice_transactions: [] });
        expect(await getInvoiceOutcome('1')).toBe('pending');
    });

    test('null when the lookup fails', async () => {
        jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network'));
        expect(await getInvoiceOutcome('1')).toBeNull();
    });
});

describe('fawaterak wallet checkout', () => {
    afterEach(() => { jest.restoreAllMocks(); });

    test('returns the Meeza QR payload alongside the reference', async () => {
        Object.assign(env, { FAWATERAK_API_TOKEN: 'tok', FAWATERAK_METHOD_ID_WALLET: '4' });
        jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: { invoice_id: 9, payment_data: { meezaReference: 141414488, meezaQrCode: '0002010102' } } }) } as Response);
        const result = await createCheckout({
            method: 'wallet', walletPhoneNumber: '01012345678', amount: 10, currency: 'EGP', merchantOrderId: 'p', description: 'd',
            coachName: 'A B', coachEmail: 'a@b.c', successUrl: 's', failUrl: 'f', pendingUrl: 'p',
        });
        expect(result).toMatchObject({ referenceCode: '141414488', qrPayload: '0002010102' });
    });
});

describe('fawaterak createCheckout error handling', () => {
    const base = {
        amount: 0, currency: 'EGP', merchantOrderId: 'p', description: 'd', coachName: 'A B', coachEmail: 'a@b.c',
        successUrl: 's', failUrl: 'f', pendingUrl: 'p',
    };

    beforeEach(() => { Object.assign(env, { FAWATERAK_API_TOKEN: 'tok', FAWATERAK_METHOD_ID_CARD: '2' }); });
    afterEach(() => { jest.restoreAllMocks(); });

    test('maps a cartTotal validation error to a clean 400 without leaking gateway detail', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({ status: 'error', message: { cartTotal: ['Amount must be bigger than 5 EGP'] } }) } as Response);
        const failure = createCheckout({ ...base, method: 'card' });
        await expect(failure).rejects.toMatchObject({ status: 400 });
        await expect(failure).rejects.not.toThrow(/Fawaterak|cartTotal|5 EGP/);
    });

    test('any other gateway failure is a generic 502', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({ status: 'error', message: { token: ['Invalid Token'] } }) } as Response);
        const failure = createCheckout({ ...base, method: 'card' });
        await expect(failure).rejects.toMatchObject({ status: 502 });
        await expect(failure).rejects.not.toThrow(/Token/);
    });
});
