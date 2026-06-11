"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";

// Backward-compatibility: the portal login used to live at /portal/<slug> on the
// root domain. It now lives on the workspace subdomain, so redirect old links to
// https://<slug>.<root>/portal (keeping the current protocol and port).
export default function LegacyPortalSlugRedirect() {
    const params = useParams();
    const coachSlug = params?.coachSlug;

    useEffect(() => {
        if (!coachSlug) return;
        const { protocol, port } = window.location;
        const host = port ? `${coachSlug}.${ROOT_DOMAIN}:${port}` : `${coachSlug}.${ROOT_DOMAIN}`;
        window.location.replace(`${protocol}//${host}/portal`);
    }, [coachSlug]);

    return null;
}
