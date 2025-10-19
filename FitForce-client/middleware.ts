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
  
  // For localhost: subdomain.localhost:3000 splits into ['subdomain', 'localhost:3000']
  // For production: subdomain.nano.com splits into ['subdomain', 'nano', 'com']
  const hasSubdomain = isLocalhost
    ? parts.length >= 2 && parts[0] !== 'localhost' && !parts[0].includes('localhost')
    : parts.length > 2;

  const isMainDomain = isLocalhost
    ? host === 'localhost:3000' || host === 'localhost'
    : host === APP_CONFIG.frontendDomain || host === `app.${APP_CONFIG.frontendDomain}`;

  const subdomain = hasSubdomain
    ? parts[0]
    : null;
    
  console.log(`🔍 Debug: host=${host}, parts=${JSON.stringify(parts)}, hasSubdomain=${hasSubdomain}, isMainDomain=${isMainDomain}, subdomain=${subdomain}`);

  // Always compute a normalized absolute main-domain origin for cross-domain redirects
  const getMainDomainOrigin = () => {
    try {
      const configured = APP_CONFIG.mainDomain.trim();
      const hasProtocol = configured.startsWith('http://') || configured.startsWith('https://');
      const absolute = hasProtocol ? configured : `https://${configured}`;
      const u = new URL(absolute);
      const hostHasPublicSuffix = u.hostname.includes('.') && !u.hostname.includes('localhost');
      if (hostHasPublicSuffix) return u.origin;
      // Fallback to frontendDomain if mainDomain is local/internal
      const fallback = `https://${APP_CONFIG.frontendDomain}`;
      const fu = new URL(fallback);
      return fu.origin;
    } catch {
      // Fallback to current request protocol with configured host (best effort)
      const proto = nextUrl.protocol || 'https:';
      const configuredHost = APP_CONFIG.mainDomain.replace(/^https?:\/\//, '');
      const isInternal = configuredHost === 'localhost:3000' || !configuredHost.includes('.');
      const host = isInternal ? APP_CONFIG.frontendDomain : configuredHost;
      return `${proto}//${host}`;
    }
  };

  // Management subdomain handling (robust: match explicit subdomain or any host starting with `${admin}.`)
  const isManagementHost =
    (subdomain && subdomain.toLowerCase() === APP_CONFIG.managementSubdomain.toLowerCase()) ||
    host.toLowerCase().startsWith(`${APP_CONFIG.managementSubdomain.toLowerCase()}.`);
  if (isManagementHost) {
    // Allow admin pages to pass through - authentication will be handled client-side
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

  // Ensure specific landing pages are ONLY served on the main domain
  if (hasSubdomain || subdomain) {
    const isMainOnlyRoute =
      pathname.startsWith('/landing') ||
      pathname.startsWith('/pricing');
    if (isMainOnlyRoute) {
      const mainOrigin = getMainDomainOrigin();
      const redirectUrl = new URL(pathname + nextUrl.search, mainOrigin);
      const res = NextResponse.redirect(redirectUrl, 308);
      res.headers.set('x-ff-domain-type', 'workspace');
      return res;
    }
  }

  if (hasSubdomain || subdomain) {
    console.log(`🏢 Workspace domain detected: ${host}, subdomain: ${subdomain}`);

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

        // Determine cookie domain
        const isLocalhost = host.includes('localhost');
        const cookieDomain = isLocalhost ? undefined : `.${APP_CONFIG.frontendDomain}`;
        
        console.log(`🍪 Setting cookies with domain: ${cookieDomain || 'default (current domain)'}`);

        // Set headers and cookies so the client can render at /
        const next = NextResponse.next();
        next.headers.set('x-ff-domain-type', 'workspace');
        next.headers.set('x-ff-workspace-id', workspace.id);
        next.headers.set('x-ff-workspace-subdomain', workspace.subdomain);
        next.headers.set('x-ff-workspace-custom-domain', workspace.customDomain || '');
        
        // Set cookies with proper domain for subdomain access
        next.cookies.set('ff_workspace_id', workspace.id, { 
          path: '/', 
          sameSite: 'lax',
          domain: cookieDomain,
          secure: !isLocalhost
        });
        next.cookies.set('ff_workspace_subdomain', workspace.subdomain || '', { 
          path: '/', 
          sameSite: 'lax',
          domain: cookieDomain,
          secure: !isLocalhost
        });
        
        return next;
      } else {
        console.log(`❌ Workspace not found, status: ${resolveResponse.status} — redirecting to main domain.`);
        const mainOrigin = getMainDomainOrigin();
        const redirectUrl = new URL(mainOrigin);
        redirectUrl.searchParams.set('error', 'workspace_not_found');
        if (subdomain) redirectUrl.searchParams.set('workspace', subdomain);
        const res = NextResponse.redirect(redirectUrl, 307);
        res.headers.set('x-ff-domain-type', 'invalid-workspace');
        // Clear any workspace cookies to avoid stale state on main domain
        res.cookies.set('ff_workspace_id', '', { path: '/', maxAge: 0 });
        res.cookies.set('ff_workspace_subdomain', '', { path: '/', maxAge: 0 });
        return res;
      }
    } catch (error) {
      console.error('Error resolving workspace, redirecting to main domain:', error);
      const mainOrigin = getMainDomainOrigin();
      const redirectUrl = new URL(mainOrigin);
      redirectUrl.searchParams.set('error', 'workspace_error');
      if (subdomain) redirectUrl.searchParams.set('workspace', subdomain);
      const res = NextResponse.redirect(redirectUrl, 307);
      res.headers.set('x-ff-domain-type', 'invalid-workspace');
      res.cookies.set('ff_workspace_id', '', { path: '/', maxAge: 0 });
      res.cookies.set('ff_workspace_subdomain', '', { path: '/', maxAge: 0 });
      return res;
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


