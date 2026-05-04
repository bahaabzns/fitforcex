'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);

    // Admin login page itself must not redirect (infinite loop)
    const isLoginPage = pathname === '/admin/login';

    useEffect(() => {
        if (isLoginPage) {
            setLoading(false);
            return;
        }

        api.get('/api/admin/me')
            .then(() => setLoading(false))
            .catch(() => router.push('/admin/login'));
    }, [router, isLoginPage]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Skeleton className="h-8 w-32" />
            </div>
        );
    }

    return <>{children}</>;
}
