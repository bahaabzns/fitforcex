'use client';

import { useEffect, useState } from 'react';
import Landing from 'views/landing/Landing';
import WorkspaceLanding from './landing/workspace/[id]/page';
import Loader from 'components/Loader';
import { APP_CONFIG } from '@/lib/config';

export default function HomePage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const detectAndResolve = async () => {
      try {
        const host = window.location.host;
        const parts = host.split('.');
        const isLocalhost = host.includes('localhost');
        const hasSubdomain = isLocalhost
          ? host.includes('localhost:3000') && parts.length >= 2 && parts[0] !== 'localhost'
          : parts.length > 2;

        const isMainDomain =
          !hasSubdomain &&
          (host === 'localhost:3000' ||
            host === APP_CONFIG.frontendDomain ||
            host === `app.${APP_CONFIG.frontendDomain}` ||
            host === 'fitforceapp.com');

        // If main domain → show app landing
        if (isMainDomain) {
          // Surface query errors like ?error=workspace_not_found&workspace=xxx
          try {
            const params = new URLSearchParams(window.location.search);
            const error = params.get('error');
            const workspace = params.get('workspace');
            if (error === 'workspace_not_found') {
              const ws = workspace ? ` "${workspace}"` : '';
              setErrorMsg(`Workspace${ws} was not found. You can create a new workspace from here.`);
            }
          } catch {}
          setChecked(true);
          return;
        }

        // If management subdomain → do nothing here (middleware rewrites to /admin/login)
        const sub = isLocalhost ? (host.includes('localhost:3000') && parts.length >= 2 ? parts[0] : null) : parts.length > 2 ? parts[0] : null;
        if (sub && sub.toLowerCase() === APP_CONFIG.managementSubdomain.toLowerCase()) {
          setChecked(true);
          return;
        }

        // If subdomain → resolve workspace
        if (hasSubdomain) {
          // Try cookie first (set by middleware), then resolve API
          const cookie = document.cookie.split('; ').find((row) => row.startsWith('ff_workspace_id='));
          const cookieId = cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
          if (cookieId) {
            setWorkspaceId(cookieId);
            setChecked(true);
            return;
          }

          const resolveUrl = new URL('/api/workspaces/resolve', APP_CONFIG.apiUrl);
          resolveUrl.searchParams.set('host', host);

          const res = await fetch(resolveUrl.toString(), { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            setWorkspaceId(data.workspace.id);
            setChecked(true);
            return;
          }

          // Not found or error → hard redirect to main domain
          try {
            const configured = (APP_CONFIG.mainDomain || '').trim();
            const hasProtocol = configured.startsWith('http://') || configured.startsWith('https://');
            const absolute = hasProtocol ? configured : `https://${configured}`;
            const main = new URL(absolute);
            const useFrontend = (!main.hostname.includes('.') || main.hostname.includes('localhost')) && APP_CONFIG.frontendDomain;
            const origin = useFrontend ? `https://${APP_CONFIG.frontendDomain}` : main.origin;
            const redirect = new URL(origin);
            redirect.searchParams.set('error', 'workspace_not_found');
            const sub = isLocalhost ? (host.includes('localhost:3000') && parts.length >= 2 ? parts[0] : null) : parts.length > 2 ? parts[0] : null;
            if (sub) redirect.searchParams.set('workspace', sub);
            window.location.replace(redirect.toString());
            return;
          } catch {
            // If URL building fails, just fall through to landing on current domain
          }
        }
      } catch {
        // ignore and fall through to app landing
      } finally {
        setChecked(true);
      }
    };

    detectAndResolve();
  }, []);

  if (!checked) {
    return <Loader />;
  }

  if (workspaceId) {
    return <WorkspaceLanding params={{ id: workspaceId }} />;
  }

  return (
    <>
      {errorMsg ? (
        <div style={{
          background: '#FEF3C7',
          color: '#92400E',
          padding: '12px 16px',
          borderBottom: '1px solidrgb(31, 74, 153)',
          fontSize: 14
        }}>
          {errorMsg}
        </div>
      ) : null}
      <Landing />
    </>
  );
}
