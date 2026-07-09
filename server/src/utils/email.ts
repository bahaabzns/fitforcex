/**
 * Normalizes an email for auth lookups and storage: trims surrounding
 * whitespace and lowercases. Use this on every value going into a new row.
 *
 * Existing rows may still hold mixed-case emails from before this rule
 * existed, so lookups additionally compare with Prisma's `mode: 'insensitive'`
 * (or `LOWER()` in raw SQL) rather than relying on stored case alone — no
 * backfill/migration required.
 */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}
