"use client";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import DataTable from "@/app/components/DataTable";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";
const labelCls = "text-xs text-muted-foreground mb-1 block";

export default function EquipmentPage() {
    const [equipments, setEquipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newNameEn, setNewNameEn] = useState("");
    const [newNameAr, setNewNameAr] = useState("");
    const [editing, setEditing] = useState(null);

    async function load() {
        try {
            const res = await api.get("/api/training/equipments");
            setEquipments(res.data ?? []);
        } catch (err) {
            console.error("Failed to load equipments:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleAdd(e) {
        e.preventDefault();
        if (!newNameEn.trim()) return;
        try {
            const res = await api.post("/api/training/equipments", { name_en: newNameEn.trim(), name_ar: newNameAr.trim() || null });
            setEquipments((prev) => [...prev, res.data]);
            setNewNameEn("");
            setNewNameAr("");
            setShowForm(false);
        } catch (err) {
            console.error("Failed to add equipment:", err);
        }
    }

    async function handleUpdate(e) {
        e.preventDefault();
        if (!editing) return;
        try {
            const res = await api.put(`/api/training/equipments/${editing.id}`, { name_en: editing.name_en, name_ar: editing.name_ar || null });
            setEquipments((prev) => prev.map((g) => (g.id === editing.id ? res.data : g)));
            setEditing(null);
        } catch (err) {
            console.error("Failed to update equipment:", err);
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete(`/api/training/equipments/${id}`);
            setEquipments((prev) => prev.filter((g) => g.id !== id));
        } catch (err) {
            console.error("Failed to delete equipment:", err);
        }
    }

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-48 rounded-lg" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const columns = [
        { key: "name_en", label: "Name (EN)", filterType: "text", sortable: true },
        { key: "name_ar", label: "الاسم (AR)", render: (row) => <span dir="rtl">{row.name_ar || "—"}</span> },
        { key: "exercise_count", label: "Exercises", sortable: true },
        {
            key: "actions",
            label: "Actions",
            cardPriority: "hidden",
            render: (row) => (
                <div className="flex gap-2">
                    <button onClick={() => setEditing(row)} className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted px-3 py-1 text-sm transition-colors cursor-pointer">Edit</button>
                    <button onClick={() => handleDelete(row.id)} className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1 text-sm transition-colors cursor-pointer">Delete</button>
                </div>
            ),
        },
    ];

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Equipment</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage equipment categories for your exercise library.</p>
            </div>

            <Modal open={showForm} onClose={() => { setShowForm(false); setNewNameEn(""); setNewNameAr(""); }} title="Add Equipment">
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Name (English) *</label>
                            <input className={inputCls} placeholder="e.g. Barbell" value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} required autoFocus />
                        </div>
                        <div>
                            <label className={labelCls}>الاسم (عربي)</label>
                            <input className={inputCls} placeholder="مثال: بار" value={newNameAr} onChange={(e) => setNewNameAr(e.target.value)} dir="rtl" />
                        </div>
                    </div>
                    <Button type="submit" variant="primary" fullWidth>Add Equipment</Button>
                </form>
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Equipment">
                <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Name (English) *</label>
                            <input className={inputCls} value={editing?.name_en ?? ""} onChange={(e) => setEditing((prev) => ({ ...prev, name_en: e.target.value }))} required autoFocus />
                        </div>
                        <div>
                            <label className={labelCls}>الاسم (عربي)</label>
                            <input className={inputCls} value={editing?.name_ar ?? ""} onChange={(e) => setEditing((prev) => ({ ...prev, name_ar: e.target.value }))} dir="rtl" />
                        </div>
                    </div>
                    <Button type="submit" variant="primary" fullWidth>Save Changes</Button>
                </form>
            </Modal>

            <DataTable
                columns={columns}
                data={equipments}
                rowKey="id"
                quickSearch={{ fields: ["name_en", "name_ar"], placeholder: "Search equipment..." }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(true)}>+ Add Equipment</Button>}
            />
        </div>
    );
}
