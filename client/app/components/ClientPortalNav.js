"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import { Home, Salad, Dumbbell, ClipboardList, Bell, MessageSquare } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Avatar } from "@heroui/react/avatar";
import { useClientPortal } from "@/app/components/ClientPortalProvider";
import api from "@/lib/axios";

const UNREAD_POLL_MS = 15000;

export default function ClientPortalNav() {
    const pathname = usePathname();
    const tPortal = useTranslations('portal.sidebar');
    const tStatus = useTranslations('portal.status');
    const { me: client, access, status, withinGrace } = useClientPortal();

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
        { href: "/portal/home",           label: tPortal('home'),          icon: Home,           show: true },
        { href: "/portal/nutrition",      label: tPortal('nutritionPlan'), icon: Salad,          show: can('view_nutrition_plans') },
        { href: "/portal/training",       label: tPortal('trainingPlan'),  icon: Dumbbell,       show: can('view_training_plans') || can('view_progress_history') },
        { href: "/portal/forms",          label: tPortal('forms'),         icon: ClipboardList,  show: can('view_assessments') || can('view_checkins') },
        { href: "/portal/messages",       label: tPortal('messages'),      icon: MessageSquare,  show: can('allow_messaging') },
    ].filter(item => item.show);

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

            {/* Fixed bottom tab bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-sm border-t border-border">
                <div className="flex items-center justify-around h-full max-w-lg mx-auto px-4">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const active = EXACT_MATCH_ROUTES.has(href)
                            ? pathname === href
                            : pathname.startsWith(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-2xl transition-colors duration-150 ${
                                    active
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Icon size={22} className="shrink-0" />
                                <span className="text-[11px] font-medium leading-none">{label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
