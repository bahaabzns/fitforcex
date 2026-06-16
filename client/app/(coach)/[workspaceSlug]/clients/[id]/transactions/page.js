"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel, FieldErrorText } from "@/app/components/Field";
import DatePickerField, { strToDate } from "@/app/components/DatePickerField";
import ProofDropZone from "@/app/components/ProofDropZone";
import DataTable from "@/app/components/DataTable";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { TextArea } from "@heroui/react/textarea";

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
    const { id } = useParams();
    const t = useTranslations('clientTransactions');
    const tCommon = useTranslations('common');
    const locale = useLocale();

    const [transactions, setTransactions]     = useState([]);
    const [packages, setPackages]             = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [freezes, setFreezes]               = useState([]);
    const [firstPlanActivatedAt, setFirstPlanActivatedAt] = useState(null);
    const [clientName, setClientName]         = useState("");
    const [loading, setLoading]               = useState(true);

    // Add modal
    const [showAddModal, setShowAddModal]     = useState(false);
    const [addPkgKey, setAddPkgKey]           = useState("");
    const [addPkg, setAddPkg]                 = useState(null);
    const [addMethod, setAddMethod]           = useState("");
    const [addDate, setAddDate]               = useState(todayStr());
    const [addSubStartDate, setAddSubStartDate] = useState("");
    const [addNotes, setAddNotes]             = useState("");
    const [addProofFile, setAddProofFile]     = useState(null);
    const [addError, setAddError]             = useState("");
    const [addSaving, setAddSaving]           = useState(false);

    // Edit modal
    const [editingTx, setEditingTx]           = useState(null);
    const [showEditModal, setShowEditModal]   = useState(false);
    const [editPkgKey, setEditPkgKey]         = useState("");
    const [editPkg, setEditPkg]               = useState(null);
    const [editMethod, setEditMethod]         = useState("");
    const [editDate, setEditDate]             = useState("");
    const [editSubStartDate, setEditSubStartDate] = useState("");
    const [editNotes, setEditNotes]           = useState("");
    const [editProofFile, setEditProofFile]   = useState(null);
    const [editProofUrl, setEditProofUrl]     = useState(null);
    const [editError, setEditError]           = useState("");
    const [saving, setSaving]                 = useState(false);

    // Freeze modal
    const [showFreezeModal, setShowFreezeModal] = useState(false);
    const [freezeStartDate, setFreezeStartDate] = useState(todayStr());
    const [freezeDays, setFreezeDays]           = useState("");
    const [freezeNotes, setFreezeNotes]         = useState("");
    const [freezeError, setFreezeError]         = useState("");
    const [freezeSaving, setFreezeSaving]       = useState(false);

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
        return d
            ? new Date(d).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
            : "—";
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
                    <a
                        href={`${process.env.NEXT_PUBLIC_API_URL}${tx.proofImage}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                    >
                        {t('view')}
                    </a>
                ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                ),
        },
        {
            key: "actions",
            label: "",
            cardPriority: "hidden",
            render: (tx) => (
                <div className="flex items-center gap-2 justify-end">
                    <button
                        onClick={() => openEdit(tx)}
                        className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    >
                        {tCommon('edit')}
                    </button>
                    {tx.status === "completed" && (
                        <button
                            onClick={() => handleRefund(tx)}
                            className="text-xs text-orange-500 hover:text-orange-700 transition-colors cursor-pointer"
                        >
                            {t('refundAction')}
                        </button>
                    )}
                    <button
                        onClick={() => handleDelete(tx)}
                        className="text-xs text-destructive hover:text-red-700 transition-colors cursor-pointer"
                    >
                        {tCommon('delete')}
                    </button>
                </div>
            ),
        },
    ];

    function openEdit(tx) {
        const found = packageVariationOptions.find(p => p.key === tx.packageVariation);
        setEditingTx(tx);
        setEditPkgKey(tx.packageVariation || "");
        setEditPkg(found || null);
        setEditMethod(tx.paymentMethod || "");
        setEditDate(tx.date ? tx.date.split("T")[0] : todayStr());
        setEditSubStartDate(tx.subscriptionStartDate ? tx.subscriptionStartDate.split("T")[0] : "");
        setEditNotes(tx.notes || "");
        setEditProofFile(null);
        setEditProofUrl(tx.proofImage || null);
        setEditError("");
        setShowEditModal(true);
    }

    function closeEdit() {
        setShowEditModal(false);
        setEditingTx(null);
        setEditProofFile(null);
    }

    function openAdd() {
        setAddPkgKey(""); setAddPkg(null); setAddMethod("");
        setAddDate(todayStr()); setAddSubStartDate(""); setAddNotes("");
        setAddProofFile(null); setAddError("");
        setShowAddModal(true);
    }

    async function handleAdd(e) {
        e.preventDefault();
        if (!addPkgKey || !addPkg) { setAddError(t('errorPackageRequired')); return; }
        if (!addMethod) { setAddError(t('errorMethodRequired')); return; }
        setAddSaving(true);
        setAddError("");
        try {
            let proofImage = null;
            if (addProofFile) {
                const fd = new FormData();
                fd.append("proof", addProofFile);
                const up = await api.post("/api/transactions/upload-proof", fd);
                proofImage = up.data.path;
            }
            const res = await api.post("/api/transactions", {
                clientId: id,
                clientName,
                packageVariation: addPkgKey,
                paymentMethod: addMethod,
                amount: addPkg.price,
                currency: addPkg.currency,
                duration: addPkg.duration,
                type: "subscription",
                status: "completed",
                date: addDate,
                subscriptionStartDate: addSubStartDate || null,
                notes: addNotes || null,
                proofImage,
            });
            setTransactions(prev => [res.data, ...prev]);
            setShowAddModal(false);
        } catch (err) {
            setAddError(err.response?.data?.error || t('errorAddFailed'));
        } finally {
            setAddSaving(false);
        }
    }

    async function handleEdit(e) {
        e.preventDefault();
        if (!editPkgKey) { setEditError(t('errorPackageRequired')); return; }
        setSaving(true);
        setEditError("");
        try {
            let proofImage = editProofUrl;
            if (editProofFile) {
                const fd = new FormData();
                fd.append("proof", editProofFile);
                const up = await api.post("/api/transactions/upload-proof", fd);
                proofImage = up.data.path;
            }

            const res = await api.put(`/api/transactions/${editingTx.id}`, {
                packageVariation: editPkgKey,
                paymentMethod: editMethod,
                amount: editPkg?.price ?? editingTx.amount,
                currency: editPkg?.currency ?? editingTx.currency,
                duration: editPkg?.duration ?? editingTx.duration,
                date: editDate,
                subscriptionStartDate: editSubStartDate || null,
                notes: editNotes || null,
                proofImage,
                type: editingTx.type,
                status: editingTx.status,
            });
            setTransactions(prev => prev.map(tx => tx.id === editingTx.id ? res.data : tx));
            closeEdit();
        } catch (err) {
            setEditError(err.response?.data?.error || t('errorSaveFailed'));
        } finally {
            setSaving(false);
        }
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

    async function handleAddFreeze(e) {
        e.preventDefault();
        if (!freezeStartDate || !freezeDays || Number(freezeDays) <= 0) {
            setFreezeError(t('freezeValidationError'));
            return;
        }
        setFreezeSaving(true);
        try {
            const res = await api.post(`/api/clients/${id}/freezes`, {
                freezeStartDate,
                freezeDurationDays: Number(freezeDays),
                notes: freezeNotes || null,
            });
            setFreezes(prev => [...prev, res.data]);
            setShowFreezeModal(false);
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
            <div className="p-8 flex flex-col gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            {/* Header */}
            <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><Card.Content className="p-6">
                    <p className="text-xs text-muted-foreground font-medium">{t('total')}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{transactions.length}</p>
                </Card.Content></Card>
                <Card><Card.Content className="p-6">
                    <p className="text-xs text-muted-foreground font-medium">{t('completed')}</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{completedTx.length}</p>
                </Card.Content></Card>
                <Card><Card.Content className="p-6">
                    <p className="text-xs text-muted-foreground font-medium">{t('refunded')}</p>
                    <p className="text-2xl font-bold text-destructive mt-1">{refundedTx.length}</p>
                </Card.Content></Card>
                <Card><Card.Content className="p-6">
                    <p className="text-xs text-muted-foreground font-medium">{t('revenue')}</p>
                    <p className="text-2xl font-bold text-primary mt-1">
                        {totalEGP.toLocaleString(locale, { maximumFractionDigits: 0 })}
                    </p>
                    {Object.keys(byCurrency).length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-1">
                            {Object.entries(byCurrency).map(([cur, amt]) => (
                                <span key={cur} className="text-xs text-muted-foreground">{amt.toLocaleString()} {cur}</span>
                            ))}
                        </div>
                    )}
                </Card.Content></Card>
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
                            onClick={() => {
                                setFreezeStartDate(todayStr());
                                setFreezeDays("");
                                setFreezeNotes("");
                                setFreezeError("");
                                setShowFreezeModal(true);
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer whitespace-nowrap"
                        >
                            {t('freezeButton')}
                        </button>
                    </div>

                    {/* Active freezes list */}
                    {freezes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5">
                            <p className="text-xs font-medium text-muted-foreground">{t('freezesLabel')}</p>
                            {freezes.map(f => (
                                <div key={f.id} className="flex items-center gap-2 text-xs text-foreground">
                                    <span className="flex-1">
                                        {fmtDate(f.freezeStartDate)} · {t('durationDays', { count: f.freezeDurationDays })}
                                        {f.notes && <span className="text-muted-foreground"> — {f.notes}</span>}
                                    </span>
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
                toolbarEnd={<Button size="sm" variant="primary" onClick={openAdd}>{t('addTransactionButton')}</Button>}
            />

            {/* Add Transaction Modal */}
            <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={t('addTransactionTitle')}>
                <form onSubmit={handleAdd} className="flex flex-col gap-5 px-1 py-1">
                    {/* Package */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('packageLabel')}</FieldLabel>
                        <Select
                            variant="secondary"
                            fullWidth
                            placeholder={t('selectPackage')}
                            value={addPkgKey}
                            onChange={(key) => {
                                setAddPkgKey(key);
                                setAddPkg(packageVariationOptions.find(p => p.key === key) || null);
                            }}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {packageVariationOptions.map(p => (
                                        <ListBox.Item key={p.key} id={p.key} textValue={p.label}>
                                            {p.label}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                        {addPkg && (
                            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                                <span>{t('durationInfo')} <span className="text-foreground font-medium">{t('durationDays', { count: addPkg.duration })}</span></span>
                                <span>{t('priceInfo')} <span className="text-foreground font-medium">{addPkg.price.toLocaleString()} {addPkg.currency}</span></span>
                            </div>
                        )}
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('paymentMethodLabel')}</FieldLabel>
                        <Select variant="secondary" fullWidth placeholder={t('selectMethod')} value={addMethod} onChange={setAddMethod}>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {paymentMethodOptions.map(m => (
                                        <ListBox.Item key={m} id={m} textValue={m}>
                                            {m}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>

                    {/* Transaction Date */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('txDateLabel')}</FieldLabel>
                        <DatePickerField ariaLabel={t('txDateLabel')} value={strToDate(addDate)} onChange={(dv) => setAddDate(dv ? dv.toString() : "")} />
                    </div>

                    {/* Subscription Start Date */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>
                            {t('subStartDateLabel')} <span className="font-normal opacity-60">{t('subStartDateHint')}</span>
                        </FieldLabel>
                        <DatePickerField ariaLabel={t('subStartDateLabel')} value={strToDate(addSubStartDate)} onChange={(dv) => setAddSubStartDate(dv ? dv.toString() : "")} />
                        {addSubStartDate && (
                            <button
                                type="button"
                                onClick={() => setAddSubStartDate("")}
                                className="self-start text-xs text-muted-foreground hover:text-destructive mt-1 transition-colors cursor-pointer"
                            >
                                {t('clearOnFirstPlan')}
                            </button>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('notesLabel')}</FieldLabel>
                        <TextArea variant="secondary" fullWidth rows={2} aria-label={t('notesLabel')} placeholder={t('notesPlaceholder')} value={addNotes} onChange={e => setAddNotes(e.target.value)} />
                    </div>

                    {/* Proof */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('proofLabel')}</FieldLabel>
                        <ProofDropZone
                            file={addProofFile}
                            onChange={setAddProofFile}
                            label={t('proofDropLabel')}
                            hint={t('proofDropHint')}
                            removeLabel={t('removeProof')}
                        />
                    </div>

                    <FieldErrorText msg={addError} />

                    <ModalFooter>
                        <Button type="button" onClick={() => setShowAddModal(false)} variant="ghost">
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" isDisabled={addSaving} variant="primary">
                            {addSaving ? t('saving') : t('addTransaction')}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Edit Transaction Modal */}
            <Modal open={showEditModal} onClose={closeEdit} title={t('editTransactionTitle')}>
                <form onSubmit={handleEdit} className="flex flex-col gap-5 px-1 py-1">
                    {/* Package */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('packageLabel')}</FieldLabel>
                        <Select
                            variant="secondary"
                            fullWidth
                            placeholder={t('selectPackage')}
                            value={editPkgKey}
                            onChange={(key) => {
                                setEditPkgKey(key);
                                setEditPkg(packageVariationOptions.find(p => p.key === key) || null);
                            }}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {packageVariationOptions.map(p => (
                                        <ListBox.Item key={p.key} id={p.key} textValue={p.label}>
                                            {p.label}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                        {editPkg && (
                            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                                <span>{t('durationInfo')} <span className="text-foreground font-medium">{t('durationDays', { count: editPkg.duration })}</span></span>
                                <span>{t('priceInfo')} <span className="text-foreground font-medium">{editPkg.price.toLocaleString()} {editPkg.currency}</span></span>
                            </div>
                        )}
                        {!editPkg && editPkgKey && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('storedPackage', { pkg: editPkgKey })} · {editingTx?.amount} {editingTx?.currency} · {editingTx?.duration ? t('durationDays', { count: editingTx.duration }) : t('noDuration')}
                            </p>
                        )}
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('paymentMethodLabel')}</FieldLabel>
                        <Select variant="secondary" fullWidth placeholder={t('selectMethod')} value={editMethod} onChange={setEditMethod}>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {paymentMethodOptions.map(m => (
                                        <ListBox.Item key={m} id={m} textValue={m}>
                                            {m}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>

                    {/* Transaction Date */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('txDateLabel')}</FieldLabel>
                        <DatePickerField ariaLabel={t('txDateLabel')} value={strToDate(editDate)} onChange={(dv) => setEditDate(dv ? dv.toString() : "")} />
                    </div>

                    {/* Subscription Start Date */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>
                            {t('subStartDateLabel')} <span className="font-normal opacity-60">{t('subStartDateEditHint')}</span>
                        </FieldLabel>
                        <DatePickerField ariaLabel={t('subStartDateLabel')} value={strToDate(editSubStartDate)} onChange={(dv) => setEditSubStartDate(dv ? dv.toString() : "")} />
                        {editSubStartDate && (
                            <button
                                type="button"
                                onClick={() => setEditSubStartDate("")}
                                className="self-start text-xs text-muted-foreground hover:text-destructive mt-1 transition-colors cursor-pointer"
                            >
                                {t('clearUseQueue')}
                            </button>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('notesLabel')}</FieldLabel>
                        <TextArea variant="secondary" fullWidth rows={2} aria-label={t('notesLabel')} placeholder={t('notesPlaceholder')} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                    </div>

                    {/* Proof image */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('proofEditLabel')}</FieldLabel>
                        {editProofUrl && !editProofFile && (
                            <div className="flex items-center gap-2 mb-1">
                                <a href={`${process.env.NEXT_PUBLIC_API_URL}${editProofUrl}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                    {t('viewCurrentProof')}
                                </a>
                                <button type="button" onClick={() => setEditProofUrl(null)} className="text-xs text-destructive hover:underline cursor-pointer">
                                    {t('removeProof')}
                                </button>
                            </div>
                        )}
                        <ProofDropZone
                            file={editProofFile}
                            onChange={setEditProofFile}
                            label={t('proofDropLabel')}
                            hint={t('proofDropHint')}
                            removeLabel={t('removeProof')}
                        />
                    </div>

                    <FieldErrorText msg={editError} />

                    <ModalFooter>
                        <Button type="button" onClick={closeEdit} variant="ghost">
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" isDisabled={saving} variant="primary">
                            {saving ? t('saving') : t('saveChanges')}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Freeze Modal */}
            <Modal open={showFreezeModal} onClose={() => setShowFreezeModal(false)} title={t('addFreezeTitle')}>
                <form onSubmit={handleAddFreeze} className="flex flex-col gap-3">
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
                    <p className="text-xs text-muted-foreground">
                        {t('freezeDescription')}
                    </p>
                    <Button type="submit" isDisabled={freezeSaving} variant="primary" fullWidth>
                        {freezeSaving ? t('saving') : t('addFreeze')}
                    </Button>
                </form>
            </Modal>
        </div>
    );
}
