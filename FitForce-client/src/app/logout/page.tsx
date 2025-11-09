"use client";

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { logoutUser } from '@/lib/auth';

export default function LogoutPage() {

  useEffect(() => {
    const run = async () => {
      try {
        await logoutUser();
      } catch {}
      try {
        await signOut({ redirect: false });
      } catch {}
      // Force redirect using window.location to ensure it works
      window.location.href = '/login';
    };
    run();
  }, []);

  return null;
}


