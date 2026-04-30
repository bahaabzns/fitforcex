"use client";

import { useState, useEffect } from "react";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import api from "@/lib/axios";

// --- HELPERS ---
const EXCHANGE_RATES = {
    EGP: 1,
    USD: 50.5,
    SAR: 13.47,
    EUR: 55.2,
    GBP: 64.1,
};
const DISPLAY_CURRENCIES = Object.keys(EXCHANGE_RATES);
const TRANSACTION_TYPES = ["subscription", "session", "one-time", "other"];

function statusColor(status) {
    switch (status) {
        case "completed": return "bg-[#34C759]/10 text-[#34C759]";
        case "refunded":  return "bg-red-50 text-[#FF3B30]";
        default:          return "bg-[#F0F0F5] text-[#86868B]";
    }
}

function convert(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
    const toRate   = EXCHANGE_RATES[toCurrency]   || 1;
    return (amount * fromRate) / toRate;
}

function parseTransactionDate(dateStr) {
    return new Date(dateStr);
}

function todayStr() {
    return new Date().toISOString().split("T")[0];
}

function emptyForm() {
    return { clientName: "", packageVariation: "", paymentMethod: "", amount: "", currency: "EGP", type: "subscription", status: "completed", date: todayStr(), notes: "" };
}

// --- INNER TABLE COMPONENT (mirrors provided code) ---
function TransactionsTable({ transactions, allClientNames, allPackageVariations, allPaymentMethods, onStatusChange, onDelete }) {
    const [filteredRows, setFilteredRows] = useState(transactions);
    const [displayCurrency, setDisplayCurrency] = useState("EGP");

    const clientNames       = [...new Set([...allClientNames,       ...transactions.map(t => t.clientName).filter(Boolean)])];
    const packageVariations = [...new Set([...allPackageVariations, ...transactions.map(t => t.packageVariation).filter(Boolean)])];
    const paymentMethods    = [...new Set([...allPaymentMethods,    ...transactions.map(t => t.paymentMethod).filter(Boolean)])];

    function convertedSum(rows) {
        return rows.reduce((sum, t) => sum + convert(t.amount, t.currency, displayCurrency), 0);
    }

    const totalCompleted = convertedSum(filteredRows.filter(t => t.status === "completed"));
    const totalRefunded  = convertedSum(filteredRows.filter(t => t.status === "refunded"));

    const byPaymentMethod = {};
    for (const t of filteredRows) {
        if (!byPaymentMethod[t.paymentMethod]) byPaymentMethod[t.paymentMethod] = 0;
        byPaymentMethod[t.paymentMethod] += convert(t.amount, t.currency, displayCurrency);
    }

    const byCurrency = {};
    for (const t of filteredRows) {
        if (!byCurrency[t.currency]) byCurrency[t.currency] = 0;
        byCurrency[t.currency] += t.amount;
    }

    const columns = [
        { key: "id", label: "#", filterType: "text", sortable: true },
        { key: "clientName", label: "Client", filterType: "multi", options: clientNames, sortable: true },
        {
            key: "packageVariation",
            label: "Package",
            filterType: "multi",
            options: packageVariations,
            sortable: true,
            render: (row) => row.packageVariation || <span className="text-[#86868B]">—</span>,
        },
        {
            key: "amount",
            label: "Amount",
            sortable: true,
            render: (row) => <span className="font-medium text-[#1D1D1F]">{row.amount.toLocaleString()} {row.currency}</span>,
        },
        { key: "paymentMethod", label: "Payment Method", filterType: "multi", options: paymentMethods, sortable: true },
        {
            key: "type",
            label: "Type",
            filterType: "multi",
            options: TRANSACTION_TYPES,
            render: (row) => (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                    {row.type}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            filterType: "multi",
            options: ["completed", "refunded"],
            sortable: true,
            render: (row) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(row.status)}`}>
                    {row.status}
                </span>
            ),
        },
        {
            key: "date",
            label: "Date",
            filterType: "dateRange",
            sortable: true,
            render: (row) => new Date(row.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        },
        {
            key: "_actions",
            label: "",
            render: (row) => (
                <div className="flex gap-2 justify-end">
                    {row.status === "completed" && onStatusChange && (
                        <button
                            onClick={() => onStatusChange(row.id, "refunded")}
                            className="text-xs text-orange-500 hover:text-orange-600 cursor-pointer"
                        >
                            Refund
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={() => onDelete(row.id)}
                            className="text-xs text-[#FF3B30] hover:text-red-700 cursor-pointer"
                        >
                            Delete
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
                <span className="text-[#86868B] text-xs font-medium uppercase">Display currency</span>
                <select
                    value={displayCurrency}
                    onChange={(e) => setDisplayCurrency(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm focus:outline-none focus:border-[#007AFF] transition-colors"
                >
                    {DISPLAY_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-[#86868B] text-xs ml-1">
                    (1 {displayCurrency} ≈ {(EXCHANGE_RATES[displayCurrency] || 1).toFixed(2)} EGP)
                </span>
            </div>

            {/* Summary cards */}
            <div className="flex flex-wrap gap-3">
                <div className="card px-4 py-3">
                    <p className="text-[#86868B] text-xs font-medium uppercase">Completed</p>
                    <p className="text-[#34C759] text-lg font-bold mt-0.5">
                        {Math.round(totalCompleted).toLocaleString()} {displayCurrency}
                    </p>
                </div>
                <div className="card px-4 py-3">
                    <p className="text-[#86868B] text-xs font-medium uppercase">Refunded</p>
                    <p className="text-[#FF3B30] text-lg font-bold mt-0.5">
                        {Math.round(totalRefunded).toLocaleString()} {displayCurrency}
                    </p>
                </div>

                {Object.keys(byPaymentMethod).length > 0 && (
                    <div className="w-px bg-[#D2D2D7] mx-1 self-stretch" />
                )}

                {Object.entries(byPaymentMethod).map(([method, total]) => (
                    <div key={method} className="card px-4 py-3">
                        <p className="text-[#86868B] text-xs font-medium uppercase">{method}</p>
                        <p className="text-[#1D1D1F] text-lg font-bold mt-0.5">
                            {Math.round(total).toLocaleString()} {displayCurrency}
                        </p>
                    </div>
                ))}

                {Object.keys(byCurrency).length > 0 && (
                    <div className="w-px bg-[#D2D2D7] mx-1 self-stretch" />
                )}

                {Object.entries(byCurrency).map(([currency, total]) => (
                    <div key={currency} className="card px-4 py-3">
                        <p className="text-[#86868B] text-xs font-medium uppercase">{currency}</p>
                        <p className="text-[#007AFF] text-lg font-bold mt-0.5">{total.toLocaleString()} {currency}</p>
                    </div>
                ))}
            </div>

            <DataTable
                columns={columns}
                data={transactions}
                rowKey="id"
                dateParser={parseTransactionDate}
                onFilteredDataChange={setFilteredRows}
            />
        </>
    );
}

// --- PAGE ---
export default function TransactionsPage() {
    const [transactions, setTransactions]     = useState([]);
    const [clients, setClients]               = useState([]);
    const [packages, setPackages]             = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading]               = useState(true);
    const [showForm, setShowForm]             = useState(false);
    const [form, setForm]                     = useState(emptyForm());
    const [error, setError]                   = useState("");

    useEffect(() => {
        Promise.all([
            api.get("/api/transactions"),
            api.get("/api/clients"),
            api.get("/api/packages"),
            api.get("/api/payment-methods"),
        ]).then(([txRes, clientRes, pkgRes, pmRes]) => {
            setTransactions(txRes.data ?? []);
            setClients(clientRes.data ?? []);
            setPackages(pkgRes.data ?? []);
            setPaymentMethods((pmRes.data ?? []).filter(m => m.active));
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const allClientNames       = clients.map(c => `${c.fname} ${c.lname}`);
    const allPackageVariations = packages.flatMap(p => p.variations.map(v => `${p.name} — ${v.name}`));
    const allPaymentMethodNames = paymentMethods.map(m => m.name);

    function setField(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (!form.clientName.trim()) { setError("Client name is required."); return; }
        if (!form.paymentMethod)     { setError("Payment method is required."); return; }
        const amt = Number(form.amount);
        if (!Number.isFinite(amt) || amt <= 0) { setError("Amount must be a positive number."); return; }

        try {
            const res = await api.post("/api/transactions", {
                clientName:       form.clientName.trim(),
                packageVariation: form.packageVariation || null,
                paymentMethod:    form.paymentMethod,
                amount:           amt,
                currency:         form.currency,
                type:             form.type,
                status:           form.status,
                notes:            form.notes || null,
                date:             form.date,
            });
            setTransactions(prev => [res.data, ...prev]);
            setShowForm(false);
            setForm(emptyForm());
        } catch (err) {
            setError(err.response?.data?.error || "Failed to create transaction.");
        }
    }

    async function handleStatusChange(id, status) {
        try {
            const res = await api.put("/api/transactions", { id, status });
            setTransactions(prev => prev.map(t => t.id === id ? res.data : t));
        } catch (err) {
            console.error(err);
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete(`/api/transactions?id=${id}`);
            setTransactions(prev => prev.filter(t => t.id !== id));
        } catch (err) {
            console.error(err);
        }
    }

    if (loading) {
        return (
            <div className="p-6 flex flex-col gap-6">
                <h1 className="text-3xl font-bold text-[#1D1D1F]">Transactions</h1>
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl bg-[#F0F0F5] animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-[#1D1D1F]">Transactions</h1>
                <button
                    onClick={() => { setShowForm(true); setError(""); setForm(emptyForm()); }}
                    className="bg-[#007AFF] hover:bg-[#0056CC] text-white font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                    + New Transaction
                </button>
            </div>

            {/* Creation Modal */}
            <Modal open={showForm} onClose={() => { setShowForm(false); setError(""); }} title="New Transaction" wide>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Client name */}
                    <div>
                        <label className="block text-sm text-[#86868B] mb-1">Client</label>
                        <input
                            type="text"
                            list="client-names-list"
                            placeholder="Select or type client name..."
                            value={form.clientName}
                            onChange={(e) => setField("clientName", e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
                            autoFocus
                        />
                        <datalist id="client-names-list">
                            {allClientNames.map(n => <option key={n} value={n} />)}
                        </datalist>
                    </div>

                    {/* Package variation */}
                    <div>
                        <label className="block text-sm text-[#86868B] mb-1">Package <span className="text-[#86868B]/60">(optional)</span></label>
                        <select
                            value={form.packageVariation}
                            onChange={(e) => setField("packageVariation", e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
                        >
                            <option value="">— None —</option>
                            {allPackageVariations.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>

                    {/* Amount + Currency */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-[#86868B] mb-1">Amount</label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={form.amount}
                                onChange={(e) => setField("amount", e.target.value)}
                                className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[#86868B] mb-1">Currency</label>
                            <select
                                value={form.currency}
                                onChange={(e) => setField("currency", e.target.value)}
                                className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
                            >
                                {DISPLAY_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Payment method */}
                    <div>
                        <label className="block text-sm text-[#86868B] mb-1">Payment Method</label>
                        <select
                            value={form.paymentMethod}
                            onChange={(e) => setField("paymentMethod", e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
                        >
                            <option value="">— Select method —</option>
                            {allPaymentMethodNames.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-sm text-[#86868B] mb-1">Type</label>
                        <div className="flex gap-2 flex-wrap">
                            {TRANSACTION_TYPES.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setField("type", t)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                                        form.type === t
                                            ? "border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]"
                                            : "border-[#D2D2D7] bg-[#F5F5F7] text-[#86868B] hover:border-[#007AFF] hover:text-[#007AFF]"
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm text-[#86868B] mb-1">Status</label>
                        <div className="flex gap-2">
                            {["completed", "refunded"].map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setField("status", s)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors cursor-pointer border ${
                                        form.status === s
                                            ? s === "completed"
                                                ? "border-[#34C759] bg-[#34C759]/10 text-[#34C759]"
                                                : "border-[#FF3B30] bg-[#FF3B30]/10 text-[#FF3B30]"
                                            : "border-[#D2D2D7] bg-[#F5F5F7] text-[#86868B] hover:border-[#007AFF] hover:text-[#007AFF]"
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm text-[#86868B] mb-1">Date</label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => setField("date", e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm text-[#86868B] mb-1">Notes <span className="text-[#86868B]/60">(optional)</span></label>
                        <textarea
                            rows={2}
                            placeholder="Any additional notes..."
                            value={form.notes}
                            onChange={(e) => setField("notes", e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:border-[#007AFF] focus:bg-white transition-colors resize-none"
                        />
                    </div>

                    {error && <p className="text-[#FF3B30] text-sm">{error}</p>}

                    <button type="submit" className="bg-[#007AFF] hover:bg-[#0056CC] text-white font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer">
                        Record Transaction
                    </button>
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
            />
        </div>
    );
}
