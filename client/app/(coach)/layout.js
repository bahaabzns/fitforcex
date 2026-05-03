'use client';

import Sidebar from "@/app/components/Sidebar";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function CoachLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        api.get('/api/auth/me')
            .then(() => setLoading(false))
            .catch(() => router.push('/login'));
    }, [router]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Skeleton className="h-8 w-32" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 h-full flex flex-col overflow-y-auto bg-background text-foreground">
                {children}
            </main>
        </div>
    );
}
