'use client';

import { useEffect, useState } from 'react';

// next
import { useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/lib/config';

// project-imports
import Loader from 'components/Loader';

// types
import { GuardProps } from 'types/auth';

// ==============================|| GUEST GUARD ||============================== //

export default function GuestGuard({ children }: GuardProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isGuest, setIsGuest] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/me`, { credentials: 'include' });
        if (!cancelled && res.ok) {
          setIsGuest(false);
          router.push('/dashboard');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking || !isGuest) return <Loader />;

  return <>{children}</>;
}
