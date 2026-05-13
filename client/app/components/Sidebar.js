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
    Salad,
    Dumbbell,
    ClipboardList,
    Settings,
    LogOut,
    ChevronDown,
    ChevronRight,
    Wallet,
    Building2,
    Check,
    Plus,
} from "lucide-react";
import { Button } from "@heroui/react/button";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { Disclosure } from "@heroui/react/disclosure";
import { Separator } from "@heroui/react/separator";

const navLink = (active) =>
    `flex items-center gap-3 px-2.5 py-2 rounded-2xl text-sm w-full text-left transition-colors duration-150 ${
        active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent"
    }`;

const subLink = (active) =>
    `flex items-center gap-2 px-2.5 py-1.5 rounded-2xl text-sm w-full text-left transition-colors duration-150 ${
        active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent"
    }`;

export default function Sidebar({ collapsed }) {
    const pathname = usePathname();
    const router = useRouter();
    const [nutritionOpen, setNutritionOpen] = useState(pathname.includes('/nutrition'));
    const [trainingOpen, setTrainingOpen] = useState(pathname.includes('/training'));
    const [financeOpen, setFinanceOpen] = useState(pathname.includes('/finance'));
    const [user, setUser] = useState(null);
    const [wsOpen, setWsOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const wsRef = useRef(null);

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null));
    }, []);

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
            const targetWs = (user?.workspaces ?? []).find(w => w.id === workspaceId);
            router.push(`/${targetWs?.slug ?? ''}/dashboard`);
            router.refresh();
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
    const slug = user?.currentWorkspace?.slug ?? '';
    const allWorkspaces = user?.workspaces ?? [];
    const pendingCount = user?.pendingInvitationsCount ?? 0;

    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            {/* Brand */}
            <div className={`flex items-center px-4 py-4 shrink-0 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
                <div className="size-8 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white">F</span>
                </div>
                {!collapsed && (
                    <span className="text-sm font-semibold truncate text-foreground" style={{ letterSpacing: '-0.2px' }}>
                        FitForce X
                    </span>
                )}
            </div>

            <Separator />

            {/* Workspace Switcher */}
            {currentWs && (
                <div className="px-3 py-2 relative" ref={wsRef}>
                    <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={() => !collapsed && setWsOpen(o => !o)}
                        isDisabled={switching}
                        className={`gap-2 px-2.5 ${collapsed ? 'justify-center pointer-events-none' : 'justify-start'}`}
                        title={collapsed ? currentWs.name : undefined}
                    >
                        <Building2 size={14} className="text-muted-foreground shrink-0" />
                        {!collapsed && (
                            <>
                                <span className="flex-1 min-w-0 text-xs text-foreground font-medium truncate text-left">
                                    {currentWs.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground capitalize shrink-0">{currentWs.role}</span>
                                <ChevronDown size={12} className={`text-muted-foreground shrink-0 transition-transform ${wsOpen ? 'rotate-180' : ''}`} />
                            </>
                        )}
                    </Button>

                    {wsOpen && !collapsed && (
                        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                            <div className="p-1.5 flex flex-col gap-0.5">
                                {allWorkspaces.map(ws => (
                                    <Button
                                        key={ws.id}
                                        variant={ws.id === currentWs.id ? "tertiary" : "ghost"}
                                        size="sm"
                                        fullWidth
                                        onClick={() => handleSwitchWorkspace(ws.id)}
                                        className="justify-start gap-2 px-2.5"
                                    >
                                        <Building2 size={12} className="shrink-0" />
                                        <span className="flex-1 truncate font-medium text-left">{ws.name}</span>
                                        <span className="text-muted-foreground capitalize shrink-0 text-xs">{ws.role}</span>
                                        {ws.id === currentWs.id && <Check size={12} className="text-primary shrink-0" />}
                                    </Button>
                                ))}
                            </div>
                            <div className="border-t border-border p-1.5">
                                <Link
                                    href={`/${slug}/team?action=new-workspace`}
                                    onClick={() => setWsOpen(false)}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
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
            <nav className="flex-1 overflow-y-auto px-3 py-2">
                {!collapsed && (
                    <p className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground tracking-wide">
                        Navigation
                    </p>
                )}
                <ul className="flex flex-col gap-0.5">
                    <li>
                        <Link
                            href={`/${slug}/dashboard`}
                            title={collapsed ? 'Dashboard' : undefined}
                            className={`${navLink(pathname.includes('/dashboard'))} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <LayoutDashboard size={17} className="shrink-0" />
                            {!collapsed && 'Dashboard'}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/clients`}
                            title={collapsed ? 'Clients' : undefined}
                            className={`${navLink(pathname.includes('/clients'))} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <Users size={17} className="shrink-0" />
                            {!collapsed && 'Clients'}
                        </Link>
                    </li>

                    <li>
                        {collapsed ? (
                            <button
                                title="Nutrition"
                                className={`${navLink(pathname.includes('/nutrition'))} justify-center px-0 w-full`}
                            >
                                <Salad size={17} className="shrink-0" />
                            </button>
                        ) : (
                            <Disclosure isExpanded={nutritionOpen} onExpandedChange={setNutritionOpen}>
                                <Disclosure.Heading>
                                    <Disclosure.Trigger className={`${navLink(pathname.includes('/nutrition'))} w-full`}>
                                        <Salad size={17} className="shrink-0" />
                                        <span className="flex-1 text-left">Nutrition</span>
                                        {nutritionOpen
                                            ? <ChevronDown size={14} className="shrink-0" />
                                            : <ChevronRight size={14} className="shrink-0" />
                                        }
                                    </Disclosure.Trigger>
                                </Disclosure.Heading>
                                <Disclosure.Content>
                                    <Disclosure.Body>
                                        <ul className="flex flex-col gap-0.5 mt-1 ml-5 pl-2 border-l border-sidebar-border">
                                            <li>
                                                <Link
                                                    href={`/${slug}/nutrition/food-items`}
                                                    className={subLink(pathname.includes('/nutrition/food-items'))}
                                                >
                                                    Food Items
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href={`/${slug}/nutrition/food-categories`}
                                                    className={subLink(pathname.includes('/nutrition/food-categories'))}
                                                >
                                                    Food Categories
                                                </Link>
                                            </li>
                                        </ul>
                                    </Disclosure.Body>
                                </Disclosure.Content>
                            </Disclosure>
                        )}
                    </li>

                    <li>
                        {collapsed ? (
                            <button
                                title="Training"
                                className={`${navLink(pathname.includes('/training'))} justify-center px-0 w-full`}
                            >
                                <Dumbbell size={17} className="shrink-0" />
                            </button>
                        ) : (
                            <Disclosure isExpanded={trainingOpen} onExpandedChange={setTrainingOpen}>
                                <Disclosure.Heading>
                                    <Disclosure.Trigger className={`${navLink(pathname.includes('/training'))} w-full`}>
                                        <Dumbbell size={17} className="shrink-0" />
                                        <span className="flex-1 text-left">Training</span>
                                        {trainingOpen
                                            ? <ChevronDown size={14} className="shrink-0" />
                                            : <ChevronRight size={14} className="shrink-0" />
                                        }
                                    </Disclosure.Trigger>
                                </Disclosure.Heading>
                                <Disclosure.Content>
                                    <Disclosure.Body>
                                        <ul className="flex flex-col gap-0.5 mt-1 ml-5 pl-2 border-l border-sidebar-border">
                                            <li>
                                                <Link
                                                    href={`/${slug}/training/exercises`}
                                                    className={subLink(pathname.includes('/training/exercises'))}
                                                >
                                                    Exercises
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href={`/${slug}/training/muscle-groups`}
                                                    className={subLink(pathname.includes('/training/muscle-groups'))}
                                                >
                                                    Muscle Groups
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href={`/${slug}/training/equipment`}
                                                    className={subLink(pathname.includes('/training/equipment'))}
                                                >
                                                    Equipment
                                                </Link>
                                            </li>
                                        </ul>
                                    </Disclosure.Body>
                                </Disclosure.Content>
                            </Disclosure>
                        )}
                    </li>

                    <li>
                        {collapsed ? (
                            <button
                                title="Finance"
                                className={`${navLink(pathname.includes('/finance'))} justify-center px-0 w-full`}
                            >
                                <Wallet size={17} className="shrink-0" />
                            </button>
                        ) : (
                            <Disclosure isExpanded={financeOpen} onExpandedChange={setFinanceOpen}>
                                <Disclosure.Heading>
                                    <Disclosure.Trigger className={`${navLink(pathname.includes('/finance'))} w-full`}>
                                        <Wallet size={17} className="shrink-0" />
                                        <span className="flex-1 text-left">Finance</span>
                                        {financeOpen
                                            ? <ChevronDown size={14} className="shrink-0" />
                                            : <ChevronRight size={14} className="shrink-0" />
                                        }
                                    </Disclosure.Trigger>
                                </Disclosure.Heading>
                                <Disclosure.Content>
                                    <Disclosure.Body>
                                        <ul className="flex flex-col gap-0.5 mt-1 ml-5 pl-2 border-l border-sidebar-border">
                                            <li>
                                                <Link
                                                    href={`/${slug}/finance/transactions`}
                                                    className={subLink(pathname.includes('/finance/transactions'))}
                                                >
                                                    Transactions
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href={`/${slug}/finance/packages`}
                                                    className={subLink(pathname.includes('/finance/packages'))}
                                                >
                                                    Packages
                                                </Link>
                                            </li>
                                            <li>
                                                <Link
                                                    href={`/${slug}/finance/payment-methods`}
                                                    className={subLink(pathname.includes('/finance/payment-methods'))}
                                                >
                                                    Payment Methods
                                                </Link>
                                            </li>
                                        </ul>
                                    </Disclosure.Body>
                                </Disclosure.Content>
                            </Disclosure>
                        )}
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/forms`}
                            title={collapsed ? 'Forms' : undefined}
                            className={`${navLink(pathname.includes('/forms'))} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <ClipboardList size={17} className="shrink-0" />
                            {!collapsed && 'Forms'}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/plans-queue`}
                            title={collapsed ? 'Plans Queue' : undefined}
                            className={`${navLink(pathname.includes('/plans-queue'))} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <ClipboardList size={17} className="shrink-0" />
                            {!collapsed && 'Plans Queue'}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/team`}
                            title={collapsed ? 'Team' : undefined}
                            className={`${navLink(pathname.includes('/team'))} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <div className="relative shrink-0">
                                <Users2 size={17} />
                                {collapsed && pendingCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center leading-none">
                                        {pendingCount > 9 ? '9+' : pendingCount}
                                    </span>
                                )}
                            </div>
                            {!collapsed && (
                                <>
                                    <span className="flex-1">Team</span>
                                    {pendingCount > 0 && (
                                        <Chip size="sm" color="accent" variant="soft" className="shrink-0">
                                            {pendingCount > 9 ? '9+' : pendingCount}
                                        </Chip>
                                    )}
                                </>
                            )}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/settings`}
                            title={collapsed ? 'Settings' : undefined}
                            className={`${navLink(pathname.includes('/settings'))} ${collapsed ? 'justify-center px-0' : ''}`}
                        >
                            <Settings size={17} className="shrink-0" />
                            {!collapsed && 'Settings'}
                        </Link>
                    </li>
                </ul>
            </nav>

            <Separator />

            {/* Footer: user + logout */}
            <div className="px-3 py-3 flex flex-col gap-1 shrink-0">
                {user && (
                    <div className={`flex items-center gap-3 px-3 py-2 rounded-2xl ${collapsed ? 'justify-center' : ''}`}>
                        <Avatar size="sm" color="primary" className="shrink-0">
                            <Avatar.Fallback>{getInitials(user)}</Avatar.Fallback>
                        </Avatar>
                        {!collapsed && (
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium truncate text-foreground">
                                    {user.fname} {user.lname}
                                </span>
                                <span className="text-xs truncate text-muted-foreground">
                                    {user.email}
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
                    title={collapsed ? 'Logout' : undefined}
                    className={`${collapsed ? 'justify-center px-0' : 'justify-start'}`}
                >
                    <LogOut size={15} className="shrink-0" />
                    {!collapsed && 'Logout'}
                </Button>
            </div>
        </aside>
    );
}
