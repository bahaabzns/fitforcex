import { NextResponse } from 'next/server';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'fitforce.app';

// Subdomains that are NOT coach slugs — route normally
const RESERVED = new Set(['my', 'admin', 'www', 'api', 'mail', 'smtp']);

export function middleware(request) {
    const host = request.headers.get('host') || '';
    const hostname = host.split(':')[0]; // strip port if present

    // Only act on subdomains of ROOT_DOMAIN
    if (hostname !== ROOT_DOMAIN && !hostname.endsWith(`.${ROOT_DOMAIN}`)) {
        return NextResponse.next();
    }

    const subdomain = hostname.endsWith(`.${ROOT_DOMAIN}`)
        ? hostname.slice(0, -(ROOT_DOMAIN.length + 1))
        : '';

    // Root domain — marketing site, pass through
    if (!subdomain) {
        return NextResponse.next();
    }

    const { pathname } = request.nextUrl;

    // Block /admin on non-admin subdomains → redirect to admin.ROOT_DOMAIN
    if (pathname.startsWith('/admin') && subdomain !== 'admin') {
        const url = request.nextUrl.clone();
        url.host = `admin.${ROOT_DOMAIN}`;
        return NextResponse.redirect(url);
    }

    // Reserved subdomains (my, admin, api …) — pass through normally
    if (RESERVED.has(subdomain)) {
        return NextResponse.next();
    }

    // Coach slug subdomain (e.g. pola.fitforce.app) → client portal
    // Already under /portal — pass through (handles post-login navigation)
    if (pathname.startsWith('/portal')) {
        return NextResponse.next();
    }

    // Rewrite root and any other path to /portal/[coachSlug][path]
    const url = request.nextUrl.clone();
    url.pathname = `/portal/${subdomain}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
}

export const config = {
    // Run on all paths except Next.js internals and static files
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
