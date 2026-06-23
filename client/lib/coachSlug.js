// Resolves which coach/workspace a client portal request belongs to, based on the
// subdomain. e.g. on "acme.fitforce.app" the slug is "acme".

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

/**
 * Builds the client portal URL for a workspace slug on its subdomain.
 * Pure function (no browser access) so it can be unit-tested.
 *
 * The protocol and port come from the current page, so this adapts to each
 * environment automatically: http + :3000 in dev, https + no port in prod.
 *
 * @param {string} slug       e.g. "pola"
 * @param {string} rootDomain e.g. "fitforce.io" or "lvh.me"
 * @param {string} protocol   e.g. "https:" (window.location.protocol)
 * @param {string} port       e.g. "3000" or "" (window.location.port)
 * @returns {string} e.g. "https://pola.fitforce.app"
 */
export function buildPortalUrlFromParts(slug, rootDomain, protocol, port) {
    if (!slug || !rootDomain) return '';
    const root = rootDomain.split(':')[0].toLowerCase();
    const host = port ? `${slug}.${root}:${port}` : `${slug}.${root}`;
    return `${protocol}//${host}`;
}

/**
 * Builds the client portal URL for a slug using the current page's protocol/port
 * and the configured root domain. Returns '' on the server or without a slug.
 */
export function buildPortalUrl(slug) {
    if (typeof window === 'undefined' || !slug) return '';
    const { protocol, port } = window.location;
    return buildPortalUrlFromParts(slug, ROOT_DOMAIN, protocol, port);
}

/**
 * Navigates to a path inside a workspace on my.{ROOT_DOMAIN}/{slug}/{subpath}.
 * Uses window.location.href so it works cross-subdomain (e.g. fitforce.app → my.fitforce.app).
 * In dev (localhost) stays on the same host to avoid subdomain complexity.
 */
export function redirectToWorkspace(slug, subpath = 'dashboard') {
    if (!slug || typeof window === 'undefined') return;
    const { protocol, hostname, port } = window.location;
    const targetHost = hostname === 'localhost'
        ? (port ? `localhost:${port}` : 'localhost')
        : (port ? `my.${ROOT_DOMAIN}:${port}` : `my.${ROOT_DOMAIN}`);
    window.location.href = `${protocol}//${targetHost}/${slug}/${subpath.replace(/^\//, '')}`;
}

/**
 * Navigates to the coach dashboard on my.{ROOT_DOMAIN}/{slug}/dashboard.
 */
export function redirectToDashboard(slug) {
    redirectToWorkspace(slug, 'dashboard');
}
