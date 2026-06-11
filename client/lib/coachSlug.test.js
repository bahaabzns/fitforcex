import { describe, test, expect } from 'vitest';
import { getCoachSlugFromHost, buildPortalUrlFromParts } from './coachSlug';

describe('getCoachSlugFromHost', () => {
    test('returns the subdomain label as the slug', () => {
        expect(getCoachSlugFromHost('acme.fitforce.io', 'fitforce.io')).toBe('acme');
    });

    test('returns null for the bare root domain', () => {
        expect(getCoachSlugFromHost('fitforce.io', 'fitforce.io')).toBeNull();
    });

    test('treats www as not a tenant', () => {
        expect(getCoachSlugFromHost('www.fitforce.io', 'fitforce.io')).toBeNull();
    });

    test('works for *.localhost in development', () => {
        expect(getCoachSlugFromHost('acme.localhost', 'localhost')).toBe('acme');
    });

    test('returns null for bare localhost', () => {
        expect(getCoachSlugFromHost('localhost', 'localhost')).toBeNull();
    });

    test('strips a port before resolving', () => {
        expect(getCoachSlugFromHost('acme.fitforce.io:3000', 'fitforce.io')).toBe('acme');
    });

    test('rejects an unrelated domain', () => {
        expect(getCoachSlugFromHost('evil.com', 'fitforce.io')).toBeNull();
    });

    test('rejects nested subdomains (no single slug)', () => {
        expect(getCoachSlugFromHost('a.b.fitforce.io', 'fitforce.io')).toBeNull();
    });

    test('returns null for empty or missing input', () => {
        expect(getCoachSlugFromHost('', 'fitforce.io')).toBeNull();
        expect(getCoachSlugFromHost('acme.fitforce.io', '')).toBeNull();
    });
});

describe('buildPortalUrlFromParts', () => {
    test('builds the production URL (https, no port)', () => {
        expect(buildPortalUrlFromParts('pola', 'fitforce.io', 'https:', '')).toBe(
            'https://pola.fitforce.io/portal'
        );
    });

    test('builds the dev URL (http, with port)', () => {
        expect(buildPortalUrlFromParts('pola', 'lvh.me', 'http:', '3000')).toBe(
            'http://pola.lvh.me:3000/portal'
        );
    });

    test('returns empty string when slug or root domain is missing', () => {
        expect(buildPortalUrlFromParts('', 'fitforce.io', 'https:', '')).toBe('');
        expect(buildPortalUrlFromParts('pola', '', 'https:', '')).toBe('');
    });
});
