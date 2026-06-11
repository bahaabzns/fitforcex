import { isAllowedOrigin } from '../../src/lib/cors';
import { env } from '../../src/config/env';

describe('isAllowedOrigin', () => {
    test('allows empty origin (same-origin / non-browser clients)', () => {
        expect(isAllowedOrigin(undefined)).toBe(true);
        expect(isAllowedOrigin('')).toBe(true);
    });

    test('allows an explicit entry from ALLOWED_ORIGINS', () => {
        // ARRANGE — take a configured origin straight from env
        const configured = env.ALLOWED_ORIGINS[0];
        // ACT + ASSERT
        expect(isAllowedOrigin(configured)).toBe(true);
    });

    test('allows the root domain itself', () => {
        expect(isAllowedOrigin(`https://${env.ROOT_DOMAIN}`)).toBe(true);
    });

    test('allows a workspace subdomain of the root domain', () => {
        expect(isAllowedOrigin(`https://acme.${env.ROOT_DOMAIN}`)).toBe(true);
    });

    test('allows a workspace subdomain with a port (dev)', () => {
        expect(isAllowedOrigin(`http://acme.${env.ROOT_DOMAIN}:3000`)).toBe(true);
    });

    test('rejects an unrelated domain', () => {
        expect(isAllowedOrigin('https://evil.com')).toBe(false);
    });

    test('rejects a domain that merely ends with the root as a substring (suffix spoof)', () => {
        // notlocalhost ends with "localhost" but NOT with ".localhost", so it must be rejected.
        expect(isAllowedOrigin(`https://not${env.ROOT_DOMAIN}`)).toBe(false);
    });

    test('rejects the root domain used as a subdomain of an attacker domain', () => {
        expect(isAllowedOrigin(`https://${env.ROOT_DOMAIN}.evil.com`)).toBe(false);
    });

    test('rejects a malformed origin string', () => {
        expect(isAllowedOrigin('not a url')).toBe(false);
    });
});
