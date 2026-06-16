"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { UploadCloud, X, Pencil, RotateCcw, Trash2 } from "lucide-react";
import DataTable from "@/app/components/DataTable";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel, FieldErrorText } from "@/app/components/Field";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Label } from "@heroui/react/label";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Switch } from "@heroui/react/switch";
import { Link as UILink } from "@heroui/react/link";
import { Tooltip } from "@heroui/react/tooltip";
import { SearchField } from "@heroui/react/search-field";
import { TextArea } from "@heroui/react/textarea";
import DatePickerField, { strToDate } from "@/app/components/DatePickerField";

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

// Human-readable file size.
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- PROOF DROP ZONE (drag-and-drop single file upload, matches "add client") ---
function ProofDropZone({ file, onChange }) {
    const t = useTranslations('transactions');
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    function pickFirst(fileList) {
        const picked = fileList && fileList[0];
        if (picked) onChange(picked);
    }

    if (file) {
        const ext = (file.name.split(".").pop() || "file").toUpperCase();
        return (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
                    {ext.slice(0, 4)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-foreground">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    isIconOnly
                    aria-label={t('removeProof')}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(null)}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFirst(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/60"
            }`}
        >
            <UploadCloud className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{t('proofDropLabel')}</span>
            <span className="text-[11px] text-muted-foreground">{t('proofDropHint')}</span>
            <input
                ref={inputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => pickFirst(e.target.files)}
            />
        </div>
    );
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
            <SearchField
                aria-label={t('clientLabel')}
                variant="secondary"
                fullWidth
                value={selected ? selected.name : query}
                onChange={(val) => {
                    if (selected) onSelect(null);
                    setQuery(val);
                    setOpen(true);
                }}
                onClear={() => { onSelect(null); setQuery(""); setOpen(true); }}
            >
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input
                        placeholder={t('clientSearchPlaceholder')}
                        autoComplete="off"
                        onFocus={() => { if (!selected) setOpen(true); }}
                        onClick={() => { if (selected) { onSelect(null); setQuery(""); setOpen(true); } }}
                    />
                    <SearchField.ClearButton />
                </SearchField.Group>
            </SearchField>
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
                    <a href={url} target="_blank" rel="noreferrer" className="inline-flex" title={t('view')}>
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
                    </a>
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
    const { workspaceSlug } = useParams();

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
    const [subStartMode, setSubStartMode]               = useState("queue"); // "queue" | "custom"
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
        setSubStartMode("queue");
        setFormNotes("");
        setProofFile(null);
        setProofUrl(null);
        setFormError("");
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
        setSubStartMode(tx.subscriptionStartDate ? "custom" : "queue");
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
            <Modal open={showForm} onClose={closeForm} title={editingTx ? t('editTransactionTitle') : t('newTransactionTitle')} dialogClassName="max-w-[27.3rem]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-1 py-1">

                    {/* Client */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('clientLabel')}</FieldLabel>
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
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <FieldLabel required>{t('packageLabel')}</FieldLabel>
                            <UILink href={`/${workspaceSlug}/finance/packages`} target="_blank" rel="noopener noreferrer" className="text-xs shrink-0">
                                {t('managePackagesShortcut')}
                                <UILink.Icon />
                            </UILink>
                        </div>
                        <Select
                            variant="secondary"
                            fullWidth
                            placeholder={t('selectPackage')}
                            value={selectedPkgKey}
                            onChange={(key) => {
                                setSelectedPkgKey(key);
                                setSelectedPkg(packageVariationOptions.find(p => p.key === key) || null);
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
                        {selectedPkg && (
                            <div className="flex gap-4 mt-2 px-1 text-xs text-muted-foreground">
                                <span>{t('durationInfo')} <span className="text-foreground font-semibold">{t('durationDays', { count: selectedPkg.duration })}</span></span>
                                <span>{t('priceInfo')} <span className="text-foreground font-semibold">{selectedPkg.price.toLocaleString(locale)} {selectedPkg.currency}</span></span>
                            </div>
                        )}
                    </div>

                    {/* Payment Method */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <FieldLabel required>{t('paymentMethodLabel')}</FieldLabel>
                            <UILink href={`/${workspaceSlug}/finance/payment-methods`} target="_blank" rel="noopener noreferrer" className="text-xs shrink-0">
                                {t('managePaymentMethodsShortcut')}
                                <UILink.Icon />
                            </UILink>
                        </div>
                        <Select
                            variant="secondary"
                            fullWidth
                            placeholder={t('selectMethod')}
                            value={formPaymentMethod}
                            onChange={setFormPaymentMethod}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {allPaymentMethodNames.map(m => (
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
                        <DatePickerField
                            ariaLabel={t('txDateLabel')}
                            value={strToDate(formDate)}
                            onChange={(dv) => setFormDate(dv ? dv.toString() : "")}
                        />
                    </div>

                    {/* Subscription Start — toggle "queue after current subscription"; the date
                        picker stays visible but is disabled while "queue" is selected. */}
                    <div className="flex flex-col gap-2">
                        <Label>{t('subStartDateLabel')}</Label>
                        <Switch
                            isSelected={subStartMode === "queue"}
                            onChange={(sel) => {
                                setSubStartMode(sel ? "queue" : "custom");
                                if (sel) setFormSubStartDate("");
                            }}
                        >
                            <Switch.Control>
                                <Switch.Thumb />
                            </Switch.Control>
                            <Switch.Content>
                                <Label className="text-sm">{t('subStartQueueToggle')}</Label>
                            </Switch.Content>
                        </Switch>
                        <p className="text-xs text-muted-foreground">
                            {subStartMode === "queue"
                                ? t('subStartHintQueue')
                                : t('subStartHintCustom')}
                        </p>
                        <DatePickerField
                            ariaLabel={t('subStartDateLabel')}
                            value={strToDate(formSubStartDate)}
                            onChange={(dv) => setFormSubStartDate(dv ? dv.toString() : "")}
                            isDisabled={subStartMode === "queue"}
                        />
                    </div>

                    {/* Notes */}
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t('notesLabel')} <span className="text-muted-foreground/60">{t('notesHint')}</span></FieldLabel>
                        <TextArea
                            variant="secondary"
                            fullWidth
                            rows={2}
                            aria-label={t('notesLabel')}
                            placeholder={t('notesPlaceholder')}
                            value={formNotes}
                            onChange={e => setFormNotes(e.target.value)}
                        />
                    </div>

                    {/* Proof of transaction */}
                    <div className="flex flex-col gap-1.5">
                        <Label>{t('proofLabel')} <span className="font-normal opacity-60">{t('proofOptional')}</span></Label>
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
                        <ProofDropZone file={proofFile} onChange={setProofFile} />
                    </div>

                    <FieldErrorText msg={formError} />

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={closeForm}>
                            {tCommon('cancel')}
                        </Button>
                        <Button
                            type="submit"
                            isDisabled={submitting}
                            variant="primary"
                        >
                            {submitting
                                ? (editingTx ? t('saving') : t('recording'))
                                : (editingTx ? t('saveChanges') : t('recordTransaction'))}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

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
