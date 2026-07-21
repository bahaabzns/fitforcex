// Must be imported before any other module (server.ts does this as its very
// first line) — Sentry's Node SDK instruments express/http/prisma/etc. via
// require-in-the-middle hooks that only attach if Sentry.init() runs before
// those modules are first required. Initializing late (as app.ts used to,
// after express/cors/prisma were already imported) leaves those modules
// uninstrumented, which is a documented cause of spans that never close.
import * as Sentry from '@sentry/node';
import { env } from './config/env';

Sentry.init({
    dsn:              env.SENTRY_DSN,
    environment:      env.NODE_ENV,
    release:          process.env.npm_package_version,
    enabled:          !!env.SENTRY_DSN,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
