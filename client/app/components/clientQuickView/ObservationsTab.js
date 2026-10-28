"use client";

import ClientObservationsPage from "@/app/(coach)/[workspaceSlug]/clients/[id]/observations/page";

// The real client Observations page, view-only, so the quick view matches it exactly.
export default function ObservationsTab({ clientId }) {
    return <ClientObservationsPage clientId={clientId} readOnly />;
}
