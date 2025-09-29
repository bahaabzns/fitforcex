'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientPageRedirect({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  useEffect(() => {
    router.replace(`/dashboard/clients/${id}/overview`);
  }, [id, router]);

  return null;
}