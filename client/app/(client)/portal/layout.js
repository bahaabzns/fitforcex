"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/axios";
import ClientSidebar from "@/app/components/ClientSidebar";
import { Skeleton } from "@heroui/react/skeleton";

export default function ClientLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const PROTECTED = ['/portal/dashboard', '/portal/training', '/portal/forms', '/portal/measurements'];
    const isLoginPage = !PROTECTED.some(p => pathname.startsWith(p));

    useEffect(() => {
        if (isLoginPage) { setLoading(false); return; }
        api.get("/api/client-portal/me")
            .then(() => setLoading(false))
            .catch(() => {
            const slug = localStorage.getItem('portal_slug');
            router.push(slug ? `/portal/${slug}` : '/portal');
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
        <div className="flex h-screen overflow-hidden">
            <ClientSidebar />
            <main className="flex-1 overflow-y-auto bg-background text-foreground">
                {children}
            </main>
        </div>
    );
}
