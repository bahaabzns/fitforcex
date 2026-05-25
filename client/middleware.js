import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
    locales: ['en', 'ar'],
    defaultLocale: 'en',
    localeDetection: false, // locale is controlled by cookie only, not Accept-Language
});

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
