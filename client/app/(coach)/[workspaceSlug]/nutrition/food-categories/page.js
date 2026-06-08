'use client';
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";
const labelCls = "text-xs text-muted-foreground mb-1 block";

export default function FoodCategoriesPage() {
    const t = useTranslations("foodCategories");
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
            <div className="flex gap-2">
                <button onClick={() => setEditingItem(row)} className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted px-3 py-1 text-sm transition-colors cursor-pointer">{t("editButton")}</button>
                <button onClick={() => handleDelete(row.id)} className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1 text-sm transition-colors cursor-pointer">{t("deleteButton")}</button>
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
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>{t("labelNameEn")}</label>
                            <input type="text" value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} placeholder={t("placeholderNameEn")} className={inputCls} required autoFocus />
                        </div>
                        <div>
                            <label className={labelCls}>{t("labelNameAr")}</label>
                            <input type="text" value={newNameAr} onChange={(e) => setNewNameAr(e.target.value)} placeholder={t("placeholderNameAr")} className={inputCls} dir="rtl" />
                        </div>
                    </div>
                    <Button type="submit" variant="primary" fullWidth>{t("submitAdd")}</Button>
                </form>
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title={t("editTitle")}>
                <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>{t("labelNameEn")}</label>
                            <input type="text" value={editingItem?.name_en || ''} onChange={(e) => setEditingItem({ ...editingItem, name_en: e.target.value })} className={inputCls} required autoFocus />
                        </div>
                        <div>
                            <label className={labelCls}>{t("labelNameAr")}</label>
                            <input type="text" value={editingItem?.name_ar || ''} onChange={(e) => setEditingItem({ ...editingItem, name_ar: e.target.value })} className={inputCls} dir="rtl" />
                        </div>
                    </div>
                    <Button type="submit" variant="primary" fullWidth>{t("submitEdit")}</Button>
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
