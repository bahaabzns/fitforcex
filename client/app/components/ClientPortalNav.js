"use client";

import Link from "next/link";
import NextImage from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { Salad, Dumbbell, ClipboardList, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from "next-intl";
import { Button } from "@heroui/react/button";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";

export default function ClientPortalNav() {
    const pathname = usePathname();
    const router = useRouter();
    const tPortal = useTranslations('portal.sidebar');
    const [client, setClient] = useState(null);

    useEffect(() => {
        api.get("/api/client-portal/me")
            .then(res => setClient(res.data))
            .catch(() => {});
    }, []);

    const handleLogout = async () => {
        await api.post("/api/client-portal/logout").catch(() => {});
        router.push("/portal/login");
    };

    const getInitials = (c) => {
        if (!c) return "?";
        return `${c.fname?.[0] ?? ""}${c.lname?.[0] ?? ""}`.toUpperCase();
    };

    const navItems = [
        { href: "/portal/nutrition", label: tPortal('nutritionPlan'), icon: Salad },
        { href: "/portal/training", label: tPortal('trainingPlan'), icon: Dumbbell },
        { href: "/portal/forms",    label: tPortal('forms'),         icon: ClipboardList },
    ];

    return (
        <>
            {/* Sticky top header */}
            <header className="sticky top-0 z-40 h-14 bg-background/95 backdrop-blur-sm border-b border-border flex items-center px-4 gap-3">
                <NextImage
                    src="/ff_logo_main.svg"
                    alt="FitForce X"
                    width={120}
                    height={32}
                    className="shrink-0"
                />
                <Chip size="sm" color="primary" variant="solid" className="shrink-0 text-[10px]">Beta</Chip>

                <div className="ml-auto flex items-center gap-1">
                    {client && (
                        <div className="flex items-center gap-2 mr-1">
                            <Avatar size="sm" color="primary" className="shrink-0">
                                <Avatar.Fallback>{getInitials(client)}</Avatar.Fallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground hidden sm:block">
                                {client.fname}
                            </span>
                        </div>
                    )}
                    <ThemeToggle />
                    <LanguageSwitcher />
                    <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onClick={handleLogout}
                        title="Logout"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <LogOut size={16} />
                    </Button>
                </div>
            </header>

            {/* Fixed bottom tab bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-sm border-t border-border">
                <div className="flex items-center justify-around h-full max-w-lg mx-auto px-4">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const active = pathname === href || (href !== "/portal/nutrition" && pathname.startsWith(href));
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
