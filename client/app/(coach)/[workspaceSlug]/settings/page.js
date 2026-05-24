"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage({ params }) {
    const router = useRouter();
    const workspaceSlug = use(params).workspaceSlug;

    useEffect(() => {
        router.replace(`/${workspaceSlug}/settings/profile`);
    }, [router, workspaceSlug]);

    return null;
}
