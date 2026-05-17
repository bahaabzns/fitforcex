'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, Building2, Package, CreditCard, LogOut } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Avatar } from '@heroui/react/avatar';

const NAV = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/workspaces', label: 'Workspaces', icon: Building2 },
    { href: '/admin/plans',     label: 'Plans',     icon: Package },
    { href: '/admin/payments',  label: 'Payments',  icon: CreditCard },
];

export default function AdminLayout({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    const isLoginPage = pathname === '/admin/login';

    useEffect(() => {
        if (isLoginPage) { setLoading(false); return; }
        api.get('/api/admin/me')
            .then(res => { setAdmin(res.data); setLoading(false); })
            .catch(() => router.push('/admin/login'));
    }, [router, isLoginPage]);

    async function handleLogout() {
        await api.post('/api/admin/logout').catch(() => {});
        router.push('/admin/login');
    }

    if (isLoginPage) return <>{children}</>;

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar */}
            <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-card">
                <div className="px-5 py-4 border-b border-border">
                    <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">FitForce X</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">Admin Panel</p>
                </div>

                <nav className="flex-1 p-3 flex flex-col gap-0.5">
                    {NAV.map(({ href, label, icon: Icon, exact }) => {
                        const active = exact ? pathname === href : pathname.startsWith(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    active
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-default hover:text-foreground'
                                }`}
                            >
                                <Icon size={15} />
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-border">
                    <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
                        <Avatar color="primary" className="w-7 h-7 text-xs shrink-0">
                            <Avatar.Fallback>
                                {admin?.fname?.[0]}{admin?.lname?.[0]}
                            </Avatar.Fallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{admin?.fname} {admin?.lname}</p>
                            <p className="text-xs text-muted-foreground truncate">{admin?.email}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full justify-start px-3 py-2 text-sm text-muted-foreground"
                    >
                        <LogOut size={15} />
                        Sign out
                    </Button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
