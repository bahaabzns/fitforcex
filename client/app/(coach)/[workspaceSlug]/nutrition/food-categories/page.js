'use client';
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";

export default function FoodCategoriesPage() {
    const t = useTranslations("foodCategories");
    const tCommon = useTranslations("common");
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newNameEn, setNewNameEn] = useState('');
    const [newNameAr, setNewNameAr] = useState('');
    const [editingItem, setEditingItem] = useState(null);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/api/nutrition/food-categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Error fetching food categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCategories(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newNameEn.trim()) return;
        try {
            await api.post('/api/nutrition/food-categories', { name_en: newNameEn.trim(), name_ar: newNameAr.trim() || null });
            setNewNameEn('');
            setNewNameAr('');
            setShowForm(false);
            await fetchCategories();
        } catch (error) {
            console.error('Error adding food category:', error);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/nutrition/food-categories/${editingItem.id}`, { name_en: editingItem.name_en, name_ar: editingItem.name_ar || null });
            setEditingItem(null);
            await fetchCategories();
        } catch (error) {
            console.error('Error updating food category:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/nutrition/food-categories/${id}`);
            setCategories(categories.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting food category:', error);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-44 rounded-lg" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const categoryColumns = [
        { key: "name_en", label: t("columnNameEn"), filterType: "text", sortable: true },
        { key: "name_ar", label: t("columnNameAr"), render: (row) => <span dir="rtl">{row.name_ar || "—"}</span> },
        { key: "food_item_count", label: t("columnFoodItems"), sortable: true },
        { key: "actions", label: t("columnActions"), cardPriority: "hidden", render: (row) => (
            <div className="flex items-center gap-1">
                <Tooltip>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={t("editButton")} onClick={() => setEditingItem(row)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Tooltip.Content>{t("editButton")}</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={t("deleteButton")} className="text-destructive hover:text-red-700" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Tooltip.Content>{t("deleteButton")}</Tooltip.Content>
                </Tooltip>
            </div>
        )},
    ];

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
            </div>

            <Modal open={showForm} onClose={() => { setShowForm(false); setNewNameEn(''); setNewNameAr(''); }} title={t("addTitle")}>
                <form onSubmit={handleAdd} className="flex flex-col gap-5 px-1 py-1">
                    <div className="flex gap-2">
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                            <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} value={newNameEn} onChange={setNewNameEn}>
                                <Input type="text" placeholder={t("placeholderNameEn")} autoFocus />
                            </TextField>
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel>{t("labelNameAr")}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} value={newNameAr} onChange={setNewNameAr}>
                                <Input type="text" placeholder={t("placeholderNameAr")} dir="rtl" />
                            </TextField>
                        </div>
                    </div>
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setNewNameEn(''); setNewNameAr(''); }}>{tCommon("cancel")}</Button>
                        <Button type="submit" variant="primary">{t("submitAdd")}</Button>
                    </ModalFooter>
                </form>
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title={t("editTitle")}>
                <form onSubmit={handleUpdate} className="flex flex-col gap-5 px-1 py-1">
                    <div className="flex gap-2">
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                            <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} value={editingItem?.name_en || ''} onChange={(val) => setEditingItem({ ...editingItem, name_en: val })}>
                                <Input type="text" autoFocus />
                            </TextField>
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel>{t("labelNameAr")}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} value={editingItem?.name_ar || ''} onChange={(val) => setEditingItem({ ...editingItem, name_ar: val })}>
                                <Input type="text" dir="rtl" />
                            </TextField>
                        </div>
                    </div>
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => setEditingItem(null)}>{tCommon("cancel")}</Button>
                        <Button type="submit" variant="primary">{t("submitEdit")}</Button>
                    </ModalFooter>
                </form>
            </Modal>

            <DataTable
                columns={categoryColumns}
                data={categories}
                rowKey="id"
                quickSearch={{ fields: ["name_en", "name_ar"], placeholder: t("searchPlaceholder") }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(!showForm)}>{t("addButton")}</Button>}
            />
        </div>
    );
}
