"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import DataTable from "@/app/components/DataTable";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";

export default function MuscleGroupsPage() {
    const t = useTranslations("muscleGroups");
    const tCommon = useTranslations("common");
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newNameEn, setNewNameEn] = useState("");
    const [newNameAr, setNewNameAr] = useState("");
    const [editing, setEditing] = useState(null);

    async function load() {
        try {
            const res = await api.get("/api/training/muscle-groups");
            setGroups(res.data ?? []);
        } catch (err) {
            console.error("Failed to load muscle groups:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleAdd(e) {
        e.preventDefault();
        if (!newNameEn.trim()) return;
        try {
            const res = await api.post("/api/training/muscle-groups", { name_en: newNameEn.trim(), name_ar: newNameAr.trim() || null });
            setGroups((prev) => [...prev, res.data]);
            setNewNameEn("");
            setNewNameAr("");
            setShowForm(false);
        } catch (err) {
            console.error("Failed to add muscle group:", err);
        }
    }

    async function handleUpdate(e) {
        e.preventDefault();
        if (!editing) return;
        try {
            const res = await api.put(`/api/training/muscle-groups/${editing.id}`, { name_en: editing.name_en, name_ar: editing.name_ar || null });
            setGroups((prev) => prev.map((g) => (g.id === editing.id ? res.data : g)));
            setEditing(null);
        } catch (err) {
            console.error("Failed to update muscle group:", err);
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete(`/api/training/muscle-groups/${id}`);
            setGroups((prev) => prev.filter((g) => g.id !== id));
        } catch (err) {
            console.error("Failed to delete muscle group:", err);
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
        { key: "name_en", label: t("columnNameEn"), filterType: "text", sortable: true },
        { key: "name_ar", label: t("columnNameAr"), render: (row) => <span dir="rtl">{row.name_ar || "—"}</span> },
        { key: "exercise_count", label: t("columnExercises"), sortable: true },
        {
            key: "actions",
            label: t("columnActions"),
            cardPriority: "hidden",
            render: (row) => (
                <div className="flex gap-2">
                    <button onClick={() => setEditing(row)} className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted px-3 py-1 text-sm transition-colors cursor-pointer">{t("editButton")}</button>
                    <button onClick={() => handleDelete(row.id)} className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1 text-sm transition-colors cursor-pointer">{t("deleteButton")}</button>
                </div>
            ),
        },
    ];

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
            </div>

            <Modal open={showForm} onClose={() => { setShowForm(false); setNewNameEn(""); setNewNameAr(""); }} title={t("addTitle")}>
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                            <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} value={newNameEn} onChange={setNewNameEn}>
                                <Input type="text" placeholder={t("placeholderNameEn")} autoFocus />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel>{t("labelNameAr")}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} value={newNameAr} onChange={setNewNameAr}>
                                <Input type="text" placeholder={t("placeholderNameAr")} dir="rtl" />
                            </TextField>
                        </div>
                    </div>
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setNewNameEn(""); setNewNameAr(""); }}>{tCommon("cancel")}</Button>
                        <Button type="submit" variant="primary">{t("submitAdd")}</Button>
                    </ModalFooter>
                </form>
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} title={t("editTitle")}>
                <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                            <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} value={editing?.name_en ?? ""} onChange={(val) => setEditing((prev) => ({ ...prev, name_en: val }))}>
                                <Input type="text" autoFocus />
                            </TextField>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <FieldLabel>{t("labelNameAr")}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} value={editing?.name_ar ?? ""} onChange={(val) => setEditing((prev) => ({ ...prev, name_ar: val }))}>
                                <Input type="text" dir="rtl" />
                            </TextField>
                        </div>
                    </div>
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => setEditing(null)}>{tCommon("cancel")}</Button>
                        <Button type="submit" variant="primary">{t("submitEdit")}</Button>
                    </ModalFooter>
                </form>
            </Modal>

            <DataTable
                columns={columns}
                data={groups}
                rowKey="id"
                quickSearch={{ fields: ["name_en", "name_ar"], placeholder: t("searchPlaceholder") }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(true)}>{t("addButton")}</Button>}
            />
        </div>
    );
}
