"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { logoutUser } from '@/lib/auth';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        await logoutUser();
      } catch {}
      try {
        await signOut({ redirect: false });
      } catch {}
      router.replace('/login');
    };
    run();
  }, [router]);

  return null;
}


