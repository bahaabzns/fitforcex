"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, RotateCcw, RotateCw, Trash2, Receipt, CheckCircle2, CreditCard, DollarSign, History } from "lucide-react";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import Modal from "@/app/components/Modal";
import DataTable from "@/app/components/DataTable";
import TransactionModal from "@/app/components/TransactionModal";
import ImagePreview from "@/app/components/ImagePreview";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Tooltip } from "@heroui/react/tooltip";

const EXCHANGE_RATES = { EGP: 1, USD: 50.5, SAR: 13.47, EUR: 55.2, GBP: 64.1 };

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

function todayStr() { return new Date().toISOString().split("T")[0]; }

function StatusBadge({ status }) {
    const cls = status === "completed"
        ? "bg-green-500/15 text-green-600"
        : "bg-destructive/10 text-destructive";
    return (
        <Chip size="sm" className={`capitalize ${cls}`}>
            {status}
        </Chip>
    );
}

function KpiCard({ icon: Icon, iconBg, iconColor, title, value, subValue, chipValue, chipColor }) {
    return (
        <Card>
            <Card.Content className="px-3">
                <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                        <Icon size={16} className={iconColor} />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
                </div>
                <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-2xl font-bold text-foreground leading-none tracking-tight">{value}</p>
                        {subValue && <p className="text-xs text-muted-foreground mt-1.5 truncate">{subValue}</p>}
                    </div>
                    {chipValue != null && (
                        <Chip size="sm" color={chipColor ?? "default"} variant="soft" className="shrink-0">
                            {chipValue}
                        </Chip>
                    )}
                </div>
            </Card.Content>
        </Card>
    );
}

function subStatusColor(s) {
    switch (s) {
        case "Active":    return "bg-green-500/15 text-green-600";
        case "Expired":   return "bg-destructive/10 text-destructive";
        case "Frozen":    return "bg-accent/15 text-accent";
        case "Pre-start": return "bg-yellow-500/15 text-yellow-600";
        case "Refunded":  return "bg-purple-500/15 text-purple-600";
        default:          return "bg-secondary text-muted-foreground";
    }
}

function getPerTxStatus(tx, timeline, freezes, today) {
    if (tx.status === "refunded") return "Refunded";
    if (!tx.duration || tx.duration <= 0) return null;
    const period = timeline.find(p => p.tx.id === tx.id);
    if (!period) return "Pre-start";
    const { start, end } = period;
    if (today < start) return "Pre-start";
    if (today >= end) return "Expired";
    for (const f of freezes) {
        const fs = new Date(f.freezeStartDate); fs.setHours(0, 0, 0, 0);
        const fe = new Date(fs.getTime() + f.freezeDurationDays * 86400000);
        if (today >= fs && today < fe) return "Frozen";
    }
    return "Active";
}

// Build subscription timeline from transactions + freezes (camelCase fields from API)
function computeTimeline(transactions, freezes, firstPlanActivatedAt) {
    const completed = [...transactions]
        .filter(t => t.status === "completed" && t.duration > 0)
        .sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));

    if (completed.length === 0) return [];

    const periods = [];
    let prevEnd = null;

    for (const tx of completed) {
        let start;
        const mode = tx.startMode || "on_first_plan";

        if (mode === "custom" && tx.subscriptionStartDate) {
            start = new Date(tx.subscriptionStartDate);
        } else if (prevEnd !== null) {
            start = new Date(prevEnd);
        } else if (firstPlanActivatedAt) {
            start = new Date(firstPlanActivatedAt);
        } else {
            // on_first_plan with no activation yet — period not determinable
            continue;
        }
        start.setHours(0, 0, 0, 0);

        let endMs = start.getTime() + tx.duration * 24 * 60 * 60 * 1000;

        for (const freeze of freezes) {
            const fs = new Date(freeze.freezeStartDate);
            fs.setHours(0, 0, 0, 0);
            if (fs >= start && fs.getTime() < endMs) {
                endMs += freeze.freezeDurationDays * 24 * 60 * 60 * 1000;
            }
        }

        periods.push({ tx, start, end: new Date(endMs) });
        prevEnd = new Date(endMs);
    }

    return periods;
}

export default function ClientTransactionsPage() {
    const { id, workspaceSlug } = useParams();
    const t = useTranslations('clientTransactions');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const { formatDate, formatDateTime } = useDateFormatter();

    const [transactions, setTransactions]     = useState([]);
    const [packages, setPackages]             = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [freezes, setFreezes]               = useState([]);
    const [firstPlanActivatedAt, setFirstPlanActivatedAt] = useState(null);
    const [clientName, setClientName]         = useState("");
    const [loading, setLoading]               = useState(true);

    // Transaction add/edit modals — the shared TransactionModal owns the form.
    const [showAddModal, setShowAddModal]     = useState(false);
    const [editingTx, setEditingTx]           = useState(null);

    // Freeze modal — editingFreeze null = add mode, freeze object = edit mode
    const [showFreezeModal, setShowFreezeModal] = useState(false);
    const [editingFreeze, setEditingFreeze]     = useState(null);
    const [freezeStartDate, setFreezeStartDate] = useState(todayStr());
    const [freezeDays, setFreezeDays]           = useState("");
    const [freezeNotes, setFreezeNotes]         = useState("");
    const [freezeError, setFreezeError]         = useState("");
    const [freezeSaving, setFreezeSaving]       = useState(false);

    // Freeze history modal
    const [showFreezeHistoryModal, setShowFreezeHistoryModal] = useState(false);
    const [freezeHistory, setFreezeHistory]               = useState([]);
    const [freezeHistoryLoading, setFreezeHistoryLoading] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get(`/api/transactions/by-client/${id}`),
            api.get("/api/packages"),
            api.get("/api/payment-methods"),
            api.get(`/api/clients/${id}/freezes`),
            api.get(`/api/clients/${id}`),
        ]).then(([txRes, pkgRes, pmRes, freezeRes, clientRes]) => {
            setTransactions(txRes.data ?? []);
            setPackages(pkgRes.data ?? []);
            setPaymentMethods((pmRes.data ?? []).filter(m => m.active));
            setFreezes(freezeRes.data ?? []);
            setFirstPlanActivatedAt(clientRes.data?.firstPlanActivatedAt ?? null);
            setClientName(clientRes.data ? `${clientRes.data.fname} ${clientRes.data.lname}` : "");
        }).catch(console.error).finally(() => setLoading(false));
    }, [id]);

    function fmtDate(d) {
        return formatDate(d) || "—";
    }

    const packageVariationOptions = packages.flatMap(p =>
        p.variations.map(v => ({
            key: `${p.name} — ${v.name}`,
            label: `${p.name} — ${v.name}`,
            duration: v.duration,
            price: Number(v.price),
            currency: v.currency,
        }))
    );
    const paymentMethodOptions = paymentMethods.map(m => m.name);

    const transactionColumns = [
        {
            key: "date",
            label: t('colTxDate'),
            sortable: true,
            filterType: "dateRange",
            cardPriority: "primary",
            render: (tx) => (
                <span className="text-muted-foreground whitespace-nowrap">{fmtDate(tx.date)}</span>
            ),
        },
        {
            key: "packageVariation",
            label: t('colPackage'),
            sortable: true,
            filterType: "multi",
            options: packageVariationOptions.map(p => p.label),
            cardPriority: "primary",
            render: (tx) => (
                <span className="text-foreground max-w-40 truncate block">{tx.packageVariation || "—"}</span>
            ),
        },
        {
            key: "subscriptionStartDate",
            label: t('colSubStart'),
            render: (tx) =>
                tx.startMode === "custom" && tx.subscriptionStartDate ? (
                    <span className="text-foreground whitespace-nowrap">{fmtDate(tx.subscriptionStartDate)}</span>
                ) : tx.startMode === "queued" ? (
                    <span className="text-muted-foreground italic text-xs whitespace-nowrap">{t('queued')}</span>
                ) : (
                    <span className="text-muted-foreground italic text-xs whitespace-nowrap">{t('onFirstPlan')}</span>
                ),
        },
        {
            key: "subStatus",
            label: t('colSubStatus'),
            render: (tx) => {
                const s = getPerTxStatus(tx, timeline, freezes, today);
                const SUB_STATUS_LABELS = {
                    Active: t('statusActive'), Expired: t('statusExpired'),
                    Frozen: t('statusFrozen'), "Pre-start": t('statusPreStart'),
                    Refunded: t('statusRefunded'),
                };
                return s
                    ? <Chip size="sm" className={subStatusColor(s)}>{SUB_STATUS_LABELS[s] ?? s}</Chip>
                    : <span className="text-muted-foreground text-xs">—</span>;
            },
        },
        {
            key: "amount",
            label: t('colAmount'),
            sortable: true,
            cardPriority: "primary",
            render: (tx) => (
                <span className="font-medium text-foreground whitespace-nowrap">
                    {tx.amount.toLocaleString()} {tx.currency}
                </span>
            ),
        },
        {
            key: "duration",
            label: t('colDuration'),
            sortable: true,
            render: (tx) => (
                <span className="text-muted-foreground whitespace-nowrap">
                    {tx.duration ? t('durationDays', { count: tx.duration }) : "—"}
                </span>
            ),
        },
        {
            key: "paymentMethod",
            label: t('colMethod'),
            sortable: true,
            filterType: "multi",
            options: paymentMethodOptions,
            render: (tx) => (
                <span className="text-muted-foreground whitespace-nowrap">{tx.paymentMethod}</span>
            ),
        },
        {
            key: "type",
            label: t('colType'),
            render: (tx) => (
                <span className="text-muted-foreground capitalize">{tx.type}</span>
            ),
        },
        {
            key: "status",
            label: t('colPayStatus'),
            filterType: "multi",
            options: ["completed", "refunded"],
            render: (tx) => <StatusBadge status={tx.status} />,
        },
        {
            key: "proofImage",
            label: t('colProof'),
            cardPriority: "hidden",
            render: (tx) =>
                tx.proofImage ? (
                    <ImagePreview
                        src={`${process.env.NEXT_PUBLIC_API_URL}${tx.proofImage}`}
                        alt={t('colProof')}
                        isPdf={/\.pdf$/i.test(tx.proofImage)}
                        title={t('view')}
                        triggerClassName="text-xs text-primary hover:underline"
                    >
                        <span className="text-xs text-primary hover:underline">{t('view')}</span>
                    </ImagePreview>
                ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                ),
        },
        {
            key: "actions",
            label: "",
            cardPriority: "hidden",
            render: (tx) => (
                <div className="flex items-center gap-1 justify-end whitespace-nowrap">
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('edit')} onClick={() => openEdit(tx)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{tCommon('edit')}</Tooltip.Content>
                    </Tooltip>
                    {tx.status === "completed" && (
                        <Tooltip>
                            <Button isIconOnly size="sm" variant="ghost" aria-label={t('refundAction')} className="text-orange-500 hover:text-orange-600" onClick={() => handleRefund(tx)}>
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Tooltip.Content>{t('refundAction')}</Tooltip.Content>
                        </Tooltip>
                    )}
                    {tx.status === "refunded" && (
                        <Tooltip>
                            <Button isIconOnly size="sm" variant="ghost" aria-label={t('undoRefundAction')} className="text-emerald-600 hover:text-emerald-700" onClick={() => handleUndoRefund(tx)}>
                                <RotateCw className="h-4 w-4" />
                            </Button>
                            <Tooltip.Content>{t('undoRefundAction')}</Tooltip.Content>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('delete')} className="text-destructive hover:text-red-700" onClick={() => handleDelete(tx)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{tCommon('delete')}</Tooltip.Content>
                    </Tooltip>
                </div>
            ),
        },
    ];

    function openEdit(tx) {
        setEditingTx(tx);
    }

    // Does this client already have a completed subscription (optionally excluding one
    // transaction)? Drives the shared modal's start label — first subscription shows
    // "on first plan activation", otherwise "queue after current subscription".
    function clientHasSubscription(excludeTxId) {
        return transactions.some(tx => tx.id !== excludeTxId && tx.status === "completed" && tx.duration > 0);
    }

    async function handleDelete(tx) {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            await api.delete(`/api/transactions/${tx.id}`);
            setTransactions(prev => prev.filter(item => item.id !== tx.id));
        } catch (err) {
            console.error(err);
        }
    }

    async function handleRefund(tx) {
        try {
            const res = await api.put(`/api/transactions/${tx.id}`, { status: "refunded" });
            setTransactions(prev => prev.map(item => item.id === tx.id ? res.data : item));
        } catch (err) {
            console.error(err);
        }
    }

    async function handleUndoRefund(tx) {
        try {
            const res = await api.put(`/api/transactions/${tx.id}`, { status: "completed" });
            setTransactions(prev => prev.map(item => item.id === tx.id ? res.data : item));
        } catch (err) {
            console.error(err);
        }
    }

    function openAddFreeze() {
        setEditingFreeze(null);
        setFreezeStartDate(todayStr());
        setFreezeDays("");
        setFreezeNotes("");
        setFreezeError("");
        setShowFreezeModal(true);
    }

    function openEditFreeze(freeze) {
        setEditingFreeze(freeze);
        setFreezeStartDate(new Date(freeze.freezeStartDate).toISOString().split("T")[0]);
        setFreezeDays(String(freeze.freezeDurationDays));
        setFreezeNotes(freeze.notes || "");
        setFreezeError("");
        setShowFreezeModal(true);
    }

    async function handleSaveFreeze(e) {
        e.preventDefault();
        if (!freezeStartDate || !freezeDays || Number(freezeDays) <= 0) {
            setFreezeError(t('freezeValidationError'));
            return;
        }
        setFreezeSaving(true);
        try {
            if (editingFreeze) {
                const res = await api.patch(`/api/clients/${id}/freezes/${editingFreeze.id}`, {
                    freezeStartDate,
                    freezeDurationDays: Number(freezeDays),
                });
                setFreezes(prev => prev.map(f => f.id === res.data.id ? res.data : f));
            } else {
                const res = await api.post(`/api/clients/${id}/freezes`, {
                    freezeStartDate,
                    freezeDurationDays: Number(freezeDays),
                    notes: freezeNotes || null,
                });
                setFreezes(prev => [...prev, res.data]);
            }
            setShowFreezeModal(false);
            setEditingFreeze(null);
            setFreezeStartDate(todayStr());
            setFreezeDays("");
            setFreezeNotes("");
            setFreezeError("");
        } catch (err) {
            setFreezeError(err.response?.data?.error || t('freezeError'));
        } finally {
            setFreezeSaving(false);
        }
    }

    async function handleDeleteFreeze(freeze) {
        if (!confirm(t('deleteFreezeConfirm'))) return;
        try {
            await api.delete(`/api/clients/${id}/freezes/${freeze.id}`);
            setFreezes(prev => prev.filter(f => f.id !== freeze.id));
        } catch (err) {
            console.error(err);
        }
    }

    function openFreezeHistory() {
        setShowFreezeHistoryModal(true);
        setFreezeHistoryLoading(true);
        api.get(`/api/clients/${id}/freezes/history`)
            .then(res => setFreezeHistory(res.data ?? []))
            .catch(() => setFreezeHistory([]))
            .finally(() => setFreezeHistoryLoading(false));
    }

    function freezeHistoryLabel(ev) {
        switch (ev.eventType) {
            case "freeze.create": return t('freezeHistoryCreated');
            case "freeze.update": return t('freezeHistoryEdited');
            case "freeze.remove": return t('freezeHistoryRemoved');
            default:               return ev.eventType;
        }
    }

    const completedTx = transactions.filter(tx => tx.status === "completed");
    const refundedTx  = transactions.filter(tx => tx.status === "refunded");

    const byCurrency = completedTx.reduce((acc, tx) => {
        acc[tx.currency] = (acc[tx.currency] || 0) + tx.amount;
        return acc;
    }, {});

    const totalEGP = completedTx.reduce((sum, tx) => {
        const rate = EXCHANGE_RATES[tx.currency] ?? 1;
        return sum + tx.amount * rate;
    }, 0);

    const timeline = computeTimeline(transactions, freezes, firstPlanActivatedAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the currently active or next upcoming period
    const activePeriod = timeline.find(p => today >= p.start && today < p.end) ?? null;
    const nextPeriod   = !activePeriod ? timeline.find(p => today < p.start) ?? null : null;
    const lastPeriod   = timeline[timeline.length - 1] ?? null;

    const hasNoSubscriptions = transactions.length === 0;
    const isExpired = lastPeriod && today >= lastPeriod.end;
    const isPreStart = !hasNoSubscriptions && (timeline.length === 0 || (nextPeriod !== null && !activePeriod));
    const isFrozen = activePeriod && freezes.some(f => {
        const fs = new Date(f.freezeStartDate); fs.setHours(0, 0, 0, 0);
        const fe = new Date(fs.getTime() + f.freezeDurationDays * 24 * 60 * 60 * 1000);
        return today >= fs && today < fe;
    });

    const displayPeriod = activePeriod ?? nextPeriod ?? lastPeriod;

    if (loading) {
        return (
            <div className="h-full overflow-y-auto">
                <div className="flex flex-col gap-4 pb-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
        <div className="flex flex-col gap-6 pb-6">
            {/* Header */}
            <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard
                    icon={CreditCard}
                    iconBg="bg-purple-500/15"
                    iconColor="text-purple-500"
                    title={t('total')}
                    value={transactions.length}
                />
                <KpiCard
                    icon={CheckCircle2}
                    iconBg="bg-green-500/15"
                    iconColor="text-green-500"
                    title={t('completed')}
                    value={completedTx.length}
                    chipValue={transactions.length > 0 ? `${Math.round(completedTx.length / transactions.length * 100)}%` : null}
                    chipColor="success"
                />
                <KpiCard
                    icon={RotateCcw}
                    iconBg="bg-destructive/15"
                    iconColor="text-destructive"
                    title={t('refunded')}
                    value={refundedTx.length}
                    chipValue={transactions.length > 0 ? `${Math.round(refundedTx.length / transactions.length * 100)}%` : null}
                    chipColor={refundedTx.length > 0 ? "danger" : "default"}
                />
                <KpiCard
                    icon={DollarSign}
                    iconBg="bg-yellow-500/15"
                    iconColor="text-yellow-500"
                    title={t('revenue')}
                    value={totalEGP.toLocaleString(locale, { maximumFractionDigits: 0 })}
                    subValue={Object.entries(byCurrency).map(([cur, amt]) => `${amt.toLocaleString()} ${cur}`).join(" · ") || null}
                />
            </div>

            {/* Subscription Status Card */}
            {(displayPeriod || isPreStart || hasNoSubscriptions) && (
                <div className={`rounded-lg bg-card text-card-foreground shadow-sm p-6 border ${
                    hasNoSubscriptions ? "border-border bg-background" :
                    isFrozen   ? "border-accent/30 bg-accent/5" :
                    isExpired  ? "border-destructive/30 bg-destructive/5" :
                    isPreStart ? "border-yellow-500/30 bg-yellow-500/5" :
                                 "border-green-600/30 bg-green-100/5"
                }`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground font-medium">
                                {hasNoSubscriptions ? t('subStatusNone') :
                                 isExpired ? t('subStatusExpired') :
                                 isFrozen  ? t('subStatusFrozen') :
                                 isPreStart ? t('subStatusPreStart') :
                                              t('subStatusActive')}
                            </p>
                            {displayPeriod && (
                                <>
                                    <p className={`text-lg font-bold mt-1 ${
                                        isFrozen   ? "text-accent" :
                                        isExpired  ? "text-destructive" :
                                        isPreStart ? "text-yellow-600" :
                                                     "text-green-600"
                                    }`}>
                                        {fmtDate(displayPeriod.start)} — {fmtDate(displayPeriod.end)}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {displayPeriod.tx.packageVariation} · {t('durationDays', { count: displayPeriod.tx.duration })}
                                        {freezes.length > 0 && ` ${t('freezeDaysIncluded', { count: freezes.reduce((s, f) => s + f.freezeDurationDays, 0) })}`}
                                    </p>
                                </>
                            )}
                            {hasNoSubscriptions && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('subNoRecorded')}
                                </p>
                            )}
                            {isPreStart && !displayPeriod && (
                                <p className="text-sm text-yellow-600 mt-1">
                                    {firstPlanActivatedAt
                                        ? t('subStartsOn', { date: fmtDate(firstPlanActivatedAt) })
                                        : t('subWaitingActivation')}
                                </p>
                            )}
                            {/* Queue */}
                            {timeline.length > 1 && (
                                <div className="mt-2 flex flex-col gap-0.5">
                                    {timeline.map((p, i) => (
                                        <p key={i} className="text-xs text-muted-foreground">
                                            {i + 1}. {fmtDate(p.start)} — {fmtDate(p.end)}
                                            {today >= p.start && today < p.end
                                                ? ` ${t('timelineCurrent')}`
                                                : today < p.start
                                                    ? ` ${t('timelineQueued')}`
                                                    : ` ${t('timelineExpired')}`}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={openAddFreeze}
                            className="text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer whitespace-nowrap"
                        >
                            {t('freezeButton')}
                        </button>
                    </div>

                    {/* Active freezes list */}
                    {freezes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">{t('freezesLabel')}</p>
                                <button
                                    onClick={openFreezeHistory}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <History className="h-3 w-3" />
                                    {t('freezeHistoryButton')}
                                </button>
                            </div>
                            {freezes.map(f => (
                                <div key={f.id} className="flex items-center gap-2 text-xs text-foreground">
                                    <span className="flex-1">
                                        {fmtDate(f.freezeStartDate)} · {t('durationDays', { count: f.freezeDurationDays })}
                                        {f.notes && <span className="text-muted-foreground"> — {f.notes}</span>}
                                    </span>
                                    <button
                                        onClick={() => openEditFreeze(f)}
                                        className="text-primary hover:text-primary/80 transition-colors cursor-pointer"
                                    >
                                        {t('editFreeze')}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteFreeze(f)}
                                        className="text-destructive hover:text-red-700 transition-colors cursor-pointer"
                                    >
                                        {t('removeFreeze')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Transactions Table */}
            <DataTable
                columns={transactionColumns}
                data={transactions}
                rowKey="id"
                scrollable
                defaultSort="date"
                defaultSortDirection="desc"
                dateParser={(d) => new Date(d)}
                quickSearch={{ fields: ["packageVariation", "paymentMethod", "status"], placeholder: t('searchPlaceholder') }}
                emptyState={{
                    icon: Receipt,
                    title: t('emptyTitle'),
                    description: t('emptyHint'),
                    action: { label: t('addTransactionButton'), onPress: () => setShowAddModal(true) },
                }}
                toolbarEnd={<Button size="sm" variant="primary" onClick={() => setShowAddModal(true)}>{t('addTransactionButton')}</Button>}
            />

            {/* Add / Edit Transaction — shared modal */}
            <TransactionModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                clients={[{ id, name: clientName }]}
                packages={packages}
                paymentMethods={paymentMethods}
                getClientHasSubscription={() => clientHasSubscription()}
                onSuccess={(created) => setTransactions(prev => [...created, ...prev])}
            />

            <TransactionModal
                open={!!editingTx}
                onClose={() => setEditingTx(null)}
                mode="edit"
                transaction={editingTx}
                clients={[{ id, name: clientName }]}
                packages={packages}
                paymentMethods={paymentMethods}
                getClientHasSubscription={() => clientHasSubscription(editingTx?.id)}
                onSuccess={(updated) => setTransactions(prev => prev.map(tx => tx.id === updated.id ? updated : tx))}
            />

            {/* Freeze Modal — add or edit, based on editingFreeze */}
            <Modal open={showFreezeModal} onClose={() => setShowFreezeModal(false)} title={editingFreeze ? t('editFreezeTitle') : t('addFreezeTitle')}>
                <form onSubmit={handleSaveFreeze} className="flex flex-col gap-3">
                    {freezeError && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{freezeError}</p>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('freezeStartDateLabel')} *</label>
                        <input
                            type="date"
                            value={freezeStartDate}
                            onChange={e => setFreezeStartDate(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('freezeDurationLabel')} *</label>
                        <input
                            type="number"
                            min="1"
                            placeholder={t('freezeDurationPlaceholder')}
                            value={freezeDays}
                            onChange={e => setFreezeDays(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    {editingFreeze ? (
                        freezeNotes && (
                            <p className="text-xs text-muted-foreground">
                                {t('notesLabel')}: {freezeNotes}
                            </p>
                        )
                    ) : (
                        <div>
                            <label className="block text-sm text-muted-foreground mb-1">{t('notesLabel')} <span className="text-muted-foreground/60">({tCommon('optional')})</span></label>
                            <textarea
                                rows={2}
                                value={freezeNotes}
                                onChange={e => setFreezeNotes(e.target.value)}
                                placeholder={t('freezeReasonPlaceholder')}
                                className={`${inputCls} resize-none`}
                            />
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {t('freezeDescription')}
                    </p>
                    <Button type="submit" isDisabled={freezeSaving} variant="primary" fullWidth>
                        {freezeSaving ? t('saving') : (editingFreeze ? t('saveChanges') : t('addFreeze'))}
                    </Button>
                </form>
            </Modal>

            {/* Freeze History Modal — immutable audit trail, never edited/removed */}
            <Modal open={showFreezeHistoryModal} onClose={() => setShowFreezeHistoryModal(false)} title={t('freezeHistoryTitle')}>
                {freezeHistoryLoading ? (
                    <div className="flex flex-col gap-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
                    </div>
                ) : freezeHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('freezeHistoryEmpty')}</p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {freezeHistory.map(ev => (
                            <li key={ev.id} className="flex items-start gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-foreground">{freezeHistoryLabel(ev)}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {ev.actorName || (ev.actorType === "system" ? t('freezeHistorySystemActor') : t('freezeHistoryUnknownActor'))} · {formatDateTime(ev.createdAt)}
                                    </p>
                                    {ev.before && ev.after ? (
                                        <div className="mt-1 text-xs text-muted-foreground flex flex-col gap-0.5">
                                            {ev.before.freezeDurationDays !== ev.after.freezeDurationDays && (
                                                <p>{t('freezeHistoryDurationChange', { from: ev.before.freezeDurationDays, to: ev.after.freezeDurationDays })}</p>
                                            )}
                                            {ev.before.freezeStartDate !== ev.after.freezeStartDate && (
                                                <p>{t('freezeHistoryStartDateChange', { from: fmtDate(ev.before.freezeStartDate), to: fmtDate(ev.after.freezeStartDate) })}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {fmtDate((ev.after ?? ev.before).freezeStartDate)} · {t('durationDays', { count: (ev.after ?? ev.before).freezeDurationDays })}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Modal>
        </div>
        </div>
    );
}
