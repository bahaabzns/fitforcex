"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/axios";
import ClientPortalNav from "@/app/components/ClientPortalNav";
import { Skeleton } from "@heroui/react/skeleton";

export default function ClientLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const PROTECTED = ['/portal/home', '/portal/nutrition', '/portal/training', '/portal/forms', '/portal/measurements', '/portal/profile', '/portal/notifications', '/portal/messages'];
    const isLoginPage = !PROTECTED.some(p => pathname.startsWith(p));

    useEffect(() => {
        if (isLoginPage) { setLoading(false); return; }
        api.get("/api/client-portal/me")
            .then(() => setLoading(false))
            .catch(() => {
            const slug = localStorage.getItem('portal_slug');
            router.push(slug ? `/portal/${slug}` : '/');
        });
    }, [pathname, router, isLoginPage]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Skeleton className="h-8 w-32" />
            </div>
        );
    }

    if (isLoginPage) return <>{children}</>;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <ClientPortalNav />
            <main className="pb-16">
                {children}
            </main>
        </div>
    );
}
