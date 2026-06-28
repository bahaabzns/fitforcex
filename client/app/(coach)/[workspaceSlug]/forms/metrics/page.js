"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, BarChart2 } from "lucide-react";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Modal } from "@heroui/react/modal";

const EMOJI_SUGGESTIONS = ["⚖️", "📏", "📊", "💪", "📷", "🏃", "🔥", "❤️", "🩺", "💧"];

export default function MetricsPage() {
    const tCommon = useTranslations("common");
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({ name: "", type: "number", unit: "", icon: "", description: "" });

    async function load() {
        try {
            const res = await api.get("/api/metrics");
            setMetrics(res.data ?? []);
        } catch {
            // silently ignore — auto-seed happens server-side
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function openCreate() {
        setForm({ name: "", type: "number", unit: "", icon: "", description: "" });
        setError("");
        setShowCreate(true);
    }

    function openEdit(metric) {
        setForm({
            name: metric.name,
            type: metric.type,
            unit: metric.unit ?? "",
            icon: metric.icon ?? "",
            description: metric.description ?? "",
        });
        setError("");
        setEditing(metric);
    }

    async function handleCreate(e) {
        e.preventDefault();
        if (!form.name.trim()) { setError("Name is required"); return; }
        setSaving(true);
        setError("");
        try {
            const res = await api.post("/api/metrics", {
                name: form.name.trim(),
                type: form.type,
                unit: form.type === "number" ? (form.unit.trim() || null) : null,
                icon: form.icon.trim() || null,
                description: form.description.trim() || null,
            });
            setMetrics(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
            setShowCreate(false);
        } catch (err) {
            setError(err?.response?.data?.error || "Failed to create metric");
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdate(e) {
        e.preventDefault();
        if (!editing) return;
        if (!form.name.trim()) { setError("Name is required"); return; }
        setSaving(true);
        setError("");
        try {
            const res = await api.put(`/api/metrics/${editing.id}`, {
                name: form.name.trim(),
                unit: editing.type === "number" ? (form.unit.trim() || null) : null,
                icon: form.icon.trim() || null,
                description: form.description.trim() || null,
            });
            setMetrics(prev => prev.map(m => m.id === editing.id ? res.data : m).sort((a, b) => a.name.localeCompare(b.name)));
            setEditing(null);
        } catch (err) {
            setError(err?.response?.data?.error || "Failed to update metric");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setSaving(true);
        try {
            await api.delete(`/api/metrics/${deleteTarget.id}`);
            setMetrics(prev => prev.filter(m => m.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (err) {
            setError(err?.response?.data?.error || "Failed to delete metric");
        } finally {
            setSaving(false);
        }
    }

    const numberMetrics = metrics.filter(m => m.type === "number");
    const imageMetrics  = metrics.filter(m => m.type === "image");

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-48 rounded-lg" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
        );
    }

    return (
        <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Metrics</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage the measurements tracked in your check-in forms</p>
                </div>
                <Button variant="primary" onClick={openCreate}>
                    Add Metric
                </Button>
            </div>

            {/* Number metrics */}
            <MetricGroup
                title="Number Metrics"
                icon="📊"
                metrics={numberMetrics}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
            />

            {/* Image / photo metrics */}
            <MetricGroup
                title="Photo Metrics"
                icon="📷"
                metrics={imageMetrics}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
            />

            {metrics.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                    <BarChart2 size={36} className="text-border" />
                    <p className="text-sm font-medium text-muted-foreground">No metrics yet</p>
                    <p className="text-xs text-muted-foreground">Add your first metric to start tracking client progress</p>
                    <Button variant="primary" size="sm" onClick={openCreate}>Add Metric</Button>
                </div>
            )}

            {/* Create modal */}
            <MetricModal
                isOpen={showCreate}
                title="Add Metric"
                form={form}
                setForm={setForm}
                onClose={() => setShowCreate(false)}
                onSubmit={handleCreate}
                saving={saving}
                error={error}
                typeEditable
            />

            {/* Edit modal */}
            <MetricModal
                isOpen={!!editing}
                title="Edit Metric"
                form={form}
                setForm={setForm}
                onClose={() => setEditing(null)}
                onSubmit={handleUpdate}
                saving={saving}
                error={error}
                typeEditable={false}
            />

            {/* Delete confirm modal */}
            <Modal isOpen={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <Modal.Backdrop>
                    <Modal.Container className="max-w-sm">
                        <Modal.Dialog>
                            <Modal.Header>
                                <Modal.Heading>Delete Metric</Modal.Heading>
                                <Modal.CloseTrigger />
                            </Modal.Header>
                            <Modal.Body>
                                <p className="text-sm text-muted-foreground">
                                    Delete <strong>{deleteTarget?.name}</strong>? Historical data from past form submissions will be preserved, but the metric will no longer appear in the form builder.
                                </p>
                            </Modal.Body>
                            <Modal.Footer className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(null)} isDisabled={saving}>
                                    {tCommon("cancel")}
                                </Button>
                                <Button size="sm" variant="danger" onClick={handleDelete} isLoading={saving}>
                                    Delete
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </div>
    );
}

function MetricGroup({ title, icon, metrics, onEdit, onDelete }) {
    if (metrics.length === 0) return null;
    return (
        <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>{icon}</span> {title}
            </p>
            <div className="flex flex-col gap-1.5">
                {metrics.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-default transition-colors group">
                        <span className="text-xl shrink-0 w-7 text-center">{m.icon || "📊"}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                            {m.description && <p className="text-xs text-muted-foreground truncate">{m.description}</p>}
                        </div>
                        {m.unit && (
                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border shrink-0">
                                {m.unit}
                            </span>
                        )}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                                onClick={() => onEdit(m)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-default transition-colors cursor-pointer"
                                title="Edit"
                            >
                                <Pencil size={13} />
                            </button>
                            <button
                                onClick={() => onDelete(m)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                title="Delete"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MetricModal({ isOpen, title, form, setForm, onClose, onSubmit, saving, error, typeEditable }) {
    const isNumber = form.type === "number";

    return (
        <Modal isOpen={isOpen} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop>
                <Modal.Container className="max-w-md">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{title}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>
                            <form id="metric-form" onSubmit={onSubmit} className="flex flex-col gap-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">
                                        Name <span className="text-destructive">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="e.g. Weight, Waist, Body Fat"
                                        className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary transition-colors"
                                    />
                                </div>

                                {/* Type */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Type</label>
                                    <select
                                        value={form.type}
                                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                        disabled={!typeEditable}
                                        className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="number">📊 Number — collect a measurement value</option>
                                        <option value="image">📷 Photo — collect a progress photo</option>
                                    </select>
                                    {!typeEditable && (
                                        <p className="text-xs text-muted-foreground mt-1">Type cannot be changed after creation</p>
                                    )}
                                </div>

                                {/* Unit — only for number type */}
                                {isNumber && (
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Unit</label>
                                        <input
                                            type="text"
                                            value={form.unit}
                                            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                                            placeholder="e.g. kg, cm, %, lbs"
                                            className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary transition-colors"
                                        />
                                    </div>
                                )}

                                {/* Icon */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Icon</label>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        {EMOJI_SUGGESTIONS.map(e => (
                                            <button
                                                key={e}
                                                type="button"
                                                onClick={() => setForm(f => ({ ...f, icon: e }))}
                                                className={`w-8 h-8 rounded-lg border text-lg flex items-center justify-center transition-colors cursor-pointer ${
                                                    form.icon === e ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                                                }`}
                                            >
                                                {e}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={form.icon}
                                        onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                                        placeholder="Or paste any emoji"
                                        className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary transition-colors"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                                    <input
                                        type="text"
                                        value={form.description}
                                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Short description shown to clients"
                                        className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary transition-colors"
                                    />
                                </div>

                                {error && (
                                    <p className="text-sm text-destructive">{error}</p>
                                )}
                            </form>
                        </Modal.Body>
                        <Modal.Footer className="flex justify-end gap-2 pt-2">
                            <Button size="sm" variant="ghost" onClick={onClose} isDisabled={saving}>
                                Cancel
                            </Button>
                            <Button size="sm" variant="primary" type="submit" form="metric-form" isLoading={saving}>
                                Save
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
