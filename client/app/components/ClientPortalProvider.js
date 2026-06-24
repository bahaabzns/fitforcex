"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/axios";

const ClientPortalContext = createContext(null);

export function useClientPortal() {
    return useContext(ClientPortalContext) ?? { loading: true, access: null, status: null };
}

/**
 * Fetches the authenticated client's profile + effective subscription access
 * once and shares it with the portal shell, nav and feature pages. Re-fetches on
 * route change so access reflects status updates without a logout. Redirects to
 * the login page if the session is invalid.
 */
export default function ClientPortalProvider({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [state, setState] = useState({ me: null, access: null, status: null, withinGrace: false, loading: true });

    const applyMe = useCallback((data) => {
        setState({
            me:          data,
            access:      data.access ?? null,
            status:      data.status ?? null,
            withinGrace: data.withinGrace ?? false,
            loading:     false,
        });
    }, []);

    const refresh = useCallback(() => api
        .get("/api/client-portal/me")
        .then(res => applyMe(res.data))
        .catch(() => { setState(s => ({ ...s, loading: false })); router.push("/portal"); }),
        [applyMe, router]);

    // Re-read on every portal navigation so restrictions update dynamically.
    useEffect(() => {
        let active = true;
        api.get("/api/client-portal/me")
            .then(res => { if (active) applyMe(res.data); })
            .catch(() => { if (active) { setState(s => ({ ...s, loading: false })); router.push("/portal"); } });
        return () => { active = false; };
    }, [pathname, applyMe, router]);

    return (
        <ClientPortalContext.Provider value={{ ...state, refresh }}>
            {children}
        </ClientPortalContext.Provider>
    );
}
