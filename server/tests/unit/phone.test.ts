import { toWhatsAppContact } from '../../src/utils/phone';

describe('toWhatsAppContact', () => {
    test('strips symbols from an international number', () => {
        expect(toWhatsAppContact('+20 100 123 4567')).toEqual({ whatsappNumber: '201001234567', isSuspicious: false });
    });

    test('adds the Egypt country code to a bare local number', () => {
        expect(toWhatsAppContact('01001234567')).toEqual({ whatsappNumber: '201001234567', isSuspicious: false });
    });

    test('understands a 00 international prefix', () => {
        expect(toWhatsAppContact('00966501234567').whatsappNumber).toBe('966501234567');
    });

    test('returns nothing for an empty or missing number', () => {
        expect(toWhatsAppContact(null)).toEqual({ whatsappNumber: null, isSuspicious: false });
        expect(toWhatsAppContact('   ')).toEqual({ whatsappNumber: null, isSuspicious: false });
    });

    test('flags numbers that are too long or too short instead of guessing', () => {
        expect(toWhatsAppContact('+2012321234323456543').isSuspicious).toBe(true);
        expect(toWhatsAppContact('+2010').isSuspicious).toBe(true);
    });
});
