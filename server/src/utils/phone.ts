const EGYPT_COUNTRY_CODE = '20';
const MIN_PHONE_DIGITS = 8;
// E.164 allows at most 15 digits; longer values are typos (e.g. a key held down).
const MAX_PHONE_DIGITS = 15;

export interface WhatsAppContact {
    /** Digits only, with country code — what wa.me expects. null when there is nothing usable. */
    whatsappNumber: string | null;
    /** True when a number exists but looks mistyped, so the admin should double-check it. */
    isSuspicious: boolean;
}

// Coaches type their number in the checkout wizard with a country-code picker, so most values are
// already "+<country><number>". A bare Egyptian local number (01xxxxxxxxx) is the one common
// exception worth repairing; anything else we can't vouch for is flagged rather than guessed.
export function toWhatsAppContact(rawPhone: string | null | undefined): WhatsAppContact {
    if (!rawPhone || !rawPhone.trim()) return { whatsappNumber: null, isSuspicious: false };

    let digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^01\d{9}$/.test(digits)) digits = `${EGYPT_COUNTRY_CODE}${digits.slice(1)}`;

    const isValidLength = digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
    return { whatsappNumber: digits || null, isSuspicious: !isValidLength };
}
