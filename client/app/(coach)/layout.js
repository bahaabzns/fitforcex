'use client';

import Sidebar from "@/app/components/Sidebar";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter, useParams, usePathname } from "next/navigation";
import { Skeleton } from "@heroui/react/skeleton";
import { Button } from "@heroui/react/button";
import {
    PanelLeft,
    LayoutDashboard,
    Users,
    Salad,
    Dumbbell,
    Wallet,
    ClipboardList,
    Users2,
    Settings,
    ChevronRight,
} from "lucide-react";

// Returns { icon: ReactElement, crumbs: string[] } for the current path
function getPageInfo(pathname, { clientLabel } = {}) {
    const p = pathname;

    if (p.includes('/dashboard'))
        return { icon: <LayoutDashboard size={15} />, crumbs: ['Dashboard'] };

    if (p.includes('/clients'))
        return { icon: <Users size={15} />, crumbs: clientLabel ? ['Clients', clientLabel] : ['Clients'] };

    if (p.includes('/nutrition/food-categories'))
        return { icon: <Salad size={15} />, crumbs: ['Nutrition', 'Food Categories'] };
    if (p.includes('/nutrition'))
        return { icon: <Salad size={15} />, crumbs: ['Nutrition', 'Food Items'] };
    if (p.includes('/training/muscle-groups'))
        return { icon: <Dumbbell size={15} />, crumbs: ['Training', 'Muscle Groups'] };
    if (p.includes('/training/equipment'))
        return { icon: <Dumbbell size={15} />, crumbs: ['Training', 'Equipment'] };
    if (p.includes('/training'))
        return { icon: <Dumbbell size={15} />, crumbs: ['Training', 'Exercises'] };

    if (p.includes('/finance/transactions'))
        return { icon: <Wallet size={15} />, crumbs: ['Finance', 'Transactions'] };
    if (p.includes('/finance/packages'))
        return { icon: <Wallet size={15} />, crumbs: ['Finance', 'Packages'] };
    if (p.includes('/finance/payment-methods'))
        return { icon: <Wallet size={15} />, crumbs: ['Finance', 'Payment Methods'] };
    if (p.includes('/finance'))
        return { icon: <Wallet size={15} />, crumbs: ['Finance'] };

    if (p.includes('/forms'))
        return { icon: <ClipboardList size={15} />, crumbs: ['Forms'] };
    if (p.includes('/plans-queue'))
        return { icon: <ClipboardList size={15} />, crumbs: ['Plans Queue'] };
    if (p.includes('/team'))
        return { icon: <Users2 size={15} />, crumbs: ['Team'] };
    if (p.includes('/settings'))
        return { icon: <Settings size={15} />, crumbs: ['Settings'] };

    return { icon: null, crumbs: [] };
}

export default function WorkspaceLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [clientLabel, setClientLabel] = useState(null);
    const router = useRouter();
    const { workspaceSlug } = useParams();
    const pathname = usePathname();

    const clientIdMatch = pathname.match(/\/clients\/([^/]+)/);
    const clientId = clientIdMatch ? clientIdMatch[1] : null;

    const { icon, crumbs } = getPageInfo(pathname, { clientLabel });

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => {
                const data = res.data;
                const currentSlug = data?.currentWorkspace?.slug;

                if (!currentSlug) { router.push('/login'); return; }

                if (currentSlug !== workspaceSlug) {
                    const target = data.workspaces?.find(w => w.slug === workspaceSlug);
                    if (target) {
                        api.post('/api/auth/switch-workspace', { workspaceId: target.id })
                            .then(() => setLoading(false))
                            .catch(() => router.push('/login'));
                    } else {
                        router.push(`/${currentSlug}/dashboard`);
                    }
                } else {
                    setLoading(false);
                }
            })
            .catch(() => router.push('/login'));
    }, [router, workspaceSlug]);

    useEffect(() => {
        if (!clientId) { setClientLabel(null); return; }
        api.get(`/api/clients/${clientId}`)
            .then(res => {
                const c = res.data;
                setClientLabel(`#${c.code ?? c.client_code} ${c.fname} ${c.lname}`);
            })
            .catch(() => setClientLabel(null));
    }, [clientId]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Skeleton className="h-8 w-32" />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar collapsed={collapsed} />
            <div className="flex-1 h-full flex flex-col overflow-hidden">
                <header className="flex items-center gap-3 p-4 border-b border-border shrink-0">
                    <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onClick={() => setCollapsed(c => !c)}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <PanelLeft size={16} />
                    </Button>

                    {crumbs.length > 0 && (
                        <div className="flex items-center gap-1.5 text-sm">
                            {icon && (
                                <span className={crumbs.length === 1 ? "text-foreground" : "text-muted-foreground"}>{icon}</span>
                            )}
                            {crumbs.map((crumb, i) => (
                                <span key={i} className="flex items-center gap-1.5">
                                    {i > 0 && <ChevronRight size={13} className="text-muted-foreground" />}
                                    <span className={i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
                                        {crumb}
                                    </span>
                                </span>
                            ))}
                        </div>
                    )}
                </header>
                <main className="flex-1 h-full flex flex-col overflow-y-auto bg-background text-foreground">
                    {children}
                </main>
            </div>
        </div>
    );
}
