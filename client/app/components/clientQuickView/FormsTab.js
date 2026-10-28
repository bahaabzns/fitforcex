"use client";

import ClientFormsPage from "@/app/(coach)/[workspaceSlug]/clients/[id]/forms/page";

// The real client Forms page, view-only, so the quick view matches it exactly.
export default function FormsTab({ clientId }) {
    return <ClientFormsPage clientId={clientId} readOnly />;
}
