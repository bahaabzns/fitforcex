'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import Link from 'next/link';
import { Users, Building2, Package, TrendingUp } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Card } from '@heroui/react/card';
import { Avatar } from '@heroui/react/avatar';

function StatCard({ icon: Icon, label, value, accent }) {
    return (
        <Card>
            <Card.Content className="flex flex-col gap-3 p-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ?? 'bg-primary/10'}`}>
                    <Icon size={17} className={accent ? 'text-white' : 'text-primary'} />
                </div>
                <div>
                    <p className="text-2xl font-bold text-foreground">{value ?? '—'}</p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                </div>
            </Card.Content>
        </Card>
    );
}

export default function AdminOverviewPage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/api/admin/stats')
            .then(res => setData(res.data))
            .catch(() => setError('Failed to load stats'));
    }, []);

    if (error) return <div className="p-8 text-red-500 text-sm">{error}</div>;

    if (!data) {
        return (
            <div className="p-8">
                <Skeleton className="h-8 w-48 rounded-lg mb-8" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Overview</h1>
                <p className="text-sm text-muted-foreground mt-1">Platform-wide statistics</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Total Users" value={data.totalUsers} />
                <StatCard icon={Building2} label="Total Workspaces" value={data.totalWorkspaces} />
                <StatCard icon={Building2} label="Archived" value={data.archivedWorkspaces} accent="bg-orange-500" />
                <StatCard icon={TrendingUp} label="Active Workspaces" value={data.totalWorkspaces - data.archivedWorkspaces} accent="bg-primary" />
            </div>

            {/* Plan breakdown */}
            <div>
                <h2 className="text-base font-semibold text-foreground mb-3">Workspaces by Plan</h2>
                <div className="rounded-xl border border-border overflow-hidden">
                    {data.planBreakdown.map((row, idx) => (
                        <div
                            key={row.plan}
                            className={`flex items-center justify-between px-4 py-3 ${idx < data.planBreakdown.length - 1 ? 'border-b border-border' : ''}`}
                        >
                            <div className="flex items-center gap-2">
                                <Package size={14} className="text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">{row.display_name}</span>
                                <span className="text-xs text-muted-foreground font-mono">({row.plan})</span>
                            </div>
                            <span className="text-sm font-bold text-foreground">{row.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent registrations */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-foreground">Recent Registrations</h2>
                    <Link href="/admin/users" className="text-xs text-primary hover:text-primary/80 transition-colors">
                        View all →
                    </Link>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                    {data.recentRegistrations.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">No users yet.</div>
                    ) : (
                        data.recentRegistrations.map((u, idx) => (
                            <Link
                                key={u.id}
                                href={`/admin/users?highlight=${u.id}`}
                                className={`flex items-center gap-3 px-4 py-3 hover:bg-default/40 transition-colors ${idx < data.recentRegistrations.length - 1 ? 'border-b border-border' : ''}`}
                            >
                                <Avatar color="primary" className="w-8 h-8 text-xs shrink-0">
                                    <Avatar.Fallback>
                                        {`${u.fname?.[0] ?? ''}${u.lname?.[0] ?? ''}`.toUpperCase() || '?'}
                                    </Avatar.Fallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{u.fname} {u.lname}</p>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                </div>
                                {u.workspace_name && (
                                    <span className="text-xs text-muted-foreground truncate max-w-32">{u.workspace_name}</span>
                                )}
                                <span className="text-xs text-muted-foreground shrink-0">
                                    {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
