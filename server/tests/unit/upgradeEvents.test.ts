import { sanitizeReturnTo, UPGRADE_SOURCES } from '../../src/modules/billing/upgradeEvents.service';

describe('sanitizeReturnTo', () => {
    const slug = 'coach-ali';

    it('keeps a relative path inside the workspace, including its query string', () => {
        expect(sanitizeReturnTo('/coach-ali/clients?add=1', slug)).toBe('/coach-ali/clients?add=1');
    });

    it('drops absolute URLs and protocol-relative hosts', () => {
        expect(sanitizeReturnTo('https://evil.com/coach-ali/x', slug)).toBeNull();
        expect(sanitizeReturnTo('//evil.com', slug)).toBeNull();
        expect(sanitizeReturnTo('/coach-ali//evil.com', slug)).toBeNull();
    });

    it('drops paths that belong to another workspace', () => {
        expect(sanitizeReturnTo('/other-coach/clients', slug)).toBeNull();
        expect(sanitizeReturnTo('/coach-alice/clients', slug)).toBeNull();
    });

    it('drops backslashes, control characters, non-strings and overlong values', () => {
        expect(sanitizeReturnTo('/coach-ali/\\evil', slug)).toBeNull();
        expect(sanitizeReturnTo('/coach-ali/a\nb', slug)).toBeNull();
        expect(sanitizeReturnTo(undefined, slug)).toBeNull();
        expect(sanitizeReturnTo(`/coach-ali/${'a'.repeat(400)}`, slug)).toBeNull();
    });

    it('drops everything when the workspace slug is unknown', () => {
        expect(sanitizeReturnTo('//dashboard', '')).toBeNull();
    });
});

describe('UPGRADE_SOURCES', () => {
    it('lists every upgrade surface the plan calls for', () => {
        expect([...UPGRADE_SOURCES].sort()).toEqual(
            ['expiry_banner', 'limit_popup', 'lock_branding', 'sidebar_meter', 'subscription_page', 'topbar']
        );
    });
});
