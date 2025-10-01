import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { APP_CONFIG } from './src/lib/config';

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const hostname = nextUrl.hostname || '';
  const headerHost = req.headers.get('host') || '';
  const host = hostname || headerHost;
  const pathname = nextUrl.pathname;
  
  // Debug logging
  console.log(`🔍 Middleware: ${host}${pathname}`);

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const parts = host.split('.');
  const isLocalhost = host.includes('localhost');
  const hasSubdomain = isLocalhost
    ? host.includes('localhost:3000') && parts.length >= 2 && parts[0] !== 'localhost'
    : parts.length > 2;

  const isMainDomain =
    !hasSubdomain &&
    (
      host === 'localhost:3000' ||
      host === 'fitforceapp.com' ||
      host === 'app.fitforceapp.com' ||
      host === 'nano.com' ||
      host === 'app.nano.com'
    );

  const subdomain = isLocalhost
    ? (host.includes('localhost:3000') && parts.length >= 2 ? parts[0] : null)
    : parts.length > 2
    ? parts[0]
    : null;
    
  console.log(`🔍 Debug: host=${host}, parts=${JSON.stringify(parts)}, hasSubdomain=${hasSubdomain}, isMainDomain=${isMainDomain}, subdomain=${subdomain}`);

  // Management subdomain handling (robust: match explicit subdomain or any host starting with `${admin}.`)
  const isManagementHost =
    (subdomain && subdomain.toLowerCase() === APP_CONFIG.managementSubdomain.toLowerCase()) ||
    host.toLowerCase().startsWith(`${APP_CONFIG.managementSubdomain.toLowerCase()}.`);
  if (isManagementHost) {
    // Allow admin pages to pass through to avoid loops
    if (pathname.startsWith('/admin')) {
      const res = NextResponse.next();
      res.headers.set('x-ff-domain-type', 'management');
      return res;
    }
    // Force redirect to admin login for any other path
    const url = new URL('/admin/login', req.url);
    const res = NextResponse.redirect(url);
    res.headers.set('x-ff-domain-type', 'management');
    return res;
  }

  if (isMainDomain) {
    if (pathname.startsWith('/landing/workspace')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    const res = NextResponse.next();
    res.headers.set('x-ff-domain-type', 'main');
    return res;
  }

  if (hasSubdomain || subdomain) {
    console.log(`🏢 Workspace domain detected: ${host}, subdomain: ${subdomain}`);
    
    if (pathname !== '/') {
      console.log(`🔄 Allowing non-root path to pass through: ${pathname}`);
      const res = NextResponse.next();
      res.headers.set('x-ff-domain-type', 'workspace');
      return res;
    }

    try {
      const resolveUrl = new URL('/api/workspaces/resolve', APP_CONFIG.apiUrl);
      resolveUrl.searchParams.set('host', host);
      
      console.log(`🔗 Fetching: ${resolveUrl.toString()}`);
      const resolveResponse = await fetch(resolveUrl.toString(), {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      console.log(`📡 Response status: ${resolveResponse.status}`);
      if (resolveResponse.ok) {
        const data = await resolveResponse.json();
        console.log(`✅ Workspace data:`, data);
        const workspace = data.workspace;

        // Set headers and cookies so the client can render at /
        const next = NextResponse.next();
        next.headers.set('x-ff-domain-type', 'workspace');
        next.headers.set('x-ff-workspace-id', workspace.id);
        next.headers.set('x-ff-workspace-subdomain', workspace.subdomain);
        next.headers.set('x-ff-workspace-custom-domain', workspace.customDomain || '');
        next.cookies.set('ff_workspace_id', workspace.id, { path: '/', sameSite: 'lax' });
        next.cookies.set('ff_workspace_subdomain', workspace.subdomain || '', { path: '/', sameSite: 'lax' });
        return next;
      } else {
        console.log(`❌ Workspace not found, status: ${resolveResponse.status} — falling back to client-side handling.`);
        const next = NextResponse.next();
        next.headers.set('x-ff-domain-type', 'workspace');
        return next;
      }
    } catch (error) {
      console.error('Error resolving workspace (non-fatal, continuing):', error);
      const next = NextResponse.next();
      next.headers.set('x-ff-domain-type', 'workspace');
      return next;
    }
  }

  const res = NextResponse.next();
  res.headers.set('x-ff-domain-type', 'unknown');
  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)'
  ]
};


