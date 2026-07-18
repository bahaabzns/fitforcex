"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import { Home, Salad, Dumbbell, ClipboardList, Bell, MessageSquare } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Avatar } from "@heroui/react/avatar";
import { useClientPortal } from "@/app/components/ClientPortalProvider";
import { useNavBadges } from "@/hooks/useNavBadges";
import api from "@/lib/axios";

const UNREAD_POLL_MS = 15000;

export default function ClientPortalNav() {
    const pathname = usePathname();
    const tPortal = useTranslations('portal.sidebar');
    const tStatus = useTranslations('portal.status');
    const { me: client, access, status, withinGrace } = useClientPortal();
    const badges = useNavBadges(access);

    const [unread, setUnread] = useState(0);

    const fetchUnread = useCallback(() => {
        api.get('/api/client-portal/notifications/unread-count')
            .then(res => setUnread(res.data?.count ?? 0))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, UNREAD_POLL_MS);
        return () => clearInterval(interval);
    }, [fetchUnread]);

    const getInitials = (c) => {
        if (!c) return "?";
        return `${c.fname?.[0] ?? ""}${c.lname?.[0] ?? ""}`.toUpperCase();
    };

    // A flag is visible when access is unknown (full UI) or explicitly allowed.
    const can = (key) => !access || access[key] === true;

    // Routes that have no sub-pages use exact-match for the active state
    const EXACT_MATCH_ROUTES = new Set(["/portal/home", "/portal/nutrition"]);

    const navItems = [
        { href: "/portal/home",           label: tPortal('home'),          icon: Home,           show: true,                                              hasUnread: false },
        { href: "/portal/nutrition",      label: tPortal('nutritionPlan'), icon: Salad,          show: can('view_nutrition_plans'),                       hasUnread: badges.nutrition },
        { href: "/portal/training",       label: tPortal('trainingPlan'),  icon: Dumbbell,       show: can('view_training_plans') || can('view_progress_history'), hasUnread: badges.training },
        { href: "/portal/forms",          label: tPortal('forms'),         icon: ClipboardList,  show: can('view_assessments') || can('view_checkins'),  hasUnread: badges.forms },
        { href: "/portal/messages",       label: tPortal('messages'),      icon: MessageSquare,  show: can('allow_messaging'),                            hasUnread: badges.messages },
    ].filter(item => item.show);

    // Mirrors the mobile app's NavigationBar, which requires >=2 destinations
    // and hides itself entirely below that (a workspace can restrict a client
    // down to just Home).
    const showBottomNav = navItems.length >= 2;

    // Show a banner when the subscription is restricted (and not in its grace window).
    const showBanner = !!access && !withinGrace && (status === 'Expired' || status === 'Frozen');
    const bannerText = status === 'Frozen' ? tStatus('bannerFrozen') : tStatus('bannerExpired');

    const isProfileActive       = pathname.startsWith('/portal/profile');
    const isNotificationsActive = pathname.startsWith('/portal/notifications');

    return (
        <>
            {/* Sticky top header */}
            <header className="sticky top-0 z-40 h-14 bg-background/95 backdrop-blur-sm border-b border-border grid grid-cols-3 items-center px-4">

                {/* Left: profile avatar */}
                <div className="flex justify-start">
                    <Link
                        href="/portal/profile"
                        className={`rounded-full transition-opacity ${
                            isProfileActive
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                : "opacity-75 hover:opacity-100"
                        }`}
                    >
                        <Avatar size="sm" color="primary">
                            <Avatar.Fallback>{getInitials(client)}</Avatar.Fallback>
                        </Avatar>
                    </Link>
                </div>

                {/* Center: logo — icon constant, wordmark flips with theme (see globals.css) */}
                <div className="flex justify-center">
                    <NextImage
                        src="/blue_dark.png"
                        alt="FitForce X"
                        width={120}
                        height={32}
                        className="brand-logo-light shrink-0"
                        style={{ height: "auto" }}
                    />
                    <NextImage
                        src="/blue_white.png"
                        alt="FitForce X"
                        width={120}
                        height={32}
                        className="brand-logo-dark shrink-0"
                        style={{ height: "auto" }}
                    />
                </div>

                {/* Right: notifications */}
                <div className="flex justify-end">
                    <Link
                        href="/portal/notifications"
                        className={`relative p-2 rounded-xl transition-colors ${
                            isNotificationsActive
                                ? "text-primary bg-sidebar-accent"
                                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                        }`}
                    >
                        <Bell size={20} />
                        {unread > 0 && (
                            <span className="absolute top-1 inset-e-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                                {unread > 99 ? '99+' : unread}
                            </span>
                        )}
                    </Link>
                </div>
            </header>

            {/* Subscription status banner */}
            {showBanner && (
                <div className={`px-4 py-2 text-center text-xs font-medium ${
                    status === 'Frozen'
                        ? 'bg-amber-500/10 text-amber-700 border-b border-amber-500/20'
                        : 'bg-destructive/10 text-destructive border-b border-destructive/20'
                }`}>
                    {bannerText}
                </div>
            )}

            {/* Fixed bottom tab bar. The safe-area-inset-bottom padding below reserves
                the iOS home-indicator / Android gesture-bar inset so the icons never
                sit under it. */}
            {showBottomNav && (
                <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border pb-[env(safe-area-inset-bottom)]">
                    <div className="flex items-center h-16 max-w-lg mx-auto px-1">
                        {navItems.map(({ href, label, icon: Icon, hasUnread }) => {
                            const active = EXACT_MATCH_ROUTES.has(href)
                                ? pathname === href
                                : pathname.startsWith(href);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    title={hasUnread ? tPortal('unreadTooltip', { label }) : label}
                                    className="flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 transition-transform duration-100 active:scale-95"
                                >
                                    {/* Rounded highlight behind the selected icon — the web
                                        analog of the mobile NavigationBar's Material 3 pill
                                        indicator. Lucide icons have no separate filled variant
                                        the way Material icons do (Icons.home vs
                                        Icons.home_outlined), so a bolder stroke stands in for
                                        that weight change instead of swapping icon families. */}
                                    <span className={`relative flex items-center justify-center w-11 h-7 rounded-full transition-colors duration-200 ${active ? "bg-primary/10" : ""}`}>
                                        <Icon
                                            size={22}
                                            strokeWidth={active ? 2.4 : 1.9}
                                            className={`shrink-0 transition-colors duration-150 ${active ? "text-primary" : "text-muted-foreground"}`}
                                        />
                                        {hasUnread && (
                                            <span className="absolute top-0.5 inset-e-1.5 w-2 h-2 rounded-full bg-danger ring-2 ring-background" />
                                        )}
                                    </span>
                                    <span
                                        className={`w-full text-center text-[11px] font-medium leading-none overflow-hidden whitespace-nowrap transition-all duration-200 ${
                                            active ? "max-h-4 opacity-100 mt-1 text-primary" : "max-h-0 opacity-0 mt-0 text-muted-foreground"
                                        }`}
                                    >
                                        {label}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            )}
        </>
    );
}
