"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import api from "@/lib/axios";
import ClientSidebar from "@/app/components/ClientSidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function CoachPortalLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const { coachId } = useParams();
    const isLoginPage = pathname.endsWith("/login");

    useEffect(() => {
        if (isLoginPage) { setLoading(false); return; }
        api.get("/api/client-portal/me")
            .then(() => setLoading(false))
            .catch(() => router.push(`/client/${coachId}/login`));
    }, [pathname, router, isLoginPage, coachId]);

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
