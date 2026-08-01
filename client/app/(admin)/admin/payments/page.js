'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { useDateFormatter } from '@/utils/useDateFormatter';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Modal } from '@heroui/react/modal';
import { ChevronLeft, ChevronRight, Search, Pencil } from 'lucide-react';

const STATUS_STYLES = {
    paid:     'bg-green-500/15 text-green-700 border-green-300',
    pending:  'bg-yellow-500/15 text-yellow-700 border-yellow-300',
    failed:   'bg-red-500/15 text-red-700 border-red-300',
    refunded: 'bg-orange-500/15 text-orange-700 border-orange-300',
};

const STATUSES = ['paid', 'pending', 'failed', 'refunded'];

function StatCard({ label, value, sub, accent }) {
    return (
        <div className={`rounded-xl border p-4 flex flex-col gap-1 ${accent ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value ?? '—'}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
    );
}

function EditPaymentModal({ payment, plans, onClose, onSaved }) {
    const isAddon = !!payment.addon_id;
    const [planId, setPlanId] = useState(payment.plan_id);
    const [variationId, setVariationId] = useState(payment.variation_id ?? '');
    const [amount, setAmount] = useState(String(payment.amount));
    const [currency, setCurrency] = useState(payment.currency);
    const [durationDays, setDurationDays] = useState(String(payment.duration_days));
    const [notes, setNotes] = useState(payment.notes ?? '');
    const [resync, setResync] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const variations = plans.find(p => p.id === planId)?.variations ?? [];
    const canResync = payment.fawaterak_status === 'paid' && !isAddon;

    function handlePlanChange(newPlanId) {
        setPlanId(newPlanId);
        const newVariations = plans.find(p => p.id === newPlanId)?.variations ?? [];
        setVariationId(newVariations.find(v => v.is_default)?.id ?? newVariations[0]?.id ?? '');
    }

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            await api.put(`/api/admin/payments/${payment.id}`, {
                amount:       amount === '' ? undefined : Number(amount),
                currency:     currency.trim() || undefined,
                durationDays: durationDays === '' ? undefined : parseInt(durationDays),
                notes,
                ...(isAddon ? {} : { planId, variationId: variationId || null }),
                resyncSubscription: canResync && resync,
                startDate:    (canResync && resync && startDate) ? startDate : undefined,
            });
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update payment');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal isOpen={true} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>Edit Payment</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            <p className="text-sm text-muted-foreground">{payment.workspace_name}</p>

                            {isAddon ? (
                                <p className="text-xs text-muted-foreground -mt-2">
                                    This is an add-on payment — plan/variation aren&apos;t editable here.
                                </p>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Plan</label>
                                        <select
                                            value={planId}
                                            onChange={e => handlePlanChange(e.target.value)}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                                        >
                                            {plans.map(p => (
                                                <option key={p.id} value={p.id}>{p.display_name} ({p.name})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Variation</label>
                                        <select
                                            value={variationId}
                                            onChange={e => setVariationId(e.target.value)}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                                        >
                                            {variations.map(v => (
                                                <option key={v.id} value={v.id}>{v.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Amount</label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Currency</label>
                                    <input
                                        type="text"
                                        value={currency}
                                        onChange={e => setCurrency(e.target.value)}
                                        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Days</label>
                                    <input
                                        type="number" min="1"
                                        value={durationDays}
                                        onChange={e => setDurationDays(e.target.value)}
                                        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                                />
                            </div>

                            {canResync && (
                                <>
                                    <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                                        <input type="checkbox" checked={resync} onChange={e => setResync(e.target.checked)} className="rounded mt-0.5" />
                                        <span>
                                            Also update this workspace&apos;s current subscription to match (price, plan/variation, and
                                            expiry recomputed from these corrected values). Leave unchecked to only fix this record.
                                        </span>
                                    </label>
                                    {resync && (
                                        <div className="flex flex-col gap-1.5 ml-6">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Start date <span className="opacity-60">(blank = keep the subscription&apos;s current start)</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={e => setStartDate(e.target.value)}
                                                className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button variant="primary" isDisabled={saving} onClick={handleSave}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

export default function AdminPaymentsPage() {
    const { formatDate } = useDateFormatter();
    const [payments, setPayments]   = useState([]);
    const [stats, setStats]         = useState(null);
    const [total, setTotal]         = useState(0);
    const [page, setPage]           = useState(1);
    const [statusFilter, setStatus] = useState('');
    const [search, setSearch]       = useState('');
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [changingStatus, setChangingStatus] = useState(null);
    const [plans, setPlans]         = useState([]);
    const [editingPayment, setEditingPayment] = useState(null);

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
    useEffect(() => { api.get('/api/admin/plans').then(res => setPlans(res.data)); }, []);
    useEffect(() => { setPage(1); }, [statusFilter, search]);

    async function handleStatusChange(paymentId, newStatus) {
        setChangingStatus(paymentId);
        try {
            await api.patch(`/api/admin/payments/${paymentId}/status`, { status: newStatus });
            fetchPayments();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update status');
        } finally {
            setChangingStatus(null);
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
                <div className="grid grid-cols-[1fr_1fr_120px_120px_110px_90px_32px] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                            className={`grid grid-cols-[1fr_1fr_120px_120px_110px_90px_32px] gap-4 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''}`}
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{p.workspace_name}</p>
                                <p className="text-xs text-muted-foreground">/{p.workspace_slug}</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-foreground truncate">{p.owner_fname} {p.owner_lname}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.owner_email}</p>
                            </div>
                            <span className="text-sm text-foreground min-w-0 truncate">{p.plan_display}</span>
                            <span className="text-sm font-semibold text-foreground text-right whitespace-nowrap">
                                {Number(p.amount).toLocaleString()} {p.currency}
                            </span>
                            <select
                                value={p.fawaterak_status}
                                disabled={changingStatus === p.id}
                                onChange={e => handleStatusChange(p.id, e.target.value)}
                                className={`text-xs font-medium rounded-full px-2.5 py-1 border cursor-pointer outline-none disabled:opacity-50 disabled:cursor-wait ${STATUS_STYLES[p.fawaterak_status] ?? 'bg-secondary text-muted-foreground border-border'}`}
                            >
                                {STATUSES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(p.created_at)}
                            </span>
                            <button
                                onClick={() => setEditingPayment(p)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors justify-self-end"
                                title="Edit payment"
                            >
                                <Pencil size={14} />
                            </button>
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

            {editingPayment && (
                <EditPaymentModal
                    payment={editingPayment}
                    plans={plans}
                    onClose={() => setEditingPayment(null)}
                    onSaved={fetchPayments}
                />
            )}
        </div>
    );
}
