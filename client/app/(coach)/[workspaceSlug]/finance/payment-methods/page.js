"use client";

import { useState, useEffect } from "react";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import api from "@/lib/axios";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";

const TYPES = ["cash", "card", "wallet", "bank_transfer"];

const TYPE_COLORS = {
    cash:          "bg-emerald-500/15 text-emerald-600",
    card:          "bg-accent/15 text-accent",
    wallet:        "bg-purple-500/15 text-purple-600",
    bank_transfer: "bg-orange-500/15 text-orange-600",
};

const editInputCls = "w-full px-2 py-1 rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const activeBadge   = "bg-green-500/15 text-green-600 hover:bg-green-500/25";
const inactiveBadge = "bg-secondary text-muted-foreground hover:bg-secondary/80";

export default function PaymentMethodsPage() {
    const t = useTranslations('paymentMethods');
    const tCommon = useTranslations('common');
    const locale = useLocale();

    const TYPE_LABELS_I18N = {
        cash:          t('typeCash'),
        card:          t('typeCard'),
        wallet:        t('typeWallet'),
        bank_transfer: t('typeBankTransfer'),
    };

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
            label: t('nameLabel'),
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
            label: t('typeLabel'),
            filterType: "multi",
            options: TYPES.map(type => TYPE_LABELS_I18N[type]),
            sortable: true,
            render: (row) => {
                if (editingId === row.id) {
                    return (
                        <select
                            value={editData.type}
                            onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                            className="px-2 py-1 rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            {TYPES.map(typeKey => (
                                <option key={typeKey} value={typeKey}>{TYPE_LABELS_I18N[typeKey]}</option>
                            ))}
                        </select>
                    );
                }
                return (
                    <Chip size="sm" className={`${TYPE_COLORS[row._typeRaw] ?? "bg-secondary text-muted-foreground"}`}>
                        {row.type}
                    </Chip>
                );
            },
        },
        {
            key: "active",
            label: t('statusLabel'),
            filterType: "multi",
            options: [t('active'), t('inactive')],
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
                            {editData.active ? t('active') : t('inactive')}
                        </button>
                    );
                }
                return (
                    <button
                        onClick={() => handleToggleActive(row.id, row._activeRaw)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                            row._activeRaw ? activeBadge : inactiveBadge
                        }`}
                    >
                        {row.active}
                    </button>
                );
            },
        },
        {
            key: "created_at",
            label: t('createdLabel'),
            filterType: "dateRange",
            sortable: true,
            render: (row) => new Date(row.created_at).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }),
        },
        {
            key: "_actions",
            label: "",
            render: (row) => {
                if (editingId === row.id) {
                    return (
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => handleSaveEdit(row)} className="text-xs text-primary hover:text-primary/80 cursor-pointer">{t('save')}</button>
                            <button onClick={() => { setEditingId(null); setError(""); }} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">{tCommon('cancel')}</button>
                        </div>
                    );
                }
                return (
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => startEdit(row)} className="text-xs text-primary hover:text-primary/80 cursor-pointer">{tCommon('edit')}</button>
                        <button onClick={() => handleDelete(row.id)} className="text-xs text-destructive hover:text-red-700 cursor-pointer">{tCommon('delete')}</button>
                    </div>
                );
            },
        },
    ];

    const displayRows = methods.map(m => ({
        ...m,
        _typeRaw: m.type,
        _activeRaw: m.active,
        type: TYPE_LABELS_I18N[m.type] ?? m.type,
        active: m.active ? t('active') : t('inactive'),
    }));

    const activeCount = methods.filter(m => m.active).length;
    const typeCounts = TYPES.reduce((acc, typeKey) => {
        acc[typeKey] = methods.filter(m => m.type === typeKey).length;
        return acc;
    }, {});

    async function handleToggleActive(id, currentActive) {
        try {
            const res = await api.put("/api/payment-methods", { id, active: !currentActive });
            setMethods(prev => prev.map(m => m.id === id ? res.data : m));
        } catch (err) {
            setError(err.response?.data?.error || t('errorUpdate'));
        }
    }

    function startEdit(row) {
        setEditingId(row.id);
        setError("");
        setEditData({ name: row.name, type: row._typeRaw, active: row._activeRaw });
    }

    async function handleSaveEdit(row) {
        if (!editData.name?.trim()) { setError(t('errorNameRequired')); return; }
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
            setError(err.response?.data?.error || t('errorSave'));
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete(`/api/payment-methods?id=${id}`);
            setMethods(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            setError(err.response?.data?.error || t('errorDelete'));
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (!formName.trim()) { setError(t('errorNameRequired')); return; }
        try {
            const res = await api.post("/api/payment-methods", { name: formName.trim(), type: formType });
            setMethods(prev => [...prev, res.data]);
            setFormName("");
            setFormType("cash");
            setShowForm(false);
        } catch (err) {
            setError(err.response?.data?.error || t('errorCreate'));
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

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Card>
                    <Card.Content className="p-6">
                        <p className="text-sm text-muted-foreground font-medium">{t('total')}</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{methods.length}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t('activeCount', { count: activeCount })}</p>
                    </Card.Content>
                </Card>
                {TYPES.map(typeKey => (
                    <Card key={typeKey}>
                        <Card.Content className="p-6">
                            <p className="text-sm text-muted-foreground font-medium">{TYPE_LABELS_I18N[typeKey]}</p>
                            <p className="text-2xl font-bold text-foreground mt-1">{typeCounts[typeKey]}</p>
                            <Chip size="sm" className={`text-xs mt-1 ${TYPE_COLORS[typeKey]}`}>{typeKey}</Chip>
                        </Card.Content>
                    </Card>
                ))}
            </div>

            {/* Error from edit/delete */}
            {!showForm && error && <p className="text-destructive text-sm">{error}</p>}

            {/* Creation Modal */}
            <Modal open={showForm} onClose={() => { setShowForm(false); setError(""); }} title={t('newMethodTitle')}>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('nameLabel')}</label>
                        <input
                            type="text"
                            placeholder={t('namePlaceholder')}
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground mb-1">{t('typeLabel')}</label>
                        <div className="flex gap-2 flex-wrap">
                            {TYPES.map(typeKey => (
                                <Button
                                    key={typeKey}
                                    type="button"
                                    onClick={() => setFormType(typeKey)}
                                    className={`px-3 py-1.5 text-sm font-medium border ${
                                        formType === typeKey
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                                    }`}
                                >
                                    {TYPE_LABELS_I18N[typeKey]}
                                </Button>
                            ))}
                        </div>
                    </div>
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <Button type="submit" variant="primary" fullWidth>
                        {t('createMethod')}
                    </Button>
                </form>
            </Modal>

            {/* Table */}
            <DataTable
                columns={columns}
                data={displayRows}
                rowKey="id"
                quickSearch={{ fields: ["name", "type"], placeholder: t('searchPlaceholder') }}
                toolbarEnd={<Button variant="primary" onClick={() => { setShowForm(true); setError(""); setFormName(""); setFormType("cash"); }}>{t('newMethod')}</Button>}
            />
        </div>
    );
}
