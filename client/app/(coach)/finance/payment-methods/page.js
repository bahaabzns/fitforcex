"use client";

import { useState, useEffect } from "react";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import api from "@/lib/axios";

const TYPES = ["cash", "card", "wallet", "bank_transfer"];

const TYPE_LABELS = {
    cash:          "Cash",
    card:          "Card",
    wallet:        "Wallet",
    bank_transfer: "Bank Transfer",
};

const TYPE_COLORS = {
    cash:          "bg-emerald-50 text-emerald-700",
    card:          "bg-blue-50 text-blue-600",
    wallet:        "bg-purple-50 text-purple-600",
    bank_transfer: "bg-orange-50 text-orange-600",
};

const editInputCls = "w-full px-2 py-1 rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const activeBadge   = "bg-green-100 text-green-600 hover:bg-green-100/80";
const inactiveBadge = "bg-secondary text-muted-foreground hover:bg-secondary/80";

export default function PaymentMethodsPage() {
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState("");
    const [formType, setFormType] = useState("cash");
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    useEffect(() => {
        api.get("/api/payment-methods")
            .then(res => setMethods(res.data ?? []))
            .catch(() => setMethods([]))
            .finally(() => setLoading(false));
    }, []);

    const columns = [
        {
            key: "name",
            label: "Name",
            filterType: "text",
            sortable: true,
            render: (row) => {
                if (editingId === row.id) {
                    return (
                        <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className={editInputCls}
                        />
                    );
                }
                return <span className="font-medium text-foreground">{row.name}</span>;
            },
        },
        {
            key: "type",
            label: "Type",
            filterType: "multi",
            options: TYPES.map(t => TYPE_LABELS[t]),
            sortable: true,
            render: (row) => {
                if (editingId === row.id) {
                    return (
                        <select
                            value={editData.type}
                            onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                            className="px-2 py-1 rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {TYPES.map(t => (
                                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                            ))}
                        </select>
                    );
                }
                return (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[row._typeRaw] ?? "bg-secondary text-muted-foreground"}`}>
                        {row.type}
                    </span>
                );
            },
        },
        {
            key: "active",
            label: "Status",
            filterType: "multi",
            options: ["Active", "Inactive"],
            render: (row) => {
                if (editingId === row.id) {
                    return (
                        <button
                            type="button"
                            onClick={() => setEditData({ ...editData, active: !editData.active })}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                editData.active ? activeBadge : inactiveBadge
                            }`}
                        >
                            {editData.active ? "Active" : "Inactive"}
                        </button>
                    );
                }
                return (
                    <button
                        onClick={() => handleToggleActive(row.id, row._activeRaw)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                            row.active === "Active" ? activeBadge : inactiveBadge
                        }`}
                    >
                        {row.active}
                    </button>
                );
            },
        },
        {
            key: "created_at",
            label: "Created",
            filterType: "dateRange",
            sortable: true,
            render: (row) => new Date(row.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        },
        {
            key: "_actions",
            label: "",
            render: (row) => {
                if (editingId === row.id) {
                    return (
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => handleSaveEdit(row)} className="text-xs text-primary hover:text-primary/80 cursor-pointer">Save</button>
                            <button onClick={() => { setEditingId(null); setError(""); }} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
                        </div>
                    );
                }
                return (
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => startEdit(row)} className="text-xs text-primary hover:text-primary/80 cursor-pointer">Edit</button>
                        <button onClick={() => handleDelete(row.id)} className="text-xs text-destructive hover:text-red-700 cursor-pointer">Delete</button>
                    </div>
                );
            },
        },
    ];

    const displayRows = methods.map(m => ({
        ...m,
        _typeRaw: m.type,
        _activeRaw: m.active,
        type: TYPE_LABELS[m.type] ?? m.type,
        active: m.active ? "Active" : "Inactive",
    }));

    const activeCount = methods.filter(m => m.active).length;
    const typeCounts = TYPES.reduce((acc, t) => {
        acc[t] = methods.filter(m => m.type === t).length;
        return acc;
    }, {});

    async function handleToggleActive(id, currentActive) {
        try {
            const res = await api.put("/api/payment-methods", { id, active: !currentActive });
            setMethods(prev => prev.map(m => m.id === id ? res.data : m));
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update");
        }
    }

    function startEdit(row) {
        setEditingId(row.id);
        setError("");
        setEditData({ name: row.name, type: row._typeRaw, active: row._activeRaw });
    }

    async function handleSaveEdit(row) {
        if (!editData.name?.trim()) { setError("Name is required"); return; }
        try {
            const res = await api.put("/api/payment-methods", {
                id: row.id,
                name: editData.name.trim(),
                type: editData.type,
                active: editData.active,
            });
            setMethods(prev => prev.map(m => m.id === row.id ? res.data : m));
            setEditingId(null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.error || "Failed to save changes");
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete(`/api/payment-methods?id=${id}`);
            setMethods(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            setError(err.response?.data?.error || "Failed to delete");
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (!formName.trim()) { setError("Name is required."); return; }
        try {
            const res = await api.post("/api/payment-methods", { name: formName.trim(), type: formType });
            setMethods(prev => [...prev, res.data]);
            setFormName("");
            setFormType("cash");
            setShowForm(false);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to create payment method.");
        }
    }

    if (loading) {
        return (
            <div className="p-6 flex flex-col gap-6">
                <h1 className="text-3xl font-bold text-foreground">Payment Methods</h1>
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-secondary animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-foreground">Payment Methods</h1>
                <button
                    onClick={() => { setShowForm(true); setError(""); setFormName(""); setFormType("cash"); }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
                >
                    + New Method
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <p className="text-sm text-muted-foreground font-medium">Total</p>
                    <p className="card-number">{methods.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activeCount} active</p>
                </div>
                {TYPES.map(t => (
                    <div key={t} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <p className="text-sm text-muted-foreground font-medium">{TYPE_LABELS[t]}</p>
                        <p className="card-number">{typeCounts[t]}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full w-fit mt-1 inline-block ${TYPE_COLORS[t]}`}>{t}</span>
                    </div>
                ))}
            </div>

            {/* Error from edit/delete */}
            {!showForm && error && <p className="text-destructive text-sm">{error}</p>}

            {/* Creation Modal */}
            <Modal open={showForm} onClose={() => { setShowForm(false); setError(""); }} title="New Payment Method">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Vodafone Cash, Visa Card..."
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">Type</label>
                        <div className="flex gap-2 flex-wrap">
                            {TYPES.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setFormType(t)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                                        formType === t
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                                    }`}
                                >
                                    {TYPE_LABELS[t]}
                                </button>
                            ))}
                        </div>
                    </div>
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition-colors cursor-pointer">
                        Create Method
                    </button>
                </form>
            </Modal>

            {/* Table */}
            <DataTable
                columns={columns}
                data={displayRows}
                rowKey="id"
            />
        </div>
    );
}
