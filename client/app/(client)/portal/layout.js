"use client";

import { usePathname } from "next/navigation";
import ClientPortalNav from "@/app/components/ClientPortalNav";
import ClientPortalProvider, { useClientPortal } from "@/app/components/ClientPortalProvider";
import ClientPortalStatusCard from "@/app/components/ClientPortalStatusCard";
import { Skeleton } from "@heroui/react/skeleton";

const PROTECTED = ['/portal/home', '/portal/nutrition', '/portal/training', '/portal/forms', '/portal/measurements', '/portal/profile', '/portal/notifications', '/portal/messages', '/portal/transformation'];

// Renders inside the provider so it can read the loaded access state.
function PortalShell({ children }) {
    const { loading, access, status } = useClientPortal();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Skeleton className="h-8 w-32" />
            </div>
        );
    }

    // Portal closed entirely → show only the status card (no nav, no children).
    if (access && access.keep_portal_access === false) {
        return (
            <div className="min-h-screen bg-background text-foreground">
                <ClientPortalStatusCard variant={status === "Frozen" ? "frozen" : "expired"} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <ClientPortalNav />
            <main className="pb-16">
                {children}
            </main>
        </div>
    );
}

export default function ClientLayout({ children }) {
    const pathname = usePathname();
    const isLoginPage = !PROTECTED.some(p => pathname.startsWith(p));

    if (isLoginPage) return <>{children}</>;

    return (
        <ClientPortalProvider>
            <PortalShell>{children}</PortalShell>
        </ClientPortalProvider>
    );
}
