'use client';

import { useEffect, useState } from 'react';

// next
import { useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/lib/config';

// project-imports
import Loader from 'components/Loader';

// types
import { GuardProps } from 'types/auth';

// ==============================|| AUTH GUARD ||============================== //

export default function AuthGuard({ children }: GuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/me`, { credentials: 'include' });
        if (!cancelled && res.ok) {
          setAuthorized(true);
        } else if (!cancelled) {
          router.push('/login');
        }
      } catch {
        if (!cancelled) router.push('/login');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking || !authorized) return <Loader />;

  return <>{children}</>;
}
