'use client';

import Sidebar from "@/app/components/Sidebar";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter, useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { workspaceSlug } = useParams();

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => {
                const data = res.data;
                const currentSlug = data?.currentWorkspace?.slug;

                if (!currentSlug) { router.push('/login'); return; }

                if (currentSlug !== workspaceSlug) {
                    const target = data.workspaces?.find(w => w.slug === workspaceSlug);
                    if (target) {
                        api.post('/api/auth/switch-workspace', { workspaceId: target.id })
                            .then(() => setLoading(false))
                            .catch(() => router.push('/login'));
                    } else {
                        router.push(`/${currentSlug}/dashboard`);
                    }
                } else {
                    setLoading(false);
                }
            })
            .catch(() => router.push('/login'));
    }, [router, workspaceSlug]);

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
