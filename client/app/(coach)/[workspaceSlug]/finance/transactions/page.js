"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";

// --- HELPERS ---
const EXCHANGE_RATES = { EGP: 1, USD: 50.5, SAR: 13.47, EUR: 55.2, GBP: 64.1 };
const DISPLAY_CURRENCIES = Object.keys(EXCHANGE_RATES);

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

function statusColor(status) {
    switch (status) {
        case "completed": return "bg-green-500/15 text-green-600";
        case "refunded":  return "bg-destructive/10 text-destructive";
        default:          return "bg-secondary text-muted-foreground";
    }
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

function convert(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    return (amount * (EXCHANGE_RATES[fromCurrency] || 1)) / (EXCHANGE_RATES[toCurrency] || 1);
}

function parseTransactionDate(dateStr) { return new Date(dateStr); }
function todayStr() { return new Date().toISOString().split("T")[0]; }

function fmtDate(d, locale) {
    return d ? new Date(d).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : "—";
}

// --- SEARCHABLE CLIENT SELECT ---
function SearchableClientSelect({ clients, selected, onSelect }) {
    const t = useTranslations('transactions');
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = !selected && query.trim()
        ? clients.filter(c => {
            const q = query.toLowerCase();
            if (c.name.toLowerCase().includes(q)) return true;
            if (String(c.code).includes(q)) return true;
            if ((c.phones || []).some(p => p.number.replace(/\s/g, "").includes(q.replace(/\s/g, "")))) return true;
            return false;
        }).slice(0, 8)
        : [];

    return (
        <div ref={ref} className="relative">
            <input
                value={selected ? selected.name : query}
                onChange={e => {
                    if (selected) onSelect(null);
                    setQuery(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => { if (!selected) setOpen(true); }}
                onClick={() => {
                    if (selected) { onSelect(null); setQuery(""); setOpen(true); }
                }}
                placeholder={t('clientSearchPlaceholder')}
                className={inputCls}
                autoComplete="off"
            />
            {selected && (
                <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { onSelect(null); setQuery(""); setOpen(true); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-lg leading-none cursor-pointer"
                >
                    ×
                </button>
            )}
            {open && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filtered.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { onSelect(c); setQuery(""); setOpen(false); }}
                            className="w-full px-3 py-2.5 text-left hover:bg-default flex items-center gap-2 transition-colors"
                        >
                            <span className="text-foreground text-sm font-medium flex-1">{c.name}</span>
                            <span className="text-muted-foreground text-xs">#{c.code}</span>
                            {c.phones?.[0] && (
                                <span className="text-muted-foreground text-xs">
                                    {c.phones[0].countryCode} {c.phones[0].number}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- TRANSACTIONS TABLE ---
function TransactionsTable({ transactions, allClientNames, allPackageVariations, allPaymentMethods, onStatusChange, onDelete, onEdit, toolbarEnd }) {
    const t = useTranslations('transactions');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const STATUS_LABELS = { completed: t('completed'), refunded: t('refunded') };
    const SUB_STATUS_LABELS = {
        Active: t('statusActive'), Expired: t('statusExpired'),
        Frozen: t('statusFrozen'), 'Pre-start': t('statusPreStart'),
        Refunded: t('statusRefunded'),
    };
    const [filteredRows, setFilteredRows] = useState(transactions);
    const [displayCurrency, setDisplayCurrency] = useState("EGP");

    const clientNames       = [...new Set([...allClientNames,       ...transactions.map(tx => tx.clientName).filter(Boolean)])];
    const packageVariations = [...new Set([...allPackageVariations, ...transactions.map(tx => tx.packageVariation).filter(Boolean)])];
    const paymentMethods    = [...new Set([...allPaymentMethods,    ...transactions.map(tx => tx.paymentMethod).filter(Boolean)])];

    function convertedSum(rows) {
        return rows.reduce((sum, tx) => sum + convert(tx.amount, tx.currency, displayCurrency), 0);
    }

    const totalCompleted = convertedSum(filteredRows.filter(tx => tx.status === "completed"));
    const totalRefunded  = convertedSum(filteredRows.filter(tx => tx.status === "refunded"));

    const byPaymentMethod = {};
    for (const tx of filteredRows) {
        if (!byPaymentMethod[tx.paymentMethod]) byPaymentMethod[tx.paymentMethod] = 0;
        byPaymentMethod[tx.paymentMethod] += convert(tx.amount, tx.currency, displayCurrency);
    }

    const byCurrency = {};
    for (const tx of filteredRows) {
        if (!byCurrency[tx.currency]) byCurrency[tx.currency] = 0;
        byCurrency[tx.currency] += tx.amount;
    }

    const columns = [
        { key: "id", label: t('colId'), filterType: "text", sortable: true },
        { key: "clientName", label: t('colClient'), filterType: "multi", options: clientNames, sortable: true },
        {
            key: "packageVariation",
            label: t('colPackage'),
            filterType: "multi",
            options: packageVariations,
            sortable: true,
            render: (row) => row.packageVariation || <span className="text-muted-foreground">—</span>,
        },
        {
            key: "amount",
            label: t('colAmount'),
            sortable: true,
            render: (row) => <span className="font-medium text-foreground">{row.amount.toLocaleString()} {row.currency}</span>,
        },
        {
            key: "duration",
            label: t('colDuration'),
            sortable: true,
            render: (row) => row.duration
                ? <span className="text-muted-foreground">{t('durationDays', { count: row.duration })}</span>
                : <span className="text-muted-foreground">—</span>,
        },
        { key: "paymentMethod", label: t('colMethod'), filterType: "multi", options: paymentMethods, sortable: true },
        {
            key: "status",
            label: t('colPayStatus'),
            filterType: "multi",
            options: ["completed", "refunded"],
            sortable: true,
            render: (row) => (
                <Chip size="sm" className={statusColor(row.status)}>
                    {STATUS_LABELS[row.status] ?? row.status}
                </Chip>
            ),
        },
        {
            key: "_subStatus",
            label: t('colSubStatus'),
            filterType: "multi",
            options: ["Active", "Pre-start", "Expired", "Refunded"],
            render: (row) => {
                const s = row.subscriptionStatus;
                return s
                    ? <Chip size="sm" className={subStatusColor(s)}>{SUB_STATUS_LABELS[s] ?? s}</Chip>
                    : <span className="text-muted-foreground text-xs">—</span>;
            },
        },
        {
            key: "date",
            label: t('colTxDate'),
            filterType: "dateRange",
            sortable: true,
            render: (row) => fmtDate(row.date, locale),
        },
        {
            key: "createdAt",
            label: t('colCreated'),
            sortable: true,
            render: (row) => fmtDate(row.createdAt, locale),
        },
        {
            key: "_proof",
            label: t('colProof'),
            render: (row) => row.proofImage ? (
                <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}${row.proofImage}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                >
                    {t('view')}
                </a>
            ) : <span className="text-muted-foreground text-xs">—</span>,
        },
        {
            key: "_actions",
            label: "",
            render: (row) => (
                <div className="flex gap-2 justify-end whitespace-nowrap">
                    {onEdit && (
                        <button onClick={() => onEdit(row)} className="text-xs text-primary hover:text-primary/80 cursor-pointer transition-colors">
                            {tCommon('edit')}
                        </button>
                    )}
                    {row.status === "completed" && onStatusChange && (
                        <button onClick={() => onStatusChange(row.id, "refunded")} className="text-xs text-orange-500 hover:text-orange-600 cursor-pointer transition-colors">
                            {t('refundAction')}
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={() => onDelete(row.id)} className="text-xs text-destructive hover:text-red-700 cursor-pointer transition-colors">
                            {tCommon('delete')}
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            {/* Currency selector */}
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium uppercase">{t('displayCurrency')}</span>
                <select
                    value={displayCurrency}
                    onChange={(e) => setDisplayCurrency(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                >
                    {DISPLAY_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* Summary cards */}
            <div className="flex flex-wrap gap-3">
                <Card>
                    <Card.Content className="px-4 py-3">
                        <p className="text-muted-foreground text-xs font-medium uppercase">{t('completed')}</p>
                        <p className="text-green-600 text-lg font-bold mt-0.5">
                            {Math.round(totalCompleted).toLocaleString()} {displayCurrency}
                        </p>
                    </Card.Content>
                </Card>
                <Card>
                    <Card.Content className="px-4 py-3">
                        <p className="text-muted-foreground text-xs font-medium uppercase">{t('refunded')}</p>
                        <p className="text-destructive text-lg font-bold mt-0.5">
                            {Math.round(totalRefunded).toLocaleString()} {displayCurrency}
                        </p>
                    </Card.Content>
                </Card>

                {Object.keys(byPaymentMethod).length > 0 && (
                    <div className="w-px bg-border mx-1 self-stretch" />
                )}
                {Object.entries(byPaymentMethod).map(([method, total]) => (
                    <Card key={method}>
                        <Card.Content className="px-4 py-3">
                            <p className="text-muted-foreground text-xs font-medium uppercase">{method}</p>
                            <p className="text-foreground text-lg font-bold mt-0.5">
                                {Math.round(total).toLocaleString()} {displayCurrency}
                            </p>
                        </Card.Content>
                    </Card>
                ))}

                {Object.keys(byCurrency).length > 0 && (
                    <div className="w-px bg-border mx-1 self-stretch" />
                )}
                {Object.entries(byCurrency).map(([currency, total]) => (
                    <Card key={currency}>
                        <Card.Content className="px-4 py-3">
                            <p className="text-muted-foreground text-xs font-medium uppercase">{currency}</p>
                            <p className="text-primary text-lg font-bold mt-0.5">{total.toLocaleString()} {currency}</p>
                        </Card.Content>
                    </Card>
                ))}
            </div>

            <DataTable
                columns={columns}
                data={transactions}
                rowKey="id"
                dateParser={parseTransactionDate}
                onFilteredDataChange={setFilteredRows}
                quickSearch={{ fields: ["clientName", "packageVariation"], placeholder: t('searchPlaceholder') }}
                toolbarEnd={toolbarEnd}
            />
        </>
    );
}

// --- PAGE ---
export default function TransactionsPage() {
    const t = useTranslations('transactions');
    const tCommon = useTranslations('common');
    const locale = useLocale();

    const [transactions, setTransactions]     = useState([]);
    const [clients, setClients]               = useState([]);
    const [packages, setPackages]             = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading]               = useState(true);
    const [showForm, setShowForm]             = useState(false);
    const [formError, setFormError]           = useState("");
    const [submitting, setSubmitting]         = useState(false);

    // Shared form state (create + edit)
    const [editingTx, setEditingTx]                     = useState(null);
    const [selectedClient, setSelectedClient]           = useState(null);
    const [selectedPkgKey, setSelectedPkgKey]           = useState("");
    const [selectedPkg, setSelectedPkg]                 = useState(null);
    const [formPaymentMethod, setFormPaymentMethod]     = useState("");
    const [formDate, setFormDate]                       = useState(todayStr());
    const [formSubStartDate, setFormSubStartDate]       = useState("");
    const [formNotes, setFormNotes]                     = useState("");
    const [proofFile, setProofFile]                     = useState(null);
    const [proofUrl, setProofUrl]                       = useState(null);

    useEffect(() => {
        Promise.all([
            api.get("/api/transactions?limit=10000"),
            api.get("/api/clients?limit=10000"),
            api.get("/api/packages"),
            api.get("/api/payment-methods"),
        ]).then(([txRes, clientRes, pkgRes, pmRes]) => {
            setTransactions(txRes.data?.data ?? []);
            setClients(clientRes.data?.data ?? []);
            setPackages(pkgRes.data ?? []);
            setPaymentMethods((pmRes.data ?? []).filter(m => m.active));
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const packageVariationOptions = packages.flatMap(p =>
        p.variations.map(v => ({
            key: `${p.name} — ${v.name}`,
            label: `${p.name} — ${v.name}`,
            duration: v.duration,
            price: Number(v.price),
            currency: v.currency,
        }))
    );

    const allClientNames        = clients.map(c => c.name || `${c.fname} ${c.lname}`);
    const allPackageVariations  = packageVariationOptions.map(p => p.key);
    const allPaymentMethodNames = paymentMethods.map(m => m.name);

    function closeForm() {
        setShowForm(false);
        setEditingTx(null);
        setSelectedClient(null);
        setSelectedPkgKey("");
        setSelectedPkg(null);
        setFormPaymentMethod("");
        setFormDate(todayStr());
        setFormSubStartDate("");
        setFormNotes("");
        setProofFile(null);
        setProofUrl(null);
        setFormError("");
    }

    function openCreate() {
        closeForm();
        setShowForm(true);
    }

    function openEdit(tx) {
        const pkg = packageVariationOptions.find(p => p.key === tx.packageVariation);
        setEditingTx(tx);
        setSelectedClient(tx.clientId ? { id: tx.clientId, name: tx.clientName } : null);
        setSelectedPkgKey(tx.packageVariation || "");
        setSelectedPkg(pkg || null);
        setFormPaymentMethod(tx.paymentMethod || "");
        setFormDate(tx.date ? tx.date.split("T")[0] : todayStr());
        setFormSubStartDate(tx.subscriptionStartDate ? tx.subscriptionStartDate.split("T")[0] : "");
        setFormNotes(tx.notes || "");
        setProofFile(null);
        setProofUrl(tx.proofImage || null);
        setFormError("");
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError("");
        if (!selectedClient) { setFormError(t('errorClientRequired')); return; }
        if (!selectedPkgKey) { setFormError(t('errorPackageRequired')); return; }
        if (!formPaymentMethod) { setFormError(t('errorMethodRequired')); return; }

        setSubmitting(true);
        try {
            let finalProofUrl = proofUrl;
            if (proofFile) {
                const fd = new FormData();
                fd.append("proof", proofFile);
                const up = await api.post("/api/transactions/upload-proof", fd);
                finalProofUrl = up.data.path;
            }

            const payload = {
                clientId: selectedClient.id,
                clientName: selectedClient.name,
                packageVariation: selectedPkgKey,
                paymentMethod: formPaymentMethod,
                amount: selectedPkg?.price ?? editingTx?.amount,
                currency: selectedPkg?.currency ?? editingTx?.currency,
                duration: selectedPkg?.duration ?? editingTx?.duration,
                type: "subscription",
                status: "completed",
                date: formDate,
                subscriptionStartDate: formSubStartDate || null,
                notes: formNotes || null,
                proofImage: finalProofUrl,
            };

            if (editingTx) {
                const res = await api.put("/api/transactions", { id: editingTx.id, ...payload });
                setTransactions(prev => prev.map(tx => tx.id === editingTx.id ? res.data : tx));
            } else {
                const res = await api.post("/api/transactions", payload);
                setTransactions(prev => [res.data, ...prev]);
            }
            closeForm();
        } catch (err) {
            setFormError(err.response?.data?.error || t('errorSave'));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleStatusChange(id, status) {
        try {
            const res = await api.put("/api/transactions", { id, status });
            setTransactions(prev => prev.map(tx => tx.id === id ? res.data : tx));
        } catch (err) {
            console.error(err);
        }
    }

    async function handleDelete(id) {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            await api.delete(`/api/transactions?id=${id}`);
            setTransactions(prev => prev.filter(tx => tx.id !== id));
        } catch (err) {
            console.error(err);
        }
    }

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-6">
                <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>

            {/* Create / Edit Modal */}
            <Modal open={showForm} onClose={closeForm} title={editingTx ? t('editTransactionTitle') : t('newTransactionTitle')} wide>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                    {/* Client */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('clientLabel')} *</label>
                        <SearchableClientSelect
                            clients={clients}
                            selected={selectedClient}
                            onSelect={setSelectedClient}
                        />
                        {selectedClient && (
                            <p className="text-xs text-muted-foreground mt-1">
                                #{selectedClient.code ?? ""} · {selectedClient.email ?? ""}
                            </p>
                        )}
                    </div>

                    {/* Package */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('packageLabel')} *</label>
                        <select
                            value={selectedPkgKey}
                            onChange={e => {
                                const key = e.target.value;
                                setSelectedPkgKey(key);
                                setSelectedPkg(packageVariationOptions.find(p => p.key === key) || null);
                            }}
                            className={`${inputCls} ${!selectedPkgKey ? "text-muted-foreground" : ""}`}
                        >
                            <option value="">{t('selectPackage')}</option>
                            {packageVariationOptions.map(p => (
                                <option key={p.key} value={p.key}>{p.label}</option>
                            ))}
                        </select>
                        {selectedPkg && (
                            <div className="flex gap-4 mt-2 px-1 text-xs text-muted-foreground">
                                <span>{t('durationInfo')} <span className="text-foreground font-semibold">{t('durationDays', { count: selectedPkg.duration })}</span></span>
                                <span>{t('priceInfo')} <span className="text-foreground font-semibold">{selectedPkg.price.toLocaleString(locale)} {selectedPkg.currency}</span></span>
                            </div>
                        )}
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('paymentMethodLabel')} *</label>
                        <select
                            value={formPaymentMethod}
                            onChange={e => setFormPaymentMethod(e.target.value)}
                            className={`${inputCls} ${!formPaymentMethod ? "text-muted-foreground" : ""}`}
                        >
                            <option value="">{t('selectMethod')}</option>
                            {allPaymentMethodNames.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    {/* Transaction Date */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('txDateLabel')}</label>
                        <input
                            type="date"
                            value={formDate}
                            onChange={e => setFormDate(e.target.value)}
                            className={inputCls}
                        />
                    </div>

                    {/* Subscription Start Date */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">
                            {t('subStartDateLabel')} <span className="text-muted-foreground/60">{t('subStartDateHint')}</span>
                        </label>
                        <input
                            type="date"
                            value={formSubStartDate}
                            onChange={e => setFormSubStartDate(e.target.value)}
                            className={inputCls}
                        />
                        {formSubStartDate && (
                            <button
                                type="button"
                                onClick={() => setFormSubStartDate("")}
                                className="text-xs text-muted-foreground hover:text-destructive mt-1 transition-colors cursor-pointer"
                            >
                                {t('clearUseQueue')}
                            </button>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('notesLabel')} <span className="text-muted-foreground/60">{t('notesHint')}</span></label>
                        <textarea
                            rows={2}
                            placeholder={t('notesPlaceholder')}
                            value={formNotes}
                            onChange={e => setFormNotes(e.target.value)}
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    {/* Proof of transaction */}
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('proofLabel')} <span className="text-muted-foreground/60">{t('notesHint')}</span></label>
                        {proofUrl && !proofFile && (
                            <div className="flex items-center gap-2 mb-2">
                                <a
                                    href={`${process.env.NEXT_PUBLIC_API_URL}${proofUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    {t('viewCurrentProof')}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setProofUrl(null)}
                                    className="text-xs text-destructive hover:underline cursor-pointer"
                                >
                                    {t('removeProof')}
                                </button>
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => setProofFile(e.target.files[0] || null)}
                            className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-secondary file:text-foreground hover:file:bg-secondary/80 cursor-pointer"
                        />
                        {proofFile && <p className="text-xs text-muted-foreground mt-1">{proofFile.name}</p>}
                    </div>

                    {formError && <p className="text-destructive text-sm">{formError}</p>}

                    <Button
                        type="submit"
                        isDisabled={submitting}
                        variant="primary"
                        fullWidth
                    >
                        {submitting
                            ? (editingTx ? t('saving') : t('recording'))
                            : (editingTx ? t('saveChanges') : t('recordTransaction'))}
                    </Button>
                </form>
            </Modal>

            {/* Table + summaries */}
            <TransactionsTable
                transactions={transactions}
                allClientNames={allClientNames}
                allPackageVariations={allPackageVariations}
                allPaymentMethods={allPaymentMethodNames}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onEdit={openEdit}
                toolbarEnd={<Button variant="primary" onClick={openCreate}>{t('newTransaction')}</Button>}
            />
        </div>
    );
}
