import { NextResponse } from 'next/server';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'fitforce.app';

// Subdomains that are NOT coach slugs — route normally
const RESERVED = new Set(['my', 'admin', 'www', 'api', 'mail', 'smtp']);

// Local dev root domains where the incoming port must be preserved on
// subdomain redirects (see the port-setter comment below) — 'localhost' for
// plain dev, 'lvh.me' for subdomain smoke-testing (see client/.env.local).
const LOCAL_DEV_ROOT_DOMAINS = new Set(['localhost', 'lvh.me']);

export function proxy(request) {
    const host = request.headers.get('host') || '';
    const hostname = host.split(':')[0]; // strip port if present

    // Only act on subdomains of ROOT_DOMAIN
    if (hostname !== ROOT_DOMAIN && !hostname.endsWith(`.${ROOT_DOMAIN}`)) {
        return NextResponse.next();
    }

    const subdomain = hostname.endsWith(`.${ROOT_DOMAIN}`)
        ? hostname.slice(0, -(ROOT_DOMAIN.length + 1))
        : '';

    const { pathname } = request.nextUrl;

    // Root domain (fitforce.app) — marketing + auth paths stay here;
    // workspace routes (/{slug}/...) redirect to my.ROOT_DOMAIN
    if (!subdomain) {
        const firstSegment = pathname.split('/')[1] || '';
        const PUBLIC_ROOT_SEGMENTS = new Set([
            '', 'login', 'register', 'forgot-password', 'reset-password',
            'check-mail', 'verify-email-required', 'portal', 'admin', 'api',
            'privacy', 'delete-account', 'about', 'contact', 'refund-policy',
            'delivery-policy',
        ]);
        if (firstSegment && !PUBLIC_ROOT_SEGMENTS.has(firstSegment)) {
            const url = request.nextUrl.clone();
            // Use hostname + port setters, not `url.host = ...`: the WHATWG
            // host setter only overwrites the port if the new value contains
            // an explicit ":port", so it would silently keep whatever port
            // was on the incoming request (e.g. an internal 3000 behind the
            // reverse proxy) and leak it into the production redirect.
            url.hostname = `my.${ROOT_DOMAIN}`;
            url.port = LOCAL_DEV_ROOT_DOMAINS.has(ROOT_DOMAIN) ? url.port : '';
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    }

    // Block /admin on non-admin subdomains → redirect to admin.ROOT_DOMAIN
    if (pathname.startsWith('/admin') && subdomain !== 'admin') {
        const url = request.nextUrl.clone();
        url.hostname = `admin.${ROOT_DOMAIN}`;
        url.port = LOCAL_DEV_ROOT_DOMAINS.has(ROOT_DOMAIN) ? url.port : '';
        return NextResponse.redirect(url);
    }

    // admin subdomain: serve clean URLs without the /admin prefix
    if (subdomain === 'admin') {
        if (pathname.startsWith('/admin')) {
            return new NextResponse(null, { status: 404 });
        }
        if (!pathname.startsWith('/api')) {
            // Rewrite /login → /admin/login so Next.js serves the admin routes.
            // Force http: so the internal proxy hits http://localhost:3000
            // instead of https://localhost:3000 (EPROTO — port 3000 is plain HTTP).
            const url = request.nextUrl.clone();
            url.protocol = 'http:';
            url.pathname = `/admin${pathname === '/' ? '' : pathname}`;
            return NextResponse.rewrite(url);
        }
        return NextResponse.next();
    }

    // Other reserved subdomains (my, api …) — pass through normally
    if (RESERVED.has(subdomain)) {
        return NextResponse.next();
    }

    // Coach slug subdomain (e.g. pola.fitforce.app) → client portal
    // Already under /portal — pass through (handles post-login navigation)
    if (pathname.startsWith('/portal')) {
        return NextResponse.next();
    }

    // Rewrite root and any other path to /portal/[coachSlug][path].
    // Force http: so the internal proxy hits http://localhost:3000 (not https).
    const url = request.nextUrl.clone();
    url.protocol = 'http:';
    url.pathname = `/portal/${subdomain}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
}

export const config = {
    // Run on all paths except Next.js internals and static files. The trailing
    // `.*\\.[\\w]+$` also skips public/ assets (e.g. /ff_logo_main.svg) so the
    // coach-slug rewrite below doesn't turn them into /portal/{slug}/... 404s.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
};
