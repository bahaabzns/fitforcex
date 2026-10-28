"use client";

import ClientOverviewPage from "@/app/(coach)/[workspaceSlug]/clients/[id]/page";

// The real client Overview page, view-only, so the quick view matches it exactly.
export default function OverviewTab({ clientId }) {
    return <ClientOverviewPage clientId={clientId} readOnly />;
}
