import { normalizeSlug, cookieOptions } from '../../src/modules/auth/auth.service';
import { env } from '../../src/config/env';

describe('normalizeSlug', () => {
    test('lowercases and replaces spaces with hyphens', () => {
        expect(normalizeSlug('My Workspace')).toBe('my-workspace');
    });

    test('strips leading and trailing hyphens', () => {
        expect(normalizeSlug('--test--')).toBe('test');
    });

    test('collapses multiple special characters into one hyphen', () => {
        expect(normalizeSlug('hello   world!!!')).toBe('hello-world');
    });

    test('handles numeric input', () => {
        expect(normalizeSlug('Coach123')).toBe('coach123');
    });

    test('returns empty string for all-special input', () => {
        expect(normalizeSlug('---')).toBe('');
    });
});

describe('cookieOptions', () => {
    test('is always httpOnly', () => {
        expect(cookieOptions().httpOnly).toBe(true);
    });

    test('sameSite is strict', () => {
        expect(cookieOptions().sameSite).toBe('strict');
    });

    // env.NODE_ENV is captured at module load time from process.env.NODE_ENV.
    // In the test environment (NODE_ENV=test), secure is false.
    test('secure matches production check for current environment', () => {
        expect(cookieOptions().secure).toBe(env.NODE_ENV === 'production');
    });

    test('expires in 7 days', () => {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        expect(cookieOptions().maxAge).toBe(sevenDaysMs);
    });
});
