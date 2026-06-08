"use client";

import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { Home, Salad, Dumbbell, ClipboardList, Bell, MessageSquare } from 'lucide-react';
import { useTranslations } from "next-intl";
import { Avatar } from "@heroui/react/avatar";

export default function ClientPortalNav() {
    const pathname = usePathname();
    const tPortal = useTranslations('portal.sidebar');
    const [client, setClient] = useState(null);

    useEffect(() => {
        api.get("/api/client-portal/me")
            .then(res => setClient(res.data))
            .catch(() => {});
    }, []);

    const getInitials = (c) => {
        if (!c) return "?";
        return `${c.fname?.[0] ?? ""}${c.lname?.[0] ?? ""}`.toUpperCase();
    };

    // Routes that have no sub-pages use exact-match for the active state
    const EXACT_MATCH_ROUTES = new Set(["/portal/home", "/portal/nutrition"]);

    const navItems = [
        { href: "/portal/home",      label: tPortal('home'),          icon: Home },
        { href: "/portal/nutrition", label: tPortal('nutritionPlan'), icon: Salad },
        { href: "/portal/training",  label: tPortal('trainingPlan'),  icon: Dumbbell },
        { href: "/portal/forms",     label: tPortal('forms'),         icon: ClipboardList },
        { href: "/portal/messages",  label: tPortal('messages'),      icon: MessageSquare },
    ];

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

                {/* Center: logo */}
                <div className="flex justify-center">
                    <NextImage
                        src="/ff_logo_main.svg"
                        alt="FitForce X"
                        width={120}
                        height={32}
                        className="shrink-0"
                    />
                </div>

                {/* Right: notifications */}
                <div className="flex justify-end">
                    <Link
                        href="/portal/notifications"
                        className={`p-2 rounded-xl transition-colors ${
                            isNotificationsActive
                                ? "text-primary bg-sidebar-accent"
                                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                        }`}
                    >
                        <Bell size={20} />
                    </Link>
                </div>
            </header>

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
