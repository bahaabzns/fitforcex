// Resolves which coach/workspace a client portal request belongs to, based on the
// subdomain. e.g. on "acme.fitforce.io" the slug is "acme".

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost';

/**
 * Extracts the workspace slug from a hostname, given the root domain.
 * Pure function (no browser access) so it can be unit-tested.
 *
 * Returns the slug, or null when the host is the bare root domain, "www",
 * or anything that isn't a subdomain of the root.
 *
 * @param {string} hostname  e.g. "acme.fitforce.io" or "acme.localhost"
 * @param {string} rootDomain e.g. "fitforce.io" or "localhost"
 * @returns {string|null}
 */
export function getCoachSlugFromHost(hostname, rootDomain) {
    if (!hostname || !rootDomain) return null;

    // Drop any port: "acme.localhost:3000" -> "acme.localhost"
    const host = hostname.split(':')[0].toLowerCase();
    const root = rootDomain.split(':')[0].toLowerCase();

    if (host === root) return null;

    const suffix = `.${root}`;
    if (!host.endsWith(suffix)) return null;

    const slug = host.slice(0, -suffix.length);

    // "www" is not a tenant; treat nested labels (a.b.root) as no single slug.
    if (!slug || slug === 'www' || slug.includes('.')) return null;

    return slug;
}

/**
 * Reads the current coach slug from the browser's location.
 * Returns null on the server or when there is no tenant subdomain.
 */
export function getCoachSlug() {
    if (typeof window === 'undefined') return null;
    return getCoachSlugFromHost(window.location.hostname, ROOT_DOMAIN);
}
