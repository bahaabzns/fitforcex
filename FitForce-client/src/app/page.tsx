'use client';

import { useEffect, useState } from 'react';
import Landing from 'views/landing/Landing';
import WorkspaceLanding from './landing/workspace/[id]/page';
import Loader from 'components/Loader';
import { APP_CONFIG } from '@/lib/config';

export default function HomePage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

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
            host === 'nano.com' ||
            host === 'app.nano.com');

        // If main domain → show app landing
        if (isMainDomain) {
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

  return <Landing />;
}
