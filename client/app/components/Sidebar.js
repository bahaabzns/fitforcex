'use client'

import Link from "next/link";
import NextImage from "next/image";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";
import { buildPortalUrl } from "@/lib/coachSlug";
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
import { Button } from "@heroui/react/button";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { Disclosure } from "@heroui/react/disclosure";
import { Separator } from "@heroui/react/separator";
import { Modal } from "@heroui/react/modal";
import { Drawer } from "@heroui/react/drawer";
import { useTranslations, useLocale } from "next-intl";

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

export default function Sidebar({ collapsed: collapsedProp, isMobile = false, mobileOpen = false, onMobileOpenChange = () => {} }) {
    const tNav = useTranslations('nav');
    const tSidebar = useTranslations('sidebar');
    const locale = useLocale();
    const isRTL = locale === 'ar';
    const pathname = usePathname();
    const router = useRouter();
    // The icon-only "collapsed" desktop mode never applies inside the mobile drawer —
    // the drawer always shows full labels regardless of leftover desktop state.
    const collapsed = collapsedProp && !isMobile;
    const [nutritionOpen, setNutritionOpen] = useState(pathname.includes('/nutrition') && !pathname.includes('/clients/'));
    const [trainingOpen, setTrainingOpen] = useState(pathname.includes('/training') && !pathname.includes('/clients/'));
    const [financeOpen, setFinanceOpen] = useState(pathname.includes('/finance'));
    const [formsOpen, setFormsOpen] = useState(pathname.includes('/forms') && !pathname.includes('/clients/'));
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
        if (currentSlug) setPortalLink(buildPortalUrl(currentSlug));
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
        } catch (err) {
            console.error(err);
        } finally {
            // Hard redirect so React state and any cached auth is fully reset.
            // router.push would do a client-side nav and the login page's /me
            // check can race against the cookie deletion.
            window.location.href = '/login';
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
            setFormsOpen(false);
            setNutritionOpen(false);
            setTrainingOpen(false);
        }
    }, [collapsed]);

    const currentWs = user?.currentWorkspace;
    const slug = user?.currentWorkspace?.slug ?? '';
    const allWorkspaces = user?.workspaces ?? [];
    const pendingCount = user?.pendingInvitationsCount ?? 0;

    const sidebarPanel = (
        <>
            {/* Brand */}
            <div className={`flex items-center px-4 h-16 shrink-0 ${collapsed ? 'justify-center' : 'gap-2'}`}>
                {collapsed
                    ? <NextImage src="/mark.svg" alt="FitForce X" width={30} height={30} priority unoptimized className="shrink-0" />
                    : <>
                        {/* Blue icon stays constant; wordmark flips with theme (see globals.css). */}
                        <NextImage src="/blue_dark.png" alt="FitForce X" width={148} height={40} priority style={{ height: "auto" }} className="brand-logo-light shrink-0" />
                        <NextImage src="/blue_white.png" alt="FitForce X" width={148} height={40} priority style={{ height: "auto" }} className="brand-logo-dark shrink-0" />
                        <Chip size="sm" color="primary" variant="solid" className="shrink-0 text-[10px] ms-auto">Beta</Chip>
                      </>
                }
            </div>

            <Separator className="bg-border" />

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
                            title={collapsed ? tNav('messenger') : undefined}
                            className={navLink(pathname.includes('/messenger'))}
                        >
                            <MessageSquare size={17} className="shrink-0" />
                            {!collapsed && (
                                <>
                                    <span className="flex-1">{tNav('messenger')}</span>
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

                    {/* Expandable menu: Forms */}
                    <li>
                        <Disclosure isExpanded={formsOpen} onExpandedChange={setFormsOpen}>
                            <Disclosure.Heading>
                                <Disclosure.Trigger className={`${navLink(pathname.includes('/forms') && !pathname.includes('/clients/'))} w-full cursor-pointer`} disabled={collapsed}>
                                    <ClipboardList size={17} className="shrink-0" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1">{tNav('forms')}</span>
                                            <ChevronRight size={14} className={`transition-transform duration-200 ${formsOpen ? 'rotate-90' : 'rtl:rotate-180'}`} />
                                        </>
                                    )}
                                </Disclosure.Trigger>
                            </Disclosure.Heading>
                            <Disclosure.Content>
                                <Disclosure.Body>
                                    <ul className="flex flex-col gap-0.5 mt-1 ms-5 ps-2 border-s border-sidebar-border">
                                        <li>
                                            <Link href={`/${slug}/forms`} className={subLink(pathname === `/${slug}/forms` || (pathname.includes('/forms') && !pathname.includes('/forms/metrics') && !pathname.includes('/clients/')))}>
                                                {tNav('forms')}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href={`/${slug}/forms/metrics`} className={subLink(pathname.includes('/forms/metrics'))}>
                                                {tNav('metrics')}
                                            </Link>
                                        </li>
                                    </ul>
                                </Disclosure.Body>
                            </Disclosure.Content>
                        </Disclosure>
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

                    <li>
                        <Link
                            href={`/${slug}/settings`}
                            title={collapsed ? tNav('settings') : undefined}
                            className={navLink(pathname.includes('/settings'))}
                        >
                            <Settings size={17} className="shrink-0" />
                            {!collapsed && <span className="flex-1">{tNav('settings')}</span>}
                        </Link>
                    </li>
                </ul>
            </nav>

            <Separator className="bg-border" />

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

            {/* Footer: user badge (→ settings/account) + logout icon */}
            <div className="px-3 py-3 shrink-0">
                {user && (
                    <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
                        <Link
                            href={`/${slug}/settings/account`}
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
        </>
    );

    return (
        <>
        {isMobile ? (
            <Drawer isOpen={mobileOpen} onOpenChange={onMobileOpenChange}>
                <Drawer.Backdrop isDismissable>
                    <Drawer.Content placement={isRTL ? 'right' : 'left'}>
                        <Drawer.Dialog className="h-full w-64 max-w-[85vw] rounded-none p-0 flex flex-col overflow-hidden bg-sidebar">
                            {sidebarPanel}
                        </Drawer.Dialog>
                    </Drawer.Content>
                </Drawer.Backdrop>
            </Drawer>
        ) : (
            <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
                {sidebarPanel}
            </aside>
        )}

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
