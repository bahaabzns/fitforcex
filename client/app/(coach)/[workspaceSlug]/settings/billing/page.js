"use client";

import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function BillingRedirect({ params }) {
    const router = useRouter();
    const workspaceSlug = use(params).workspaceSlug;
    const searchParams = useSearchParams();

    useEffect(() => {
        const qs = searchParams.toString();
        router.replace(`/${workspaceSlug}/settings/subscription${qs ? `?${qs}` : ""}`);
    }, [router, workspaceSlug, searchParams]);

    return null;
}
