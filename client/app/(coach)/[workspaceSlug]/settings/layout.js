"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/axios";
import { Skeleton } from "@heroui/react/skeleton";

export default function SettingsLayout({ children, params }) {
    const router = useRouter();
    const pathname = usePathname();
    const [me, setMe] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    const workspaceSlug = params.workspaceSlug;

    const load = useCallback(async () => {
        try {
            const meRes = await api.get("/api/auth/me");
            setMe(meRes.data);
            const wsId = meRes.data.currentWorkspace?.id;
            if (!wsId) return;
            const [wsRes, membersRes] = await Promise.all([
                api.get(`/api/workspaces/${wsId}`),
                api.get(`/api/workspaces/${wsId}/members`).catch(() => ({ data: [] })),
            ]);
            setWorkspace(wsRes.data);
            setMembers(membersRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const isOwner = me?.currentWorkspace?.role === "owner";

    if (loading) {
        return (
            <div className="p-8 max-w-7xl">
                <Skeleton className="h-9 w-28 rounded-lg mb-6" />
                <div className="flex gap-2 mb-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-24 rounded" />)}
                </div>
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl flex flex-col gap-6">
            {/* Page content */}
            {children}
        </div>
    );
}
