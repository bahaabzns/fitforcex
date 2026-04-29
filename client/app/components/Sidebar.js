'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    LayoutDashboard,
    Users,
    Database,
    Salad,
    Dumbbell,
    ClipboardList,
    Settings,
    LogOut,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [dbOpen, setDbOpen] = useState(pathname.startsWith('/databases'));
    const [user, setUser] = useState(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null));
    }, []);

    const handleLogout = async () => {
        try {
            await api.post('/api/auth/logout');
            router.push('/login');
        } catch (err) {
            console.log(err);
        }
    };

    const getInitials = (u) => {
        if (!u) return '?';
        return `${u.fname?.[0] ?? ''}${u.lname?.[0] ?? ''}`.toUpperCase();
    };

    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            {/* Brand + collapse toggle */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-(--border-color) shrink-0">
                {!collapsed && (
                    <span className="text-xl font-bold truncate" style={{ color: 'var(--accent)', letterSpacing: '-0.3px' }}>
                        FitForce X
                    </span>
                )}
                <button
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors cursor-pointer shrink-0 ${collapsed ? 'mx-auto' : 'ml-auto'}`}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* User Info */}
            <div className="sidebar-user">
                <div className="sidebar-avatar shrink-0">{getInitials(user)}</div>
                {!collapsed && (
                    <div className="sidebar-user-info min-w-0">
                        <span className="sidebar-user-name">
                            {user ? `${user.fname} ${user.lname}` : '—'}
                        </span>
                        <span className="sidebar-user-email">
                            {user?.email ?? ''}
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                <ul className="flex flex-col gap-1">
                    <li>
                        <Link
                            href="/dashboard"
                            title={collapsed ? 'Dashboard' : undefined}
                            className={`${pathname === '/dashboard' ? 'sidebar-link-active' : 'sidebar-link'} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <LayoutDashboard size={17} className="shrink-0" />
                            {!collapsed && 'Dashboard'}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href="/clients"
                            title={collapsed ? 'Clients' : undefined}
                            className={`${pathname.startsWith('/clients') ? 'sidebar-link-active' : 'sidebar-link'} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <Users size={17} className="shrink-0" />
                            {!collapsed && 'Clients'}
                        </Link>
                    </li>

                    <li>
                        <button
                            onClick={() => !collapsed && setDbOpen(!dbOpen)}
                            title={collapsed ? 'Databases' : undefined}
                            className={`${pathname.startsWith('/databases') ? 'sidebar-link-active' : 'sidebar-link'} ${collapsed ? 'justify-center px-0 w-full' : ''}`}
                        >
                            <Database size={17} className="shrink-0" />
                            {!collapsed && (
                                <>
                                    <span className="flex-1 text-left">Databases</span>
                                    {dbOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </>
                            )}
                        </button>

                        {!collapsed && (
                            <div className={`sidebar-submenu ${dbOpen ? 'open' : ''}`}>
                                <ul className="flex flex-col gap-1 mt-1">
                                    <li>
                                        <Link
                                            href="/databases/nutrition/food-items"
                                            className={pathname.startsWith('/databases/nutrition') ? 'sidebar-sub-link-active' : 'sidebar-sub-link'}
                                        >
                                            <Salad size={15} />
                                            Nutrition
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/databases/training/exercise-library"
                                            className={pathname.startsWith('/databases/training') ? 'sidebar-sub-link-active' : 'sidebar-sub-link'}
                                        >
                                            <Dumbbell size={15} />
                                            Training
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </li>

                    <li>
                        <Link
                            href="/forms"
                            title={collapsed ? 'Forms' : undefined}
                            className={`${pathname.startsWith('/forms') ? 'sidebar-link-active' : 'sidebar-link'} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <ClipboardList size={17} className="shrink-0" />
                            {!collapsed && 'Forms'}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href="/settings"
                            title={collapsed ? 'Settings' : undefined}
                            className={`${pathname.startsWith('/settings') ? 'sidebar-link-active' : 'sidebar-link'} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <Settings size={17} className="shrink-0" />
                            {!collapsed && 'Settings'}
                        </Link>
                    </li>
                </ul>
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <button
                    onClick={handleLogout}
                    title={collapsed ? 'Logout' : undefined}
                    className={`sidebar-logout-btn ${collapsed ? 'justify-center px-0' : ''}`}
                >
                    <LogOut size={17} className="shrink-0" />
                    {!collapsed && 'Logout'}
                </button>
            </div>
        </aside>
    );
}

