import 'dotenv/config';

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required environment variable: ${key}`);
    return val;
}

export const env = {
    NODE_ENV:             process.env.NODE_ENV ?? 'development',
    PORT:                 parseInt(process.env.PORT ?? '4000', 10),

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

    // Payments (Fawaterak)
    FAWATERAK_API_KEY:    process.env.FAWATERAK_API_KEY ?? '',
    FAWATERAK_BASE_URL:   process.env.FAWATERAK_BASE_URL ?? '',
    FAWATERAK_SECRET_KEY: process.env.FAWATERAK_SECRET_KEY ?? '',

    // Observability
    SENTRY_DSN:           process.env.SENTRY_DSN ?? '',
} as const;
