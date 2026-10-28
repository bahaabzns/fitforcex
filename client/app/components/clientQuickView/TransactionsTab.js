"use client";

import ClientTransactionsPage from "@/app/(coach)/[workspaceSlug]/clients/[id]/transactions/page";

// The real client Transactions page, view-only, so the quick view matches it exactly.
export default function TransactionsTab({ clientId }) {
    return <ClientTransactionsPage clientId={clientId} readOnly />;
}
