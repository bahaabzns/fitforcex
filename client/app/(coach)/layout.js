'use client';

import Sidebar from "@/app/components/Sidebar";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
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
    MessageSquare,
    ChevronRight,
} from 'lucide-react';
import { ThemeToggle } from "@/app/components/ThemeToggle";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

// Returns { icon: ReactElement, crumbs: { label, href }[] } for the current path.
// Every crumb carries an href so the whole trail is clickable; parent crumbs link
// to their section's default page (no /nutrition, /training or /finance index exists).
function getPageInfo(pathname, { slug, clientId, clientLabel, tNav } = {}) {
    const p = pathname;
    const base = `/${slug}`;

    if (p.includes('/dashboard'))
        return { icon: <LayoutDashboard size={15} />, crumbs: [{ label: tNav('dashboard'), href: `${base}/dashboard` }] };

    if (p.includes('/messenger'))
        return { icon: <MessageSquare size={15} />, crumbs: [{ label: tNav('messenger'), href: `${base}/messenger` }] };

    if (p.includes('/clients')) {
        const crumbs = [{ label: tNav('clients'), href: `${base}/clients` }];
        if (clientLabel) crumbs.push({ label: clientLabel, href: `${base}/clients/${clientId}` });
        return { icon: <Users size={15} />, crumbs };
    }

    if (p.includes('/nutrition/food-categories'))
        return { icon: <Salad size={15} />, crumbs: [
            { label: tNav('nutrition'), href: `${base}/nutrition/food-items` },
            { label: tNav('foodCategories'), href: `${base}/nutrition/food-categories` },
        ] };
    if (p.includes('/nutrition'))
        return { icon: <Salad size={15} />, crumbs: [
            { label: tNav('nutrition'), href: `${base}/nutrition/food-items` },
            { label: tNav('foodItems'), href: `${base}/nutrition/food-items` },
        ] };

    if (p.includes('/training/muscle-groups'))
        return { icon: <Dumbbell size={15} />, crumbs: [
            { label: tNav('training'), href: `${base}/training/exercises` },
            { label: tNav('muscleGroups'), href: `${base}/training/muscle-groups` },
        ] };
    if (p.includes('/training/equipment'))
        return { icon: <Dumbbell size={15} />, crumbs: [
            { label: tNav('training'), href: `${base}/training/exercises` },
            { label: tNav('equipment'), href: `${base}/training/equipment` },
        ] };
    if (p.includes('/training'))
        return { icon: <Dumbbell size={15} />, crumbs: [
            { label: tNav('training'), href: `${base}/training/exercises` },
            { label: tNav('exercises'), href: `${base}/training/exercises` },
        ] };

    if (p.includes('/finance/transactions'))
        return { icon: <Wallet size={15} />, crumbs: [
            { label: tNav('finance'), href: `${base}/finance/transactions` },
            { label: tNav('transactions'), href: `${base}/finance/transactions` },
        ] };
    if (p.includes('/finance/packages'))
        return { icon: <Wallet size={15} />, crumbs: [
            { label: tNav('finance'), href: `${base}/finance/transactions` },
            { label: tNav('packages'), href: `${base}/finance/packages` },
        ] };
    if (p.includes('/finance/payment-methods'))
        return { icon: <Wallet size={15} />, crumbs: [
            { label: tNav('finance'), href: `${base}/finance/transactions` },
            { label: tNav('paymentMethods'), href: `${base}/finance/payment-methods` },
        ] };
    if (p.includes('/finance'))
        return { icon: <Wallet size={15} />, crumbs: [{ label: tNav('finance'), href: `${base}/finance/transactions` }] };

    if (p.includes('/forms'))
        return { icon: <ClipboardList size={15} />, crumbs: [{ label: tNav('forms'), href: `${base}/forms` }] };
    if (p.includes('/plans-queue'))
        return { icon: <ClipboardList size={15} />, crumbs: [{ label: tNav('plansQueue'), href: `${base}/plans-queue` }] };
    if (p.includes('/team'))
        return { icon: <Users2 size={15} />, crumbs: [{ label: tNav('team'), href: `${base}/team` }] };

    if (p.includes('/settings/profile'))
        return { icon: <Settings size={15} />, crumbs: [
            { label: tNav('settings'), href: `${base}/settings` },
            { label: tNav('profile'), href: `${base}/settings/profile` },
        ] };
    if (p.includes('/settings/workspace'))
        return { icon: <Settings size={15} />, crumbs: [
            { label: tNav('settings'), href: `${base}/settings` },
            { label: tNav('workspace'), href: `${base}/settings/workspace` },
        ] };
    if (p.includes('/settings/billing'))
        return { icon: <Settings size={15} />, crumbs: [
            { label: tNav('settings'), href: `${base}/settings` },
            { label: tNav('billing'), href: `${base}/settings/billing` },
        ] };
    if (p.includes('/settings'))
        return { icon: <Settings size={15} />, crumbs: [{ label: tNav('settings'), href: `${base}/settings` }] };

    return { icon: null, crumbs: [] };
}

export default function WorkspaceLayout({ children }) {
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [clientLabel, setClientLabel] = useState(null);
    const router = useRouter();
    const { workspaceSlug } = useParams();
    const pathname = usePathname();
    const tNav = useTranslations('nav');

    const clientIdMatch = pathname.match(/\/clients\/([^/]+)/);
    const clientId = clientIdMatch ? clientIdMatch[1] : null;

    const { icon, crumbs } = getPageInfo(pathname, { slug: workspaceSlug, clientId, clientLabel, tNav });

    // Breadcrumbs are only clickable/hoverable within the Clients section
    // (clients list + client-details page). Everywhere else the trail is
    // plain, non-interactive text.
    const breadcrumbInteractive = pathname.includes('/clients');

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
                        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
                            {icon && (
                                <span className={crumbs.length === 1 ? "text-foreground" : "text-muted-foreground"}>{icon}</span>
                            )}
                            {crumbs.map((crumb, i) => {
                                const isLast = i === crumbs.length - 1;
                                const isLink = !isLast && breadcrumbInteractive;
                                return (
                                    <span key={i} className="flex items-center gap-1.5">
                                        {i > 0 && <ChevronRight size={13} className="text-muted-foreground" />}
                                        {isLink ? (
                                            <Link
                                                href={crumb.href}
                                                className="text-muted-foreground underline-offset-4 transition-colors hover:underline"
                                            >
                                                {crumb.label}
                                            </Link>
                                        ) : (
                                            <span
                                                aria-current={isLast ? "page" : undefined}
                                                className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}
                                            >
                                                {crumb.label}
                                            </span>
                                        )}
                                    </span>
                                );
                            })}
                        </nav>
                    )}

                    <div className="ms-auto flex items-center gap-1">
                        <ThemeToggle />
                        <LanguageSwitcher />
                    </div>
                </header>
                <main className="flex-1 h-full flex flex-col overflow-y-auto bg-background text-foreground">
                    {children}
                </main>
            </div>
        </div>
    );
}
