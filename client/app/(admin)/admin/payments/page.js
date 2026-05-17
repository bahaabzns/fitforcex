'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Skeleton } from '@heroui/react/skeleton';
import { Chip } from '@heroui/react/chip';
import { Button } from '@heroui/react/button';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

const STATUS_CHIP = {
    paid:     'bg-green-500/15 text-green-600',
    pending:  'bg-yellow-500/15 text-yellow-600',
    failed:   'bg-red-500/15 text-red-600',
    refunded: 'bg-orange-500/15 text-orange-600',
};

function StatCard({ label, value, sub, accent }) {
    return (
        <div className={`rounded-xl border p-4 flex flex-col gap-1 ${accent ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value ?? '—'}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
    );
}

export default function AdminPaymentsPage() {
    const [payments, setPayments]   = useState([]);
    const [stats, setStats]         = useState(null);
    const [total, setTotal]         = useState(0);
    const [page, setPage]           = useState(1);
    const [statusFilter, setStatus] = useState('');
    const [search, setSearch]       = useState('');
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [activating, setActivating] = useState(null);

    const limit      = 25;
    const totalPages = Math.ceil(total / limit);

    const fetchPayments = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/payments', { params: { page, limit, status: statusFilter, search } })
            .then(res => { setPayments(res.data.payments); setTotal(res.data.total); setError(''); })
            .catch(() => setError('Failed to load payments'))
            .finally(() => setLoading(false));
    }, [page, statusFilter, search]);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);
    useEffect(() => {
        api.get('/api/admin/payments/stats')
            .then(res => setStats(res.data))
            .catch(() => {});
    }, []);
    useEffect(() => { setPage(1); }, [statusFilter, search]);

    async function handleMarkPaid(paymentId) {
        setActivating(paymentId);
        try {
            await api.post(`/api/admin/payments/${paymentId}/mark-paid`);
            fetchPayments();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to activate');
        } finally {
            setActivating(null);
        }
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Payments</h1>
                <p className="text-sm text-muted-foreground mt-1">All coach subscription payments via Fawaterak</p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        label="Total Revenue"
                        value={`${Number(stats.total_revenue).toLocaleString()} EGP`}
                        accent
                    />
                    <StatCard label="Paid" value={stats.total_paid} />
                    <StatCard label="Pending" value={stats.total_pending} />
                    <StatCard label="Failed" value={stats.total_failed} />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative max-w-sm w-full">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        className="w-full pl-8 pr-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                        placeholder="Search workspace or email…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatus(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                >
                    <option value="">All statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                </select>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Workspace</span>
                    <span>Owner</span>
                    <span>Plan</span>
                    <span className="text-right">Amount</span>
                    <span>Status</span>
                    <span>Date</span>
                    <span></span>
                </div>

                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 border-t border-border rounded-none" />
                    ))
                ) : payments.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground border-t border-border">
                        No payments found.
                    </div>
                ) : (
                    payments.map((p, idx) => (
                        <div
                            key={p.id}
                            className={`grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''}`}
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{p.workspace_name}</p>
                                <p className="text-xs text-muted-foreground">/{p.workspace_slug}</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-foreground truncate">{p.owner_fname} {p.owner_lname}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.owner_email}</p>
                            </div>
                            <span className="text-sm text-foreground whitespace-nowrap">{p.plan_display}</span>
                            <span className="text-sm font-semibold text-foreground text-right whitespace-nowrap">
                                {Number(p.amount).toLocaleString()} {p.currency}
                            </span>
                            <Chip size="sm" className={STATUS_CHIP[p.fawaterak_status] ?? 'bg-secondary text-muted-foreground'}>
                                {p.fawaterak_status}
                            </Chip>
                            {p.fawaterak_status === 'pending' ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    isDisabled={activating === p.id}
                                    onClick={() => handleMarkPaid(p.id)}
                                    className="text-xs whitespace-nowrap"
                                >
                                    {activating === p.id ? 'Activating…' : 'Mark Paid'}
                                </Button>
                            ) : (
                                <span />
                            )}
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{total} payments · Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button isIconOnly variant="outline" size="sm" isDisabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                            <ChevronLeft size={15} />
                        </Button>
                        <Button isIconOnly variant="outline" size="sm" isDisabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                            <ChevronRight size={15} />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
