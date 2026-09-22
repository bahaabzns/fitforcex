import crypto from 'crypto';

describe('sendMetaEvent', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.resetModules();
    });

    test('no-ops without calling fetch when Meta credentials are unset', async () => {
        // ARRANGE — mocked explicitly rather than relying on ambient env: dotenv/config
        // pulls in the real (gitignored) server/.env underneath .env.test, so this must
        // not depend on that file happening to leave these blank.
        jest.resetModules();
        jest.doMock('../../src/config/env', () => ({
            env: { META_PIXEL_ID: '', META_CONVERSIONS_API_TOKEN: '', META_TEST_EVENT_CODE: '' },
        }));
        const fetchSpy = jest.fn();
        global.fetch = fetchSpy as unknown as typeof fetch;
        const { sendMetaEvent } = require('../../src/lib/metaConversions');

        // ACT
        await sendMetaEvent({
            eventName: 'CompleteRegistration', eventId: 'evt-1', actionSource: 'website', email: 'coach@example.com',
        });

        // ASSERT
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('sends a lowercase-trimmed SHA-256 hash of email/phone when configured', async () => {
        // ARRANGE
        jest.resetModules();
        jest.doMock('../../src/config/env', () => ({
            env: { META_PIXEL_ID: '123456', META_CONVERSIONS_API_TOKEN: 'test-token', META_TEST_EVENT_CODE: '' },
        }));
        const fetchSpy = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
        global.fetch = fetchSpy as unknown as typeof fetch;
        const { sendMetaEvent } = require('../../src/lib/metaConversions');

        const expectedEmailHash = crypto.createHash('sha256').update('coach@example.com').digest('hex');
        const expectedPhoneHash = crypto.createHash('sha256').update('201234567890').digest('hex');

        // ACT
        await sendMetaEvent({
            eventName: 'Purchase', eventId: 'evt-2', actionSource: 'system_generated',
            email: '  Coach@Example.com  ', phone: '+20 123 456 7890',
            customData: { value: 499, currency: 'EGP' },
        });

        // ASSERT
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, options] = fetchSpy.mock.calls[0];
        expect(url).toContain('/123456/events');
        const body = JSON.parse(options.body);
        expect(body.data[0].event_name).toBe('Purchase');
        expect(body.data[0].user_data.em).toEqual([expectedEmailHash]);
        expect(body.data[0].user_data.ph).toEqual([expectedPhoneHash]);
        expect(body.data[0].custom_data).toEqual({ value: 499, currency: 'EGP' });
    });
});
