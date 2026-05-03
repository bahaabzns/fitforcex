"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { Salad, Dumbbell, ClipboardList, LogOut, ChevronLeft, ChevronRight } from "lucide-react";

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
        router.push("/client/login");
    };

    const getInitials = (c) => {
        if (!c) return "?";
        return `${c.fname?.[0] ?? ""}${c.lname?.[0] ?? ""}`.toUpperCase();
    };

    const navItems = [
        { href: "/client/dashboard", label: "Nutrition Plan", icon: Salad },
        { href: "/client/training", label: "Training Plan", icon: Dumbbell },
        { href: "/client/forms", label: "Forms", icon: ClipboardList },
    ];

    return (
        <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
            {/* Brand + collapse toggle */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-(--border-color) shrink-0">
                {!collapsed && (
                    <span className="text-xl font-bold truncate" style={{ color: "var(--accent)", letterSpacing: "-0.3px" }}>
                        FitForce X
                    </span>
                )}
                <button
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className={`p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors cursor-pointer shrink-0 ${collapsed ? "mx-auto" : "ml-auto"}`}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* User Info */}
            <div className="sidebar-user">
                <div className="sidebar-avatar shrink-0">{getInitials(client)}</div>
                {!collapsed && (
                    <div className="sidebar-user-info min-w-0">
                        <span className="sidebar-user-name">
                            {client ? `${client.fname} ${client.lname}` : "—"}
                        </span>
                        <span className="sidebar-user-email">
                            {client ? `#${client.client_code}` : ""}
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                <ul className="flex flex-col gap-1">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const active = pathname === href || (href !== "/client/dashboard" && pathname.startsWith(href));
                        return (
                            <li key={href}>
                                <Link
                                    href={href}
                                    title={collapsed ? label : undefined}
                                    className={`${active ? "sidebar-link-active" : "sidebar-link"} ${collapsed ? "justify-center px-0" : ""}`}
                                >
                                    <Icon size={17} className="shrink-0" />
                                    {!collapsed && label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Footer / Logout */}
            <div className="sidebar-footer">
                <button
                    onClick={handleLogout}
                    title={collapsed ? "Logout" : undefined}
                    className={`sidebar-logout-btn ${collapsed ? "justify-center px-0" : ""}`}
                >
                    <LogOut size={17} className="shrink-0" />
                    {!collapsed && "Logout"}
                </button>
            </div>
        </aside>
    );
}
