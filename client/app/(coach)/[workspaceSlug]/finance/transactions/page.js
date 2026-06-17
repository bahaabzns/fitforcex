"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import DataTable from "@/app/components/DataTable";
import TransactionModal from "@/app/components/TransactionModal";
import ImagePreview from "@/app/components/ImagePreview";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Tooltip } from "@heroui/react/tooltip";

// --- HELPERS ---
const EXCHANGE_RATES = { EGP: 1, USD: 50.5, SAR: 13.47, EUR: 55.2, GBP: 64.1 };
const DISPLAY_CURRENCIES = Object.keys(EXCHANGE_RATES);

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


// --- TRANSACTIONS TABLE ---
function TransactionsTable({ transactions, allPackageVariations, allPaymentMethods, onStatusChange, onDelete, onEdit, toolbarEnd }) {
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
        {
            key: "code",
            label: t('colId'),
            filterType: "text",
            sortable: true,
            render: (row) => (
                <span className="font-mono text-muted-foreground">#{String(row.code ?? "").padStart(4, "0")}</span>
            ),
        },
        { key: "clientName", label: t('colClient'), filterType: "text", sortable: true },
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
            optionLabel: (v) => STATUS_LABELS[v] ?? v,
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
            render: (row) => {
                if (!row.proofImage) return <span className="text-muted-foreground text-xs">—</span>;
                const url = `${process.env.NEXT_PUBLIC_API_URL}${row.proofImage}`;
                const isPdf = /\.pdf$/i.test(row.proofImage);
                return (
                    <ImagePreview src={url} alt={t('colProof')} isPdf={isPdf} title={t('view')}>
                        {isPdf ? (
                            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-[9px] font-semibold text-muted-foreground hover:border-primary transition-colors">
                                PDF
                            </span>
                        ) : (
                            <img
                                src={url}
                                alt={t('colProof')}
                                className="h-10 w-10 rounded-md border border-border object-cover hover:opacity-80 transition-opacity"
                                loading="lazy"
                            />
                        )}
                    </ImagePreview>
                );
            },
        },
        {
            key: "_actions",
            label: "",
            render: (row) => (
                <div className="flex items-center gap-1 justify-end whitespace-nowrap">
                    {onEdit && (
                        <Tooltip>
                            <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('edit')} onClick={() => onEdit(row)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Tooltip.Content>{tCommon('edit')}</Tooltip.Content>
                        </Tooltip>
                    )}
                    {row.status === "completed" && onStatusChange && (
                        <Tooltip>
                            <Button isIconOnly size="sm" variant="ghost" aria-label={t('refundAction')} className="text-orange-500 hover:text-orange-600" onClick={() => onStatusChange(row.id, "refunded")}>
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Tooltip.Content>{t('refundAction')}</Tooltip.Content>
                        </Tooltip>
                    )}
                    {row.status === "refunded" && onStatusChange && (
                        <Tooltip>
                            <Button isIconOnly size="sm" variant="ghost" aria-label={t('undoRefundAction')} className="text-emerald-600 hover:text-emerald-700" onClick={() => onStatusChange(row.id, "completed")}>
                                <RotateCw className="h-4 w-4" />
                            </Button>
                            <Tooltip.Content>{t('undoRefundAction')}</Tooltip.Content>
                        </Tooltip>
                    )}
                    {onDelete && (
                        <Tooltip>
                            <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('delete')} className="text-destructive hover:text-red-700" onClick={() => onDelete(row.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <Tooltip.Content>{tCommon('delete')}</Tooltip.Content>
                        </Tooltip>
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
    // The shared TransactionModal owns the form; this page only tracks open/edit state.
    const [showForm, setShowForm]   = useState(false);
    const [editingTx, setEditingTx] = useState(null);

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

    const allPackageVariations  = packageVariationOptions.map(p => p.key);
    const allPaymentMethodNames = paymentMethods.map(m => m.name);

    function closeForm() {
        setShowForm(false);
        setEditingTx(null);
    }

    function openEdit(tx) {
        setEditingTx(tx);
        setShowForm(true);
    }

    // Does this client already have a completed subscription (excluding the tx being
    // edited)? Drives the modal's start label — first subscription vs queue after current.
    function clientHasSubscription(clientId) {
        return transactions.some(tx =>
            tx.clientId === clientId && tx.id !== editingTx?.id && tx.status === "completed" && tx.duration > 0);
    }

    async function handleStatusChange(id, status) {
        try {
            const res = await api.put(`/api/transactions/${id}`, { status });
            setTransactions(prev => prev.map(tx => tx.id === id ? res.data : tx));
        } catch (err) {
            console.error(err);
        }
    }

    async function handleDelete(id) {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            await api.delete(`/api/transactions/${id}`);
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

            {/* Create / Edit Transaction — shared modal with a client picker */}
            <TransactionModal
                open={showForm}
                onClose={closeForm}
                mode={editingTx ? "edit" : "add"}
                transaction={editingTx}
                clientPicker
                pickerClients={clients}
                packages={packages}
                paymentMethods={paymentMethods}
                getClientHasSubscription={clientHasSubscription}
                onSuccess={(result) => {
                    if (editingTx) {
                        setTransactions(prev => prev.map(tx => tx.id === result.id ? result : tx));
                    } else {
                        setTransactions(prev => [...result, ...prev]);
                    }
                }}
            />

            {/* Table + summaries */}
            <TransactionsTable
                transactions={transactions}
                allPackageVariations={allPackageVariations}
                allPaymentMethods={allPaymentMethodNames}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onEdit={openEdit}
            />
        </div>
    );
}
