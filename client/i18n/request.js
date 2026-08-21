import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

const VALID_LOCALES = ['en', 'ar'];

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

    // No cookie yet — middleware.js flags the landing page and the checkout/signup wizard to
    // default to Arabic there; every other route keeps the app-wide English default below.
    const headerStore = await headers();
    const pathDefault = headerStore.get('x-default-locale');
    const locale = VALID_LOCALES.includes(pathDefault) ? pathDefault : 'en';

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
