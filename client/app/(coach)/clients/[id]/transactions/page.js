"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";

const EXCHANGE_RATES = { EGP: 1, USD: 50.5, SAR: 13.47, EUR: 55.2, GBP: 64.1 };

const TYPE_COLORS = {
    subscription: "bg-blue-50 text-blue-600",
    session:      "bg-purple-50 text-purple-600",
    "one-time":   "bg-orange-50 text-orange-600",
    other:        "bg-[#F0F0F5] text-[#86868B]",
};

function StatusBadge({ status }) {
    const cls = status === "completed"
        ? "bg-[#34C759]/10 text-[#34C759]"
        : "bg-red-50 text-[#FF3B30]";
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
            {status}
        </span>
    );
}

export default function ClientTransactionsPage() {
    const { id } = useParams();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/api/transactions/by-client/${id}`)
            .then(res => setTransactions(res.data ?? []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    async function handleRefund(tx) {
        try {
            const res = await api.put("/api/transactions", { id: tx.id, status: "refunded" });
            setTransactions(prev => prev.map(t => t.id === tx.id ? res.data : t));
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

    if (loading) {
        return (
            <div className="p-6 flex flex-col gap-4">
                {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl bg-[#F0F0F5] animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card">
                    <p className="text-xs text-[#86868B] font-medium">Total</p>
                    <p className="text-2xl font-bold text-[#1D1D1F] mt-1">{transactions.length}</p>
                </div>
                <div className="card">
                    <p className="text-xs text-[#86868B] font-medium">Completed</p>
                    <p className="text-2xl font-bold text-[#34C759] mt-1">{completedTx.length}</p>
                </div>
                <div className="card">
                    <p className="text-xs text-[#86868B] font-medium">Refunded</p>
                    <p className="text-2xl font-bold text-[#FF3B30] mt-1">{refundedTx.length}</p>
                </div>
                <div className="card">
                    <p className="text-xs text-[#86868B] font-medium">Revenue (EGP equiv.)</p>
                    <p className="text-2xl font-bold text-[#007AFF] mt-1">
                        {totalEGP.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                    {Object.keys(byCurrency).length > 0 && (
                        <div className="flex flex-col gap-0.5 mt-1">
                            {Object.entries(byCurrency).map(([cur, amt]) => (
                                <span key={cur} className="text-xs text-[#86868B]">
                                    {amt.toLocaleString()} {cur}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            {transactions.length === 0 ? (
                <div className="card text-[#86868B] text-sm">No transactions yet.</div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-[#D2D2D7]">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[#F5F5F7] border-b border-[#D2D2D7]">
                                {["Date", "Package", "Amount", "Method", "Type", "Status", ""].map(h => (
                                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#86868B] whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx, i) => (
                                <tr key={tx.id} className={`border-b border-[#F0F0F5] ${i % 2 === 0 ? "bg-white" : "bg-[#F5F5F7]/40"}`}>
                                    <td className="px-4 py-2.5 text-[#86868B] whitespace-nowrap">
                                        {new Date(tx.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                    </td>
                                    <td className="px-4 py-2.5 text-[#1D1D1F] max-w-[180px] truncate">
                                        {tx.packageVariation || "—"}
                                    </td>
                                    <td className="px-4 py-2.5 font-medium text-[#1D1D1F] whitespace-nowrap">
                                        {tx.amount.toLocaleString()} {tx.currency}
                                    </td>
                                    <td className="px-4 py-2.5 text-[#86868B] whitespace-nowrap">{tx.paymentMethod}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_COLORS[tx.type] ?? "bg-[#F0F0F5] text-[#86868B]"}`}>
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <StatusBadge status={tx.status} />
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        {tx.status === "completed" && (
                                            <button
                                                onClick={() => handleRefund(tx)}
                                                className="text-xs text-orange-500 hover:text-orange-700 transition-colors cursor-pointer"
                                            >
                                                Refund
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
