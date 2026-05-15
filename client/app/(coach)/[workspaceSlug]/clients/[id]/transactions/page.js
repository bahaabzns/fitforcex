"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";

const EXCHANGE_RATES = { EGP: 1, USD: 50.5, SAR: 13.47, EUR: 55.2, GBP: 64.1 };

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

function todayStr() { return new Date().toISOString().split("T")[0]; }

function fmtDate(d) {
    return d
        ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "—";
}

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
        case "Frozen":    return "bg-blue-500/15 text-blue-600";
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
        if (!addPkgKey || !addPkg) { setAddError("Package is required"); return; }
        if (!addMethod) { setAddError("Payment method is required"); return; }
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
            setAddError(err.response?.data?.error || "Failed to add transaction");
        } finally {
            setAddSaving(false);
        }
    }

    async function handleEdit(e) {
        e.preventDefault();
        if (!editPkgKey) { setEditError("Package is required"); return; }
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
            setTransactions(prev => prev.map(t => t.id === editingTx.id ? res.data : t));
            closeEdit();
        } catch (err) {
            setEditError(err.response?.data?.error || "Failed to save changes");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(tx) {
        if (!confirm("Delete this transaction? This cannot be undone.")) return;
        try {
            await api.delete(`/api/transactions/${tx.id}`);
            setTransactions(prev => prev.filter(t => t.id !== tx.id));
        } catch (err) {
            console.error(err);
        }
    }

    async function handleRefund(tx) {
        try {
            const res = await api.put(`/api/transactions/${tx.id}`, { status: "refunded" });
            setTransactions(prev => prev.map(t => t.id === tx.id ? res.data : t));
        } catch (err) {
            console.error(err);
        }
    }

    async function handleAddFreeze(e) {
        e.preventDefault();
        if (!freezeStartDate || !freezeDays || Number(freezeDays) <= 0) {
            setFreezeError("Start date and duration are required.");
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
            setFreezeError(err.response?.data?.error || "Failed to add freeze.");
        } finally {
            setFreezeSaving(false);
        }
    }

    async function handleDeleteFreeze(freeze) {
        if (!confirm("Remove this freeze? This will affect the subscription expiry date.")) return;
        try {
            await api.delete(`/api/clients/${id}/freezes/${freeze.id}`);
            setFreezes(prev => prev.filter(f => f.id !== freeze.id));
        } catch (err) {
            console.error(err);
        }
    }

    const completedTx = transactions.filter(t => t.status === "completed");
    const refundedTx  = transactions.filter(t => t.status === "refunded");

    const byCurrency = completedTx.reduce((acc, t) => {
        acc[t.currency] = (acc[t.currency] || 0) + t.amount;
        return acc;
    }, {});

    const totalEGP = completedTx.reduce((sum, t) => {
        const rate = EXCHANGE_RATES[t.currency] ?? 1;
        return sum + t.amount * rate;
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
            <div className="p-6 flex flex-col gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Transactions</h2>
                <Button onClick={openAdd} variant="primary" size="sm">
                    + Add Transaction
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card><Card.Content className="p-6">
                    <p className="text-xs text-muted-foreground font-medium">Total</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{transactions.length}</p>
                </Card.Content></Card>
                <Card><Card.Content className="p-6">
                    <p className="text-xs text-muted-foreground font-medium">Completed</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{completedTx.length}</p>
                </Card.Content></Card>
                <Card><Card.Content className="p-6">
                    <p className="text-xs text-muted-foreground font-medium">Refunded</p>
                    <p className="text-2xl font-bold text-destructive mt-1">{refundedTx.length}</p>
                </Card.Content></Card>
                <Card><Card.Content className="p-6">
                    <p className="text-xs text-muted-foreground font-medium">Revenue (EGP equiv.)</p>
                    <p className="text-2xl font-bold text-primary mt-1">
                        {totalEGP.toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
                    isFrozen   ? "border-blue-500/30 bg-blue-500/5" :
                    isExpired  ? "border-destructive/30 bg-destructive/5" :
                    isPreStart ? "border-yellow-500/30 bg-yellow-500/5" :
                                 "border-green-600/30 bg-green-100/5"
                }`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground font-medium">
                                {hasNoSubscriptions ? "No Subscriptions" :
                                 isExpired ? "Subscription Expired" :
                                 isFrozen  ? "Subscription Frozen" :
                                 isPreStart ? "Subscription Pre-start" :
                                              "Subscription Active"}
                            </p>
                            {displayPeriod && (
                                <>
                                    <p className={`text-lg font-bold mt-1 ${
                                        isFrozen   ? "text-blue-600" :
                                        isExpired  ? "text-destructive" :
                                        isPreStart ? "text-yellow-600" :
                                                     "text-green-600"
                                    }`}>
                                        {fmtDate(displayPeriod.start)} — {fmtDate(displayPeriod.end)}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {displayPeriod.tx.packageVariation} · {displayPeriod.tx.duration} days
                                        {freezes.length > 0 && ` (incl. ${freezes.reduce((s, f) => s + f.freezeDurationDays, 0)} freeze days)`}
                                    </p>
                                </>
                            )}
                            {hasNoSubscriptions && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    No subscription transactions recorded yet.
                                </p>
                            )}
                            {isPreStart && !displayPeriod && (
                                <p className="text-sm text-yellow-600 mt-1">
                                    {firstPlanActivatedAt
                                        ? `Starts on first plan activation: ${fmtDate(firstPlanActivatedAt)}`
                                        : "Waiting for first plan activation"}
                                </p>
                            )}
                            {/* Queue */}
                            {timeline.length > 1 && (
                                <div className="mt-2 flex flex-col gap-0.5">
                                    {timeline.map((p, i) => (
                                        <p key={i} className="text-xs text-muted-foreground">
                                            {i === 0 ? "1st" : i === 1 ? "2nd" : `${i + 1}th`}: {fmtDate(p.start)} — {fmtDate(p.end)}
                                            {today >= p.start && today < p.end ? " ← current" : today < p.start ? " ← queued" : " ← expired"}
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
                            + Freeze
                        </button>
                    </div>

                    {/* Active freezes list */}
                    {freezes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Freezes</p>
                            {freezes.map(f => (
                                <div key={f.id} className="flex items-center gap-2 text-xs text-foreground">
                                    <span className="flex-1">
                                        {fmtDate(f.freezeStartDate)} · {f.freezeDurationDays} days
                                        {f.notes && <span className="text-muted-foreground"> — {f.notes}</span>}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteFreeze(f)}
                                        className="text-destructive hover:text-red-700 transition-colors cursor-pointer"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Transactions Table */}
            {transactions.length === 0 ? (
                <div className="rounded-lg border bg-card shadow-sm p-6 text-muted-foreground text-sm">No transactions yet.</div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-background border-b border-border">
                                {["Tx Date", "Sub Start", "Sub Status", "Package", "Amount", "Duration", "Method", "Type", "Pay Status", "Proof", ""].map(h => (
                                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx, i) => (
                                <tr key={tx.id} className={`border-b border-secondary ${i % 2 === 0 ? "bg-card" : "bg-background/40"}`}>
                                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                                        {fmtDate(tx.date)}
                                    </td>
                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                        {tx.startMode === "custom" && tx.subscriptionStartDate
                                            ? <span className="text-foreground">{fmtDate(tx.subscriptionStartDate)}</span>
                                            : tx.startMode === "queued"
                                                ? <span className="text-muted-foreground italic text-xs">Queued</span>
                                                : <span className="text-muted-foreground italic text-xs">On First Plan</span>
                                        }
                                    </td>
                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                        {(() => {
                                            const s = getPerTxStatus(tx, timeline, freezes, today);
                                            return s
                                                ? <Chip size="sm" className={subStatusColor(s)}>{s}</Chip>
                                                : <span className="text-muted-foreground text-xs">—</span>;
                                        })()}
                                    </td>
                                    <td className="px-4 py-2.5 text-foreground max-w-40 truncate">
                                        {tx.packageVariation || "—"}
                                    </td>
                                    <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                                        {tx.amount.toLocaleString()} {tx.currency}
                                    </td>
                                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                                        {tx.duration ? `${tx.duration} days` : "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{tx.paymentMethod}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{tx.type}</td>
                                    <td className="px-4 py-2.5">
                                        <StatusBadge status={tx.status} />
                                    </td>
                                    <td className="px-4 py-2.5">
                                        {tx.proofImage ? (
                                            <a
                                                href={`${process.env.NEXT_PUBLIC_API_URL}${tx.proofImage}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-primary hover:underline"
                                            >
                                                View
                                            </a>
                                        ) : <span className="text-muted-foreground text-xs">—</span>}
                                    </td>
                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                        <div className="flex items-center gap-2 justify-end">
                                            <button
                                                onClick={() => openEdit(tx)}
                                                className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                                            >
                                                Edit
                                            </button>
                                            {tx.status === "completed" && (
                                                <button
                                                    onClick={() => handleRefund(tx)}
                                                    className="text-xs text-orange-500 hover:text-orange-700 transition-colors cursor-pointer"
                                                >
                                                    Refund
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(tx)}
                                                className="text-xs text-destructive hover:text-red-700 transition-colors cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Transaction Modal */}
            <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Transaction">
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Package *</label>
                        <select
                            value={addPkgKey}
                            onChange={e => {
                                setAddPkgKey(e.target.value);
                                setAddPkg(packageVariationOptions.find(p => p.key === e.target.value) || null);
                            }}
                            className={inputCls}
                        >
                            <option value="">— Select package —</option>
                            {packageVariationOptions.map(p => (
                                <option key={p.key} value={p.key}>{p.label}</option>
                            ))}
                        </select>
                        {addPkg && (
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Duration: <span className="text-foreground font-medium">{addPkg.duration} days</span></span>
                                <span>Price: <span className="text-foreground font-medium">{addPkg.price.toLocaleString()} {addPkg.currency}</span></span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Payment Method *</label>
                        <select value={addMethod} onChange={e => setAddMethod(e.target.value)} className={inputCls}>
                            <option value="">— Select method —</option>
                            {paymentMethodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Transaction Date</label>
                        <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className={inputCls} />
                    </div>

                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            Subscription Start Date <span className="text-muted-foreground/60">(empty = on first plan activation)</span>
                        </label>
                        <input
                            type="date"
                            value={addSubStartDate}
                            onChange={e => setAddSubStartDate(e.target.value)}
                            className={inputCls}
                        />
                        {addSubStartDate && (
                            <button
                                type="button"
                                onClick={() => setAddSubStartDate("")}
                                className="text-xs text-muted-foreground hover:text-destructive mt-1 transition-colors cursor-pointer"
                            >
                                Clear (on first plan)
                            </button>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Notes</label>
                        <textarea
                            rows={2}
                            value={addNotes}
                            onChange={e => setAddNotes(e.target.value)}
                            placeholder="Optional notes..."
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Proof of Payment</label>
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => setAddProofFile(e.target.files[0] || null)}
                            className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-secondary file:text-foreground hover:file:bg-secondary/80 cursor-pointer"
                        />
                        {addProofFile && <p className="text-xs text-muted-foreground mt-1">{addProofFile.name}</p>}
                    </div>

                    {addError && <p className="text-destructive text-sm">{addError}</p>}

                    <div className="flex gap-2">
                        <Button type="submit" isDisabled={addSaving} variant="primary" fullWidth>
                            {addSaving ? "Saving…" : "Add Transaction"}
                        </Button>
                        <Button type="button" onClick={() => setShowAddModal(false)} variant="ghost" fullWidth>
                            Cancel
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Edit Transaction Modal */}
            <Modal open={showEditModal} onClose={closeEdit} title="Edit Transaction">
                <form onSubmit={handleEdit} className="flex flex-col gap-4">
                    {/* Package */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Package *</label>
                        <select
                            value={editPkgKey}
                            onChange={e => {
                                setEditPkgKey(e.target.value);
                                setEditPkg(packageVariationOptions.find(p => p.key === e.target.value) || null);
                            }}
                            className={inputCls}
                        >
                            <option value="">— Select package —</option>
                            {packageVariationOptions.map(p => (
                                <option key={p.key} value={p.key}>{p.label}</option>
                            ))}
                        </select>
                        {editPkg && (
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Duration: <span className="text-foreground font-medium">{editPkg.duration} days</span></span>
                                <span>Price: <span className="text-foreground font-medium">{editPkg.price.toLocaleString()} {editPkg.currency}</span></span>
                            </div>
                        )}
                        {!editPkg && editPkgKey && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Stored: {editPkgKey} · {editingTx?.amount} {editingTx?.currency} · {editingTx?.duration ? `${editingTx.duration} days` : "no duration"}
                            </p>
                        )}
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Payment Method</label>
                        <select value={editMethod} onChange={e => setEditMethod(e.target.value)} className={inputCls}>
                            <option value="">— Select method —</option>
                            {paymentMethodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    {/* Transaction Date */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Transaction Date</label>
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={inputCls} />
                    </div>

                    {/* Subscription Start Date */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            Subscription Start Date <span className="text-muted-foreground/60">(empty = queued after previous subscription)</span>
                        </label>
                        <input
                            type="date"
                            value={editSubStartDate}
                            onChange={e => setEditSubStartDate(e.target.value)}
                            className={inputCls}
                        />
                        {editSubStartDate && (
                            <button
                                type="button"
                                onClick={() => setEditSubStartDate("")}
                                className="text-xs text-muted-foreground hover:text-destructive mt-1 transition-colors cursor-pointer"
                            >
                                Clear (use queue)
                            </button>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Notes</label>
                        <textarea
                            rows={2}
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            placeholder="Optional notes..."
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    {/* Proof image */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Proof of Transaction</label>
                        {editProofUrl && !editProofFile && (
                            <div className="flex items-center gap-2 mb-2">
                                <a href={`${process.env.NEXT_PUBLIC_API_URL}${editProofUrl}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                                    View current proof
                                </a>
                                <button type="button" onClick={() => setEditProofUrl(null)} className="text-xs text-destructive hover:underline cursor-pointer">
                                    Remove
                                </button>
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => setEditProofFile(e.target.files[0] || null)}
                            className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-secondary file:text-foreground hover:file:bg-secondary/80 cursor-pointer"
                        />
                        {editProofFile && <p className="text-xs text-muted-foreground mt-1">{editProofFile.name}</p>}
                    </div>

                    {editError && <p className="text-destructive text-sm">{editError}</p>}

                    <div className="flex gap-2">
                        <Button type="submit" isDisabled={saving} variant="primary" fullWidth>
                            {saving ? "Saving…" : "Save Changes"}
                        </Button>
                        <Button type="button" onClick={closeEdit} variant="ghost" fullWidth>
                            Cancel
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Freeze Modal */}
            <Modal open={showFreezeModal} onClose={() => setShowFreezeModal(false)} title="Add Subscription Freeze">
                <form onSubmit={handleAddFreeze} className="flex flex-col gap-3">
                    {freezeError && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{freezeError}</p>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Freeze Start Date *</label>
                        <input
                            type="date"
                            value={freezeStartDate}
                            onChange={e => setFreezeStartDate(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Freeze Duration (days) *</label>
                        <input
                            type="number"
                            min="1"
                            placeholder="e.g. 14"
                            value={freezeDays}
                            onChange={e => setFreezeDays(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Notes <span className="text-muted-foreground/60">(optional)</span></label>
                        <textarea
                            rows={2}
                            value={freezeNotes}
                            onChange={e => setFreezeNotes(e.target.value)}
                            placeholder="Reason for freeze..."
                            className={`${inputCls} resize-none`}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        The freeze extends the subscription expiry date by the specified number of days.
                    </p>
                    <Button type="submit" isDisabled={freezeSaving} variant="primary" fullWidth>
                        {freezeSaving ? "Saving…" : "Add Freeze"}
                    </Button>
                </form>
            </Modal>
        </div>
    );
}
