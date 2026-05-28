import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

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

    // Fall back to the NEXT_LOCALE cookie (set by the language switcher)
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get('NEXT_LOCALE')?.value;
    const locale = VALID_LOCALES.includes(fromCookie) ? fromCookie : 'en';

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
