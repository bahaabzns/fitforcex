"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/axios";

export default function ClientLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Don't protect the login page itself
        if (pathname === "/client/login") {
            setLoading(false);
            return;
        }

        api.get("/api/client-portal/me")
            .then(() => setLoading(false))
            .catch(() => router.push("/client/login"));
    }, [pathname, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-blue-50">
                <p className="text-gray-500">Loading…</p>
            </div>
        );
    }

    return <>{children}</>;
}
