import {
    isHexColor, contrastRatio, pickForeground, colorWarnings, normalizeBannerLink,
} from '../../src/modules/branding/branding.service';
import { sanitizeCapabilities, isCapabilityKey } from '../../src/lib/planCapabilities';

describe('branding colors', () => {
    test('accepts only #RRGGBB hex', () => {
        expect(isHexColor('#159bff')).toBe(true);
        expect(isHexColor('#159BFF')).toBe(true);
        expect(isHexColor('159bff')).toBe(false);
        expect(isHexColor('#fff')).toBe(false);
        expect(isHexColor('red; background:url(x)')).toBe(false);
        expect(isHexColor(null)).toBe(false);
    });

    test('contrast ratio of black on white is 21', () => {
        expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    });

    test('picks white text on dark colors and black on light colors', () => {
        expect(pickForeground('#0b1f3a')).toBe('#ffffff');
        expect(pickForeground('#ffe600')).toBe('#000000');
    });

    test('warns when a color is near-white (invisible on a light background)', () => {
        expect(colorWarnings('#fafafa')).toContain('low_contrast_on_light_background');
    });

    test('warns when a color is near-black (invisible on a dark background)', () => {
        expect(colorWarnings('#0a0a0a')).toContain('low_contrast_on_dark_background');
    });

    test('has no warnings for a readable brand blue, and none when unset', () => {
        expect(colorWarnings('#2563eb')).toEqual([]);
        expect(colorWarnings(null)).toEqual([]);
    });
});

describe('banner links', () => {
    test('allows https URLs and internal portal paths', () => {
        expect(normalizeBannerLink('https://example.com/offer')).toBe('https://example.com/offer');
        expect(normalizeBannerLink('/portal/forms')).toBe('/portal/forms');
    });

    test('treats empty or missing as no link', () => {
        expect(normalizeBannerLink('')).toBeNull();
        expect(normalizeBannerLink('   ')).toBeNull();
        expect(normalizeBannerLink(undefined)).toBeNull();
    });

    test.each([
        'javascript:alert(1)',
        'http://example.com',
        'data:text/html;base64,AAAA',
        '//evil.example.com',
        '/admin/users',
        '/portal/../admin',
        'not a url',
    ])('rejects %s', (value) => {
        expect(normalizeBannerLink(value)).toBe('invalid');
    });
});

describe('plan capabilities', () => {
    test('keeps only registered keys with boolean values', () => {
        expect(sanitizeCapabilities({ custom_branding: true, bogus: true, other: 'yes' })).toEqual({ custom_branding: true });
        expect(sanitizeCapabilities({ custom_branding: 'true' })).toEqual({});
    });

    test('tolerates non-object input', () => {
        expect(sanitizeCapabilities(null)).toEqual({});
        expect(sanitizeCapabilities([true])).toEqual({});
        expect(sanitizeCapabilities('x')).toEqual({});
    });

    test('registry lookup', () => {
        expect(isCapabilityKey('custom_branding')).toBe(true);
        expect(isCapabilityKey('nope')).toBe(false);
    });
});
