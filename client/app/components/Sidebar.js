'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
    LayoutDashboard,
    Users,
    Users2,
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
    Wallet,
    Package,
    Receipt,
    Building2,
    Check,
    Plus,
} from "lucide-react";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [dbOpen, setDbOpen] = useState(pathname.startsWith('/databases'));
    const [financeOpen, setFinanceOpen] = useState(pathname.startsWith('/finance'));
    const [user, setUser] = useState(null);
    const [collapsed, setCollapsed] = useState(false);
    const [wsOpen, setWsOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const wsRef = useRef(null);

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null));
    }, []);

    // Close workspace dropdown on outside click
    useEffect(() => {
        function handler(e) {
            if (wsRef.current && !wsRef.current.contains(e.target)) setWsOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = async () => {
        try {
            await api.post('/api/auth/logout');
            router.push('/login');
        } catch (err) {
            console.log(err);
        }
    };

    const handleSwitchWorkspace = async (workspaceId) => {
        if (switching || workspaceId === user?.currentWorkspace?.id) { setWsOpen(false); return; }
        setSwitching(true);
        try {
            await api.post('/api/auth/switch-workspace', { workspaceId });
            setWsOpen(false);
            router.push('/dashboard');
            router.refresh();
            // Re-fetch user to update currentWorkspace display
            const res = await api.get('/api/auth/me');
            setUser(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setSwitching(false);
        }
    };

    const getInitials = (u) => {
        if (!u) return '?';
        return `${u.fname?.[0] ?? ''}${u.lname?.[0] ?? ''}`.toUpperCase();
    };

    const currentWs = user?.currentWorkspace;
    const allWorkspaces = user?.workspaces ?? [];
    const pendingCount = user?.pendingInvitationsCount ?? 0;

    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            {/* Brand + collapse toggle */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-border shrink-0">
                {!collapsed && (
                    <span className="text-xl font-bold truncate text-primary" style={{ letterSpacing: '-0.3px' }}>
                        FitForce X
                    </span>
                )}
                <button
                    onClick={() => setCollapsed(c => !c)}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className={`p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer shrink-0 ${collapsed ? 'mx-auto' : 'ml-auto'}`}
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

            {/* Workspace Switcher */}
            {!collapsed && currentWs && (
                <div className="px-3 pb-2 relative" ref={wsRef}>
                    <button
                        onClick={() => setWsOpen(o => !o)}
                        disabled={switching}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/60 hover:bg-accent text-left transition-colors group cursor-pointer"
                    >
                        <Building2 size={13} className="text-muted-foreground shrink-0" />
                        <span className="flex-1 min-w-0 text-xs text-foreground font-medium truncate">
                            {currentWs.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground capitalize shrink-0">{currentWs.role}</span>
                        <ChevronDown size={12} className={`text-muted-foreground shrink-0 transition-transform ${wsOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {wsOpen && (
                        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                            <div className="p-1.5 flex flex-col gap-0.5">
                                {allWorkspaces.map(ws => (
                                    <button
                                        key={ws.id}
                                        onClick={() => handleSwitchWorkspace(ws.id)}
                                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-xs transition-colors cursor-pointer ${
                                            ws.id === currentWs.id
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-foreground hover:bg-accent'
                                        }`}
                                    >
                                        <Building2 size={12} className="shrink-0" />
                                        <span className="flex-1 truncate font-medium">{ws.name}</span>
                                        <span className="text-muted-foreground capitalize shrink-0">{ws.role}</span>
                                        {ws.id === currentWs.id && <Check size={12} className="text-primary shrink-0" />}
                                    </button>
                                ))}
                            </div>
                            <div className="border-t border-border p-1.5">
                                <Link
                                    href="/team?action=new-workspace"
                                    onClick={() => setWsOpen(false)}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-accent transition-colors cursor-pointer"
                                >
                                    <Plus size={12} />
                                    Create workspace
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                        <button
                            onClick={() => !collapsed && setFinanceOpen(!financeOpen)}
                            title={collapsed ? 'Finance' : undefined}
                            className={`${pathname.startsWith('/finance') ? 'sidebar-link-active' : 'sidebar-link'} ${collapsed ? 'justify-center px-0 w-full' : ''}`}
                        >
                            <Wallet size={17} className="shrink-0" />
                            {!collapsed && (
                                <>
                                    <span className="flex-1 text-left">Finance</span>
                                    {financeOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </>
                            )}
                        </button>

                        {!collapsed && (
                            <div className={`sidebar-submenu ${financeOpen ? 'open' : ''}`}>
                                <ul className="flex flex-col gap-1 mt-1">
                                    <li>
                                        <Link
                                            href="/finance/transactions"
                                            className={pathname.startsWith('/finance/transactions') ? 'sidebar-sub-link-active' : 'sidebar-sub-link'}
                                        >
                                            <Receipt size={15} />
                                            Transactions
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/finance/packages"
                                            className={pathname.startsWith('/finance/packages') ? 'sidebar-sub-link-active' : 'sidebar-sub-link'}
                                        >
                                            <Package size={15} />
                                            Packages
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/finance/payment-methods"
                                            className={pathname.startsWith('/finance/payment-methods') ? 'sidebar-sub-link-active' : 'sidebar-sub-link'}
                                        >
                                            <Wallet size={15} />
                                            Payment Methods
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
                            href="/plans-queue"
                            title={collapsed ? 'Plans Queue' : undefined}
                            className={`${pathname.startsWith('/plans-queue') ? 'sidebar-link-active' : 'sidebar-link'} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <ClipboardList size={17} className="shrink-0" />
                            {!collapsed && 'Plans Queue'}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href="/team"
                            title={collapsed ? 'Team' : undefined}
                            className={`${pathname.startsWith('/team') ? 'sidebar-link-active' : 'sidebar-link'} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <div className="relative shrink-0">
                                <Users2 size={17} />
                                {pendingCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center leading-none">
                                        {pendingCount > 9 ? '9+' : pendingCount}
                                    </span>
                                )}
                            </div>
                            {!collapsed && (
                                <>
                                    Team
                                    {pendingCount > 0 && (
                                        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                                            {pendingCount > 9 ? '9+' : pendingCount}
                                        </span>
                                    )}
                                </>
                            )}
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
