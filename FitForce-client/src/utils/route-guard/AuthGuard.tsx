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
  const [verificationRequired, setVerificationRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/auth/me`, { credentials: 'include' });
        if (!cancelled && res.ok) {
          const data = await res.json();
          
          // Check if email verification is required and user is not verified
          if (data.requireEmailVerification && !data.user?.emailVerified) {
            setVerificationRequired(true);
            // Redirect to verification page (not login page)
            router.push('/verify-email-required');
            return;
          }
          
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
