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
    MessageSquare,
    Copy,
    ExternalLink,
} from "lucide-react";
>>>>>>> feature/arabic-language
import { Button } from "@heroui/react/button";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { Disclosure } from "@heroui/react/disclosure";
import { Separator } from "@heroui/react/separator";
import { Modal } from "@heroui/react/modal";
import { useTranslations } from "next-intl";

const navLink = (active) =>
    `flex items-center gap-3 px-2.5 py-2 rounded-2xl text-sm w-full text-start transition-colors duration-150 ${
        active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent"
    }`;

const subLink = (active) =>
    `flex items-center gap-2 px-2.5 py-1.5 rounded-2xl text-sm w-full text-start transition-colors duration-150 ${
        active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-sidebar-accent"
    }`;

export default function Sidebar({ collapsed }) {
    const tNav = useTranslations('nav');
    const tSidebar = useTranslations('sidebar');
    const pathname = usePathname();
    const router = useRouter();
    const [nutritionOpen, setNutritionOpen] = useState(pathname.includes('/nutrition') && !pathname.includes('/clients/'));
    const [trainingOpen, setTrainingOpen] = useState(pathname.includes('/training') && !pathname.includes('/clients/'));
    const [financeOpen, setFinanceOpen] = useState(pathname.includes('/finance'));
    const [settingsOpen, setSettingsOpen] = useState(pathname.includes('/settings'));
    const [user, setUser] = useState(null);
    const [wsOpen, setWsOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [totalUnread, setTotalUnread] = useState(0);
    const [portalLink, setPortalLink] = useState('');
    const [linkCopied, setLinkCopied] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const wsRef = useRef(null);

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null));
    }, []);

    useEffect(() => {
        function fetchUnread() {
            api.get('/api/messenger/threads')
                .then(res => {
                    const count = res.data.reduce((sum, t) => sum + (t.unread_count || 0), 0);
                    setTotalUnread(count);
                })
                .catch(() => {});
        }
        fetchUnread();
        const interval = setInterval(fetchUnread, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        function handler(e) {
            if (wsRef.current && !wsRef.current.contains(e.target)) setWsOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const currentSlug = user?.currentWorkspace?.slug;
        if (currentSlug) setPortalLink(`${window.location.origin}/portal/${currentSlug}`);
    }, [user]);

    const handleCopyPortalLink = async () => {
        try {
            await navigator.clipboard.writeText(portalLink);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {}
    };

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
        <>
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            {/* Brand */}
            <div className={`flex items-center px-4 h-16 shrink-0 ${collapsed ? 'justify-center' : 'gap-2'}`}>
                {collapsed
                    ? <NextImage src="/dark - i.png" alt="FitForce X" width={32} height={32} className="shrink-0" />
                    : <>
                        <NextImage src="/ff_logo_main.svg" alt="FitForce X" width={148} height={40} className="shrink-0" />
                        <Chip size="sm" color="primary" variant="solid" className="shrink-0 text-[10px] ms-auto">Beta</Chip>
                      </>
                }
            </div>

            <Separator />

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-2">
                <ul className="flex flex-col gap-0.5">
                    {/* Simple link item */}
                    <li>
                        <Link
                            href={`/${slug}/dashboard`}
                            title={collapsed ? tNav('dashboard') : undefined}
                            className={navLink(pathname.includes('/dashboard'))}
                        >
                            <LayoutDashboard size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">{tNav('dashboard')}</span>}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/clients`}
                            title={collapsed ? tNav('clients') : undefined}
                            className={navLink(pathname.includes('/clients'))}
                        >
                            <Users size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">{tNav('clients')}</span>}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/messenger`}
                            title={collapsed ? 'Messenger' : undefined}
                            className={navLink(pathname.includes('/messenger'))}
                        >
                            <MessageSquare size={17} className="shrink-0" />
                            {!collapsed && (
                                <>
                                    <span className="flex-1">Messenger</span>
                                    {totalUnread > 0 && (
                                        <span style={{
                                            background: 'var(--primary)', color: 'var(--primary-foreground)',
                                            borderRadius: '50%', width: 18, height: 18, fontSize: 11,
                                            fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {totalUnread > 99 ? '99+' : totalUnread}
                                        </span>
                                    )}
                                </>
                            )}
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
                                            <span className="flex-1">{tNav('finance')}</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${financeOpen ? 'rotate-90' : 'rtl:rotate-180'}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ms-5 ps-2 border-s border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/finance/transactions`} className={subLink(pathname.includes('/finance/transactions'))}>
                                                {tNav('transactions')}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/finance/packages`} className={subLink(pathname.includes('/finance/packages'))}>
                                                {tNav('packages')}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/finance/payment-methods`} className={subLink(pathname.includes('/finance/payment-methods'))}>
                                                {tNav('paymentMethods')}
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
                            title={collapsed ? tNav('plansQueue') : undefined}
                            className={navLink(pathname.includes('/plans-queue'))}
                        >
                            <ClipboardList size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">{tNav('plansQueue')}</span>}
                        </Link>
                    </li>

                    <li>
                        <Link
                            href={`/${slug}/forms`}
                            title={collapsed ? tNav('forms') : undefined}
                            className={navLink(pathname.includes('/forms') && !pathname.includes('/clients/'))}
                        >
                            <ClipboardList size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">{tNav('forms')}</span>}
                        </Link>
                    </li>

                    {/* Expandable menu: Nutrition */}
                    <li>
                        <Disclosure isExpanded={nutritionOpen} onExpandedChange={setNutritionOpen}>
                            <Disclosure.Heading>
                                <Disclosure.Trigger className={`${navLink(pathname.includes('/nutrition') && !pathname.includes('/clients/'))} w-full cursor-pointer`} disabled={collapsed}>
                                    <Salad size={17} className="shrink-0" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1">{tNav('nutrition')}</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${nutritionOpen ? 'rotate-90' : 'rtl:rotate-180'}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ms-5 ps-2 border-s border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/nutrition/food-items`} className={subLink(pathname.includes('/nutrition/food-items'))}>
                                                {tNav('foodItems')}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/nutrition/food-categories`} className={subLink(pathname.includes('/nutrition/food-categories'))}>
                                                {tNav('foodCategories')}
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
                                <Disclosure.Trigger className={`${navLink(pathname.includes('/training') && !pathname.includes('/clients/'))} w-full cursor-pointer`} disabled={collapsed}>
                                    <Dumbbell size={17} className="shrink-0" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1">{tNav('training')}</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${trainingOpen ? 'rotate-90' : 'rtl:rotate-180'}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ms-5 ps-2 border-s border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/training/exercises`} className={subLink(pathname.includes('/training/exercises'))}>
                                                {tNav('exercises')}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/training/muscle-groups`} className={subLink(pathname.includes('/training/muscle-groups'))}>
                                                {tNav('muscleGroups')}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/training/equipment`} className={subLink(pathname.includes('/training/equipment'))}>
                                                {tNav('equipment')}
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
                            title={collapsed ? tNav('team') : undefined}
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
                                    <span className="flex-1">{tNav('team')}</span>
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
                                            <span className="flex-1">{tNav('settings')}</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${settingsOpen ? 'rotate-90' : 'rtl:rotate-180'}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ms-5 ps-2 border-s border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/settings/profile`} className={subLink(pathname.includes('/settings/profile'))}>
                                                {tNav('profile')}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/settings/workspace`} className={subLink(pathname.includes('/settings/workspace'))}>
                                                {tNav('workspace')}
                                            </Link>
                                        </li>
                                        {user?.currentWorkspace?.role === 'owner' && (
                                            <li>
                                                <Link href={`/${slug}/settings/billing`} className={subLink(pathname.includes('/settings/billing'))}>
                                                    {tNav('billing')}
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

            {/* Workspace Switcher */}
            {currentWs && (
                <div className="px-3 pt-2 relative" ref={wsRef}>
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
                                <span className="flex-1 min-w-0 text-xs text-foreground font-medium truncate text-start">
                                    {currentWs.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground capitalize shrink-0">{currentWs.role}</span>
                                <ChevronDown size={12} className={`text-muted-foreground shrink-0 transition-transform ${wsOpen ? 'rotate-180' : ''}`} />
                            </>
                        )}
                    </Button>

                    {wsOpen && !collapsed && (
                        <div className="absolute left-3 right-3 bottom-full mb-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
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
                                        <span className="flex-1 truncate font-medium text-start">{ws.name}</span>
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
                                    {tSidebar('createWorkspace')}
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Client Portal Link */}
            {!collapsed && portalLink && (
                <div className="px-3">
                    <div className="flex items-center gap-1">
                        <a
                            href={portalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-sidebar-accent transition-colors flex-1 min-w-0"
                        >
                            <ExternalLink size={15} className="text-muted-foreground shrink-0" />
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-foreground truncate">
                                    {tSidebar('clientPortalLink')}
                                </span>
                                <span className="text-xs font-mono text-muted-foreground truncate">
                                    {portalLink.replace(/^https?:\/\//, '')}
                                </span>
                            </div>
                        </a>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onClick={handleCopyPortalLink}
                            title={tSidebar('copyLink')}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                            {linkCopied
                                ? <Check size={13} className="text-success" />
                                : <Copy size={13} />
                            }
                        </Button>
                    </div>
                </div>
            )}

            {/* Footer: user badge (→ settings/profile) + logout icon */}
            <div className="px-3 py-3 shrink-0">
                {user && (
                    <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
                        <Link
                            href={`/${slug}/settings/profile`}
                            className={`flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-sidebar-accent transition-colors ${
                                collapsed ? 'justify-center' : 'flex-1 min-w-0'
                            }`}
                        >
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
                        </Link>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowLogoutConfirm(true)}
                            title={tSidebar('logout')}
                            className="shrink-0 text-muted-foreground hover:text-danger"
                        >
                            <LogOut size={15} />
                        </Button>
                    </div>
                )}
            </div>
        </aside>

        <Modal isOpen={showLogoutConfirm} onOpenChange={(o) => !o && setShowLogoutConfirm(false)}>
            <Modal.Backdrop>
                <Modal.Container className="max-w-sm">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{tSidebar('logoutConfirmTitle')}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>
                            <p className="text-sm text-muted-foreground">{tSidebar('logoutConfirmMessage')}</p>
                        </Modal.Body>
                        <Modal.Footer className="flex justify-end gap-2 pt-2">
                            <Button size="sm" variant="ghost" onClick={() => setShowLogoutConfirm(false)}>
                                {tSidebar('cancel')}
                            </Button>
                            <Button size="sm" variant="danger" onClick={handleLogout}>
                                {tSidebar('logout')}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
        </>
    );
}
