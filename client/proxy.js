import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
    locales: ['en', 'ar'],
    defaultLocale: 'en',
    localePrefix: 'never',   // locale in cookie only — no /en/ prefix in URLs
    localeDetection: false,
});

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
