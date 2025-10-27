'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loader from 'components/Loader';

// ================================|| REGISTER ||================================ //

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to landing page book-demo section
    router.replace('/#book-demo');
  }, [router]);

  return <Loader />;
}
