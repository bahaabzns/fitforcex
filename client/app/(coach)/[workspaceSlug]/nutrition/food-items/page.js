'use client';
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Apple, AlertTriangle } from "lucide-react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import FoodForm from "@/app/components/nutrition/FoodForm";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import { Skeleton } from "@heroui/react/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import TriggerInsightBanner from "@/app/components/insights/TriggerInsightBanner";

const emptyForm = {
    name_en: '',
    name_ar: '',
    food_category: '',
    serving_size: '',
    serving_unit: '',
    calories_per_serving: '',
    carbs_per_serving: '',
    protein_per_serving: '',
    fats_per_serving: '',
};

export default function FoodItemsPage() {
    const t = useTranslations("foodItems");
    usePageTitle(t('pageTitle'));
    const [foodItems, setFoodItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [itemsRes, categoriesRes] = await Promise.all([
                    api.get('/api/nutrition/food-items'),
                    api.get('/api/nutrition/food-categories'),
                ]);
                setFoodItems(itemsRes.data);
                setCategories(categoriesRes.data);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleEditChange = (e) => setEditingItem({ ...editingItem, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/api/nutrition/food-items', formData);
            setFoodItems([...foodItems, response.data]);
            setFormData(emptyForm);
            setShowForm(false);
        } catch (error) {
            console.error('Error adding food item:', error);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const response = await api.put(`/api/nutrition/food-items/${editingItem.id}`, editingItem);
            setFoodItems(foodItems.map(item => item.id === editingItem.id ? response.data : item));
            setEditingItem(null);
        } catch (error) {
            console.error('Error updating food item:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/nutrition/food-items/${id}`);
            setFoodItems(foodItems.filter(item => item.id !== id));
        } catch (error) {
            console.error('Error deleting food item:', error);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-36 rounded-lg" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const categoryOptions = categories.map(c => c.name_en);
    const foodItemColumns = [
        { key: "name_en", label: t("columnNameEn"), filterType: "text", sortable: true },
        { key: "name_ar", label: t("columnNameAr"), render: (row) => row.name_ar
            ? <span dir="rtl">{row.name_ar}</span>
            : (
                <Tooltip>
                    <span className="inline-flex items-center gap-1 text-amber-500">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-xs">{t("missingArabicName")}</span>
                    </span>
                    <Tooltip.Content>{t("missingArabicNameHint")}</Tooltip.Content>
                </Tooltip>
            ) },
        { key: "food_category", label: t("columnCategory"), filterType: "multi", options: categoryOptions, sortable: true },
        { key: "serving_size", label: t("columnServingSize"), sortable: true },
        { key: "serving_unit", label: t("columnUnit") },
        { key: "calories_per_serving", label: t("columnCalories"), sortable: true },
        { key: "carbs_per_serving", label: t("columnCarbs"), sortable: true },
        { key: "protein_per_serving", label: t("columnProtein"), sortable: true },
        { key: "fats_per_serving", label: t("columnFat"), sortable: true },
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

            <TriggerInsightBanner
                triggerEvent="first_custom_food_item_added"
                checkUrl="/api/insights/prompts/for-trigger/first_custom_food_item_added"
                respondUrlPrefix="/api/insights/prompts"
                dismissUrlPrefix="/api/insights/prompts"
            />

            <Modal open={showForm} onClose={() => { setShowForm(false); setFormData(emptyForm); }} title={t("addTitle")}>
                <FoodForm data={formData} onChange={handleChange} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setFormData(emptyForm); }} submitLabel={t("submitAdd")} categories={categories} />
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title={t("editTitle")}>
                <FoodForm data={editingItem || emptyForm} onChange={handleEditChange} onSubmit={handleUpdate} onCancel={() => setEditingItem(null)} submitLabel={t("submitEdit")} isEdit categories={categories} />
            </Modal>

            <DataTable
                columns={foodItemColumns}
                data={foodItems}
                rowKey="id"
                scrollable
                quickSearch={{ fields: ["name_en", "name_ar", "food_category"], placeholder: t("searchPlaceholder") }}
                emptyState={{
                    icon: Apple,
                    title: t("emptyTitle"),
                    description: t("emptyHint"),
                    action: { label: t("addButton"), onPress: () => setShowForm(true) },
                }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(!showForm)}>{t("addButton")}</Button>}
            />
        </div>
    );
}
