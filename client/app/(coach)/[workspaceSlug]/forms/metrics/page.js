"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, BarChart2, Ruler, Camera } from "lucide-react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Tooltip } from "@heroui/react/tooltip";
import { Modal } from "@heroui/react/modal";

export default function MetricsPage() {
    const tCommon = useTranslations("common");
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({ name: "", type: "number", unit: "", description: "" });

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
        setForm({ name: "", type: "number", unit: "", description: "" });
        setError("");
        setShowCreate(true);
    }

    function openEdit(metric) {
        setForm({
            name: metric.name,
            type: metric.type,
            unit: metric.unit ?? "",
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

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-48 rounded-lg" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
        );
    }

    const columns = [
        {
            key: "name",
            label: "Name",
            filterType: "text",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                        {row.type === "image" ? <Camera size={15} /> : <Ruler size={15} />}
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                        {row.description && <p className="text-xs text-muted-foreground truncate">{row.description}</p>}
                    </div>
                </div>
            ),
        },
        {
            key: "type",
            label: "Type",
            filterType: "multi",
            options: ["number", "image"],
            optionLabel: (v) => v === "number" ? "Number" : "Photo",
            sortable: true,
            render: (row) => (
                <Chip size="sm" variant="soft" color={row.type === "number" ? "default" : "secondary"}>
                    {row.type === "number" ? "Number" : "Photo"}
                </Chip>
            ),
        },
        {
            key: "unit",
            label: "Unit",
            render: (row) => row.unit || <span className="text-muted-foreground">—</span>,
        },
        {
            key: "actions",
            label: "",
            cardPriority: "hidden",
            render: (row) => (
                <div className="flex items-center gap-1 justify-end">
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label="Edit" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>Edit</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label="Delete" className="text-destructive hover:text-red-700" onClick={() => setDeleteTarget(row)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>Delete</Tooltip.Content>
                    </Tooltip>
                </div>
            ),
        },
    ];

    return (
        <div className="p-6 flex flex-col gap-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Metrics</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage the measurements tracked in your check-in forms</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={metrics}
                rowKey="id"
                defaultSort="name"
                quickSearch={{ fields: ["name", "description"], placeholder: "Search metrics..." }}
                emptyState={{
                    icon: BarChart2,
                    title: "No metrics yet",
                    description: "Add your first metric to start tracking client progress",
                    action: { label: "Add Metric", onPress: openCreate },
                }}
                toolbarEnd={<Button variant="primary" onClick={openCreate}>Add Metric</Button>}
            />

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
                                        <option value="number">Number — collect a measurement value</option>
                                        <option value="image">Photo — collect a progress photo</option>
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
