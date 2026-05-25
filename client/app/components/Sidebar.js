'use client'

import Link from "next/link";
import NextImage from "next/image";
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
import { ThemeToggle } from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";

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
    const [settingsOpen, setSettingsOpen] = useState(pathname.includes('/settings'));
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
            console.error(err);
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

    useEffect(() => {
        if (collapsed) {
            setFinanceOpen(false);
            setNutritionOpen(false);
            setTrainingOpen(false);
            setSettingsOpen(false);
        }
    }, [collapsed]);

    const currentWs = user?.currentWorkspace;
    const slug = user?.currentWorkspace?.slug ?? '';
    const allWorkspaces = user?.workspaces ?? [];
    const pendingCount = user?.pendingInvitationsCount ?? 0;

    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            {/* Brand */}
            <div className={`flex items-center px-4 h-16 shrink-0 ${collapsed ? 'justify-center' : 'gap-2'}`}>
                {collapsed
                    ? <NextImage src="/dark - i.png" alt="FitForce X" width={32} height={32} className="shrink-0" />
                    : <>
                        <NextImage src="/ff_logo_main.svg" alt="FitForce X" width={148} height={40} className="shrink-0" />
                        <Chip size="sm" color="primary" variant="solid" className="shrink-0 text-[10px] ml-auto">Beta</Chip>
                      </>
                }
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
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-default transition-colors cursor-pointer"
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
                <ul className="flex flex-col gap-0.5">
                    {/* Simple link item */}
                    <li>
                        <Link
                            href={`/${slug}/dashboard`}
                            title={collapsed ? 'Dashboard' : undefined}
                            className={navLink(pathname.includes('/dashboard'))}
                        >
                            <LayoutDashboard size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">Dashboard</span>}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/clients`}
                            title={collapsed ? 'Clients' : undefined}
                            className={navLink(pathname.includes('/clients'))}
                        >
                            <Users size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">Clients</span>}
                        </Link>
                    </li>

                    {/* Expandable menu: Finance */}
                    <li>
                        <Disclosure isExpanded={financeOpen} onExpandedChange={setFinanceOpen}>
                            <Disclosure.Heading>
                                <Disclosure.Trigger className={`${navLink(pathname.includes('/finance'))} w-full cursor-pointer`} disabled={collapsed}>
                                    <Wallet size={17} className="shrink-0" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1">Finance</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${financeOpen ? 'rotate-90' : ''}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ml-5 pl-2 border-l border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/finance/transactions`} className={subLink(pathname.includes('/finance/transactions'))}>
                                                Transactions
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/finance/packages`} className={subLink(pathname.includes('/finance/packages'))}>
                                                Packages
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/finance/payment-methods`} className={subLink(pathname.includes('/finance/payment-methods'))}>
                                                Payment Methods
                                            </Link>
                                        </li>
                                    </ul>
                                </Disclosure.Body>
                            </Disclosure.Content>
                        </Disclosure>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/plans-queue`}
                            title={collapsed ? 'Plans Queue' : undefined}
                            className={navLink(pathname.includes('/plans-queue'))}
                        >
                            <ClipboardList size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">Plans Queue</span>}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/forms`}
                            title={collapsed ? 'Forms' : undefined}
                            className={navLink(pathname.includes('/forms'))}
                        >
                            <ClipboardList size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">Forms</span>}
                        </Link>
                    </li>

                    {/* Expandable menu: Nutrition */}
                    <li>
                        <Disclosure isExpanded={nutritionOpen} onExpandedChange={setNutritionOpen}>
                            <Disclosure.Heading>
                                <Disclosure.Trigger className={`${navLink(pathname.includes('/nutrition'))} w-full cursor-pointer`} disabled={collapsed}>
                                    <Salad size={17} className="shrink-0" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1">Nutrition</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${nutritionOpen ? 'rotate-90' : ''}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ml-5 pl-2 border-l border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/nutrition/food-items`} className={subLink(pathname.includes('/nutrition/food-items'))}>
                                                Food Items
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/nutrition/food-categories`} className={subLink(pathname.includes('/nutrition/food-categories'))}>
                                                Food Categories
                                            </Link>
                                        </li>
                                    </ul>
                                </Disclosure.Body>
                            </Disclosure.Content>
                        </Disclosure>
                    </li>

                    {/* Expandable menu: Training */}
                    <li>
                        <Disclosure isExpanded={trainingOpen} onExpandedChange={setTrainingOpen}>
                            <Disclosure.Heading>
                                <Disclosure.Trigger className={`${navLink(pathname.includes('/training'))} w-full cursor-pointer`} disabled={collapsed}>
                                    <Dumbbell size={17} className="shrink-0" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1">Training</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${trainingOpen ? 'rotate-90' : ''}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ml-5 pl-2 border-l border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/training/exercises`} className={subLink(pathname.includes('/training/exercises'))}>
                                                Exercises
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/training/muscle-groups`} className={subLink(pathname.includes('/training/muscle-groups'))}>
                                                Muscle Groups
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/training/equipment`} className={subLink(pathname.includes('/training/equipment'))}>
                                                Equipment
                                            </Link>
                                        </li>
                                    </ul>
                                </Disclosure.Body>
                            </Disclosure.Content>
                        </Disclosure>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/team`}
                            title={collapsed ? 'Team' : undefined}
                            className={navLink(pathname.includes('/team'))}
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

                    {/* Expandable menu: Settings */}
                    <li>
                        <Disclosure isExpanded={settingsOpen} onExpandedChange={setSettingsOpen}>
                            <Disclosure.Heading>
                                <Disclosure.Trigger className={`${navLink(pathname.includes('/settings'))} w-full cursor-pointer`} disabled={collapsed}>
                                    <Settings size={17} className="shrink-0" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1">Settings</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${settingsOpen ? 'rotate-90' : ''}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ml-5 pl-2 border-l border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/settings/profile`} className={subLink(pathname.includes('/settings/profile'))}>
                                                Profile
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/settings/workspace`} className={subLink(pathname.includes('/settings/workspace'))}>
                                                Workspace
                                            </Link>
                                        </li>
                                        {user?.currentWorkspace?.role === 'owner' && (
                                            <li>
                                                <Link href={`/${slug}/settings/billing`} className={subLink(pathname.includes('/settings/billing'))}>
                                                    Billing
                                                </Link>
                                            </li>
                                        )}
                                    </ul>
                                </Disclosure.Body>
                            </Disclosure.Content>
                        </Disclosure>
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
                        {!collapsed && (
                            <div className="flex items-center gap-1">
                                <ThemeToggle />
                                <LanguageSwitcher />
                            </div>
                        )}
                    </div>
                )}

                {collapsed && (
                    <div className="flex flex-col items-center gap-1">
                        <ThemeToggle />
                        <LanguageSwitcher />
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
