import { env } from '../config/env';

/**
 * Decides whether a browser Origin may call the API.
 *
 * Allowed when the origin is one of:
 *   - empty (same-origin requests and non-browser clients send no Origin header)
 *   - an explicit entry in ALLOWED_ORIGINS
 *   - the root domain itself (e.g. fitforce.io)
 *   - any workspace subdomain of the root domain (e.g. acme.fitforce.io)
 *
 * The root domain is 'localhost' in dev, so *.localhost portals pass too.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return true;

    if (env.ALLOWED_ORIGINS.includes(origin)) return true;

    let hostname: string;
    try {
        hostname = new URL(origin).hostname;
    } catch {
        // Malformed Origin header — reject rather than guess.
        return false;
    }

    // In development, allow any localhost port (covers Flutter web, Expo, etc.).
    if (env.NODE_ENV === 'development' && hostname === 'localhost') return true;

    const roots = [env.ROOT_DOMAIN, ...env.LEGACY_ROOT_DOMAINS];
    return roots.some(root => hostname === root || hostname.endsWith(`.${root}`));
}
