'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { APP_CONFIG } from '@/lib/config';
import Loader from 'components/Loader';

// types
import { GuardProps } from 'types/auth';

// ==============================|| DASHBOARD ROUTE GUARD ||============================== //

/**
 * Guard for /dashboard route that checks user's access to the workspace:
 * - If team member → allow access
 * - If client → redirect to /client/dashboard
 * - If neither → redirect to main domain
 */
export default function DashboardRouteGuard({ children }: GuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Get workspace ID from cookie
        const getCookie = (name: string) => {
          if (typeof document === 'undefined') return null;
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
          return null;
        };

        const workspaceId = getCookie('ff_workspace_id');
        const host = typeof window !== 'undefined' ? window.location.host : '';
        const isLocalhost = host.includes('localhost');
        const isMainDomain = isLocalhost 
          ? host === 'localhost:3000' || host === 'localhost'
          : host === APP_CONFIG.frontendDomain || host === `app.${APP_CONFIG.frontendDomain}`;

        // Only check workspace access if we're on a workspace subdomain AND on /dashboard path
        const isDashboardPath = pathname === '/dashboard' || pathname === '/dashboard/';
        
        // If on main domain or not on dashboard path, allow access (other guards handle auth)
        if (isMainDomain || !workspaceId || !isDashboardPath) {
          if (!cancelled) {
            setAuthorized(true);
            setChecking(false);
          }
          return;
        }

        // Check user's access to this workspace
        const response = await fetch(
          `${APP_CONFIG.apiUrl}/api/workspaces/check-access?workspaceId=${workspaceId}`,
          {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'x-workspace-id': workspaceId,
            },
          }
        );

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          const { accessType, workspaceSubdomain } = data;

          if (accessType === 'team_member') {
            // Team member - allow access
            setAuthorized(true);
          } else if (accessType === 'client') {
            // Client - redirect to client dashboard
            const protocol = isLocalhost ? 'http' : 'https';
            const clientDashboardUrl = `${protocol}://${workspaceSubdomain}.${isLocalhost ? 'localhost:3000' : APP_CONFIG.frontendDomain}/client/dashboard`;
            window.location.href = clientDashboardUrl;
            return;
          } else {
            // Neither client nor team member - redirect to main domain
            const protocol = isLocalhost ? 'http' : 'https';
            const mainDomainUrl = isLocalhost 
              ? `${protocol}://localhost:3000`
              : APP_CONFIG.mainDomain || `${protocol}://${APP_CONFIG.frontendDomain}`;
            window.location.href = mainDomainUrl;
            return;
          }
        } else if (response.status === 401) {
          // Not authenticated - redirect to login
          router.push('/login');
          return;
        } else {
          // Error or not found - redirect to main domain
          const protocol = isLocalhost ? 'http' : 'https';
          const mainDomainUrl = isLocalhost 
            ? `${protocol}://localhost:3000`
            : APP_CONFIG.mainDomain || `${protocol}://${APP_CONFIG.frontendDomain}`;
          window.location.href = mainDomainUrl;
          return;
        }
      } catch (error) {
        console.error('Error checking workspace access:', error);
        if (!cancelled) {
          // On error, redirect to main domain for safety
          const host = typeof window !== 'undefined' ? window.location.host : '';
          const isLocalhost = host.includes('localhost');
          const protocol = isLocalhost ? 'http' : 'https';
          const mainDomainUrl = isLocalhost 
            ? `${protocol}://localhost:3000`
            : APP_CONFIG.mainDomain || `${protocol}://${APP_CONFIG.frontendDomain}`;
          window.location.href = mainDomainUrl;
        }
        return;
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) return <Loader />;
  if (!authorized) return <Loader />;

  return <>{children}</>;
}

