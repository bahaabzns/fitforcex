"use client";

import Link from "next/link";
import NextImage from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { Salad, Dumbbell, ClipboardList, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";

const navLink = (active) =>
    `flex items-center gap-3 px-2.5 py-2 rounded-2xl text-sm w-full text-left transition-colors duration-150 ${
        active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent"
    }`;

export default function ClientSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [client, setClient] = useState(null);
    const [collapsed, setCollapsed] = useState(false);

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
        { href: "/portal/dashboard", label: "Nutrition Plan", icon: Salad },
        { href: "/portal/training", label: "Training Plan", icon: Dumbbell },
        { href: "/portal/forms", label: "Forms", icon: ClipboardList },
    ];

    return (
        <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
            {/* Brand + collapse toggle */}
            <div className="flex items-center px-3 h-16 shrink-0 gap-2">
                {collapsed
                    ? <NextImage src="/dark - i.png" alt="FitForce X" width={32} height={32} className="shrink-0 mx-auto" />
                    : <NextImage src="/Dark - H.png" alt="FitForce X" width={148} height={40} className="shrink-0" />
                }
                {!collapsed && <Chip size="sm" color="primary" variant="solid" className="shrink-0 text-[10px] ml-auto">Beta</Chip>}
                <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className="shrink-0 ml-auto"
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </Button>
            </div>

            <Separator />

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-2">
                {!collapsed && (
                    <p className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground tracking-wide">
                        Navigation
                    </p>
                )}
                <ul className="flex flex-col gap-0.5">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const active = pathname === href || (href !== "/portal/dashboard" && pathname.startsWith(href));
                        return (
                            <li key={href}>
                                <Link
                                    href={href}
                                    title={collapsed ? label : undefined}
                                    className={`${navLink(active)} ${collapsed ? "justify-center px-0" : ""}`}
                                >
                                    <Icon size={17} className="shrink-0" />
                                    {!collapsed && label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <Separator />

            {/* Footer: user + logout */}
            <div className="px-3 py-3 flex flex-col gap-1 shrink-0">
                {client && (
                    <div className={`flex items-center gap-3 px-3 py-2 rounded-2xl ${collapsed ? "justify-center" : ""}`}>
                        <Avatar size="sm" color="primary" className="shrink-0">
                            <Avatar.Fallback>{getInitials(client)}</Avatar.Fallback>
                        </Avatar>
                        {!collapsed && (
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium truncate text-foreground">
                                    {client.fname} {client.lname}
                                </span>
                                <span className="text-xs truncate text-muted-foreground">
                                    #{client.client_code}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <Button
                    variant="danger-soft"
                    size="sm"
                    fullWidth
                    onClick={handleLogout}
                    title={collapsed ? "Logout" : undefined}
                    className={`${collapsed ? "justify-center px-0" : "justify-start"}`}
                >
                    <LogOut size={15} className="shrink-0" />
                    {!collapsed && "Logout"}
                </Button>
            </div>
        </aside>
    );
}
