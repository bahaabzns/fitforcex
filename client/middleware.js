import { NextResponse } from 'next/server';

// Subdomains that are NOT coach slugs — route normally
const RESERVED = new Set(['my', 'admin', 'www', 'api', 'mail', 'smtp']);

export function middleware(request) {
    const host = request.headers.get('host') || '';
    const hostname = host.split(':')[0]; // strip port if present

    // Only act on *.fitforce.app — ignore localhost and staging hostname
    if (!hostname.endsWith('.fitforce.app')) {
        return NextResponse.next();
    }

    const subdomain = hostname.replace('.fitforce.app', '');

    // Root domain: fitforce.app — marketing, pass through
    if (!subdomain || subdomain === 'fitforce') {
        return NextResponse.next();
    }

    // Reserved subdomains (my, admin, api …) — pass through normally
    if (RESERVED.has(subdomain)) {
        return NextResponse.next();
    }

    // Coach slug subdomain (e.g. pola.fitforce.app) → client portal
    const { pathname } = request.nextUrl;

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
