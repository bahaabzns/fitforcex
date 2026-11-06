import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const VALID_LOCALES = ['en', 'ar'];

// First-time visitors (no NEXT_LOCALE cookie yet) get Arabic everywhere: landing, signup, coach app and client portal.
const DEFAULT_LOCALE = 'ar';

export default getRequestConfig(async ({ requestLocale }) => {
    // Prefer locale set by a proxy/middleware if present
    const fromProxy = await requestLocale;
    if (VALID_LOCALES.includes(fromProxy)) {
        return {
            locale: fromProxy,
            messages: (await import(`../messages/${fromProxy}.json`)).default,
        };
    }

    // Fall back to the NEXT_LOCALE cookie (set by the language switcher) — an explicit choice
    // always wins, on every route.
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get('NEXT_LOCALE')?.value;
    if (VALID_LOCALES.includes(fromCookie)) {
        return {
            locale: fromCookie,
            messages: (await import(`../messages/${fromCookie}.json`)).default,
        };
    }

    return {
        locale: DEFAULT_LOCALE,
        messages: (await import(`../messages/${DEFAULT_LOCALE}.json`)).default,
    };
});
