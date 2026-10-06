import 'dotenv/config';

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required environment variable: ${key}`);
    return val;
}

export const env = {
    NODE_ENV:             process.env.NODE_ENV ?? 'development',
    PORT:                 parseInt(process.env.PORT ?? '4000', 10),
    // Bind address. Default loopback for safety; set HOST=0.0.0.0 to reach the
    // dev server from a physical device on the LAN (mobile testing).
    HOST:                 process.env.HOST ?? '127.0.0.1',

    // Auth
    JWT_SECRET:           requireEnv('JWT_SECRET'),
    ADMIN_JWT_SECRET:     process.env.ADMIN_JWT_SECRET ?? '',

    // Database
    DB_USER:              requireEnv('DB_USER'),
    DB_HOST:              requireEnv('DB_HOST'),
    DB_NAME:              requireEnv('DB_NAME'),
    DB_PASSWORD:          requireEnv('DB_PASSWORD'),
    DB_PORT:              parseInt(process.env.DB_PORT ?? '5432', 10),

    // CORS / URLs
    ALLOWED_ORIGINS:      (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
    CLIENT_URL:           process.env.CLIENT_URL ?? 'http://localhost:3000',
    SERVER_URL:           process.env.SERVER_URL ?? 'http://localhost:4000',

    // Root domain for workspace subdomains (e.g. acme.fitforce.app).
    // Dev default is 'localhost' so *.localhost subdomains pass CORS; production sets fitforce.app.
    ROOT_DOMAIN:          process.env.ROOT_DOMAIN ?? 'localhost',

    // Additional root domain(s) still allowed to call the API during a domain migration
    // (comma-separated, e.g. 'fitforce.io'). Empty by default. Drop once the old domain
    // is confirmed to have no live traffic.
    LEGACY_ROOT_DOMAINS:  (process.env.LEGACY_ROOT_DOMAINS ?? '').split(',').filter(Boolean),

    // Cookie domain — set to '.fitforce.app' in production so the auth cookie is shared
    // across my., admin., and all slug. subdomains. Empty string = host-only (dev default).
    COOKIE_DOMAIN:        process.env.COOKIE_DOMAIN ?? '',

    // Email (SMTP)
    SMTP_HOST:            process.env.SMTP_HOST ?? '',
    SMTP_PORT:            parseInt(process.env.SMTP_PORT ?? '587', 10),
    SMTP_SECURE:          process.env.SMTP_SECURE === 'true',
    SMTP_USER:            process.env.SMTP_USER ?? '',
    SMTP_PASS:            process.env.SMTP_PASS ?? '',
    SMTP_FROM:            process.env.SMTP_FROM ?? 'noreply@fitforce.app',

    // Storage (S3 / Cloudflare R2)
    S3_REGION:            process.env.S3_REGION ?? 'auto',
    S3_ENDPOINT:          process.env.S3_ENDPOINT ?? '',
    S3_ACCESS_KEY:        process.env.S3_ACCESS_KEY ?? '',
    S3_SECRET_KEY:        process.env.S3_SECRET_KEY ?? '',
    S3_BUCKET:            process.env.S3_BUCKET ?? '',
    S3_PUBLIC_URL:        process.env.S3_PUBLIC_URL ?? '',

    // Payments (Paymob Accept API) — all optional at startup (no hard requireEnv) since
    // checkout is the only thing that needs them; an unconfigured deploy should still boot
    // and serve everything else. Left blank, gateway calls fail with a clean user-facing
    // error rather than a startup crash.
    PAYMOB_API_KEY:               process.env.PAYMOB_API_KEY ?? '',
    PAYMOB_INTEGRATION_ID_CARD:   process.env.PAYMOB_INTEGRATION_ID_CARD ?? '',
    PAYMOB_INTEGRATION_ID_WALLET: process.env.PAYMOB_INTEGRATION_ID_WALLET ?? '',
    PAYMOB_INTEGRATION_ID_FAWRY:  process.env.PAYMOB_INTEGRATION_ID_FAWRY ?? '',
    PAYMOB_IFRAME_ID:             process.env.PAYMOB_IFRAME_ID ?? '',
    PAYMOB_HMAC_SECRET:           process.env.PAYMOB_HMAC_SECRET ?? '',
    PAYMOB_BASE_URL:              process.env.PAYMOB_BASE_URL ?? 'https://accept.paymob.com',

    // Fawaterak v2 API — the default gateway. PAYMENT_GATEWAY switches card/wallet/Fawry
    // checkout between 'fawaterak' and 'paymob'; manual transfer is gateway-independent.
    // Optional at startup like Paymob's: unset values fail checkout with a clean error.
    // Base URL defaults to staging so a fresh checkout can never charge real money; the
    // METHOD_ID values come from GET /api/v2/getPaymentmethods (see scripts/check-fawaterak.ts).
    PAYMENT_GATEWAY:              process.env.PAYMENT_GATEWAY === 'paymob' ? 'paymob' as const : 'fawaterak' as const,
    FAWATERAK_API_TOKEN:          process.env.FAWATERAK_API_TOKEN ?? '',
    FAWATERAK_VENDOR_KEY:         process.env.FAWATERAK_VENDOR_KEY ?? '',
    FAWATERAK_BASE_URL:           (process.env.FAWATERAK_BASE_URL ?? 'https://staging.fawaterk.com').replace(/\/+$/, ''),
    // Optional per-request webhook override (publicly reachable URL of /api/payments/webhook/fawaterak).
    // Lets a local/tunnelled server receive webhooks without editing the portal's global webhook settings.
    FAWATERAK_WEBHOOK_URL:        process.env.FAWATERAK_WEBHOOK_URL ?? '',
    FAWATERAK_METHOD_ID_CARD:     process.env.FAWATERAK_METHOD_ID_CARD ?? '',
    FAWATERAK_METHOD_ID_WALLET:   process.env.FAWATERAK_METHOD_ID_WALLET ?? '',
    FAWATERAK_METHOD_ID_FAWRY:    process.env.FAWATERAK_METHOD_ID_FAWRY ?? '',

    // Manual-transfer payment method — InstaPay/mobile wallet paid outside any gateway,
    // verified by an admin over WhatsApp within 24h (see billing.controller.ts's 'manual'
    // branch). All contact/account info a coach needs is shown from these — no admin-panel
    // settings UI for them yet; change here + redeploy if a number changes.
    INSTAPAY_HANDLE:                  process.env.INSTAPAY_HANDLE ?? '',
    WALLET_VODAFONE_CASH:             process.env.WALLET_VODAFONE_CASH ?? '',
    WALLET_ETISALAT_CASH:             process.env.WALLET_ETISALAT_CASH ?? '',
    WALLET_ORANGE_CASH:               process.env.WALLET_ORANGE_CASH ?? '',
    WALLET_WE_PAY:                    process.env.WALLET_WE_PAY ?? '',
    MANUAL_PAYMENT_BENEFICIARY_NAME:  process.env.MANUAL_PAYMENT_BENEFICIARY_NAME ?? '',
    // Same number LandingWhatsAppButton.js already hardcodes for general contact — kept as
    // its own env var (not read by the client) since payment-proof messages are built
    // server-side with plan/amount/reference details baked into the pre-filled text.
    WHATSAPP_VERIFICATION_NUMBER:     process.env.WHATSAPP_VERIFICATION_NUMBER ?? '201501233314',

    // Meta / Facebook Conversions API — same pixel ID as the client's
    // NEXT_PUBLIC_META_PIXEL_ID. Left blank, sendMetaEvent() no-ops everywhere.
    META_PIXEL_ID:                process.env.META_PIXEL_ID ?? '',
    META_CONVERSIONS_API_TOKEN:   process.env.META_CONVERSIONS_API_TOKEN ?? '',
    // Set only while testing in Meta's Events Manager "Test Events" tab.
    META_TEST_EVENT_CODE:         process.env.META_TEST_EVENT_CODE ?? '',

    // Observability
    SENTRY_DSN:           process.env.SENTRY_DSN ?? '',
} as const;

/** Misconfigurations that would break or mis-route real payments. Returned (not thrown) because
 *  a manual-transfer-only deploy is legitimate and must still boot — server.ts logs each one
 *  loudly at startup so a staging token or a localhost return URL can't reach production unseen. */
export function getPaymentConfigWarnings(): string[] {
    if (env.NODE_ENV !== 'production') return [];

    const warnings: string[] = [];
    if (env.PAYMENT_GATEWAY === 'fawaterak') {
        if (!env.FAWATERAK_API_TOKEN) warnings.push('PAYMENT_GATEWAY=fawaterak but FAWATERAK_API_TOKEN is empty — card/wallet/Fawry checkout will fail');
        if (!env.FAWATERAK_METHOD_ID_CARD || !env.FAWATERAK_METHOD_ID_WALLET || !env.FAWATERAK_METHOD_ID_FAWRY) {
            warnings.push('One or more FAWATERAK_METHOD_ID_* values are empty — those payment methods will fail');
        }
        if (env.FAWATERAK_BASE_URL.includes('staging')) warnings.push('FAWATERAK_BASE_URL points at Fawaterak STAGING in production');
    }
    if (env.PAYMENT_GATEWAY === 'paymob' && !env.PAYMOB_API_KEY) warnings.push('PAYMENT_GATEWAY=paymob but PAYMOB_API_KEY is empty');
    if (/localhost|lvh\.me|127\.0\.0\.1/.test(env.CLIENT_URL)) {
        warnings.push(`CLIENT_URL is "${env.CLIENT_URL}" — gateway return links would send coaches to a dead address`);
    }
    return warnings;
}
