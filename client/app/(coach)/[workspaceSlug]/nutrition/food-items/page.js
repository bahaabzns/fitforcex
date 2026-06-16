'use client';
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";

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
    const tCommon = useTranslations("common");
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
        { key: "name_ar", label: t("columnNameAr"), render: (row) => <span dir="rtl">{row.name_ar || "—"}</span> },
        { key: "food_category", label: t("columnCategory"), filterType: "multi", options: categoryOptions, sortable: true },
        { key: "serving_size", label: t("columnServingSize"), sortable: true },
        { key: "serving_unit", label: t("columnUnit") },
        { key: "calories_per_serving", label: t("columnCalories"), sortable: true },
        { key: "carbs_per_serving", label: t("columnCarbs"), sortable: true },
        { key: "protein_per_serving", label: t("columnProtein"), sortable: true },
        { key: "fats_per_serving", label: t("columnFat"), sortable: true },
        { key: "actions", label: t("columnActions"), cardPriority: "hidden", render: (row) => (
            <div className="flex gap-2">
                <button onClick={() => setEditingItem(row)} className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted px-3 py-1 text-sm transition-colors cursor-pointer">{t("editButton")}</button>
                <button onClick={() => handleDelete(row.id)} className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1 text-sm transition-colors cursor-pointer">{t("deleteButton")}</button>
            </div>
        )},
    ];

    const FoodForm = ({ data, onChange, onSubmit, onCancel, submitLabel, isEdit }) => {
        // Adapts HeroUI's value-based onChange back to the event shape the
        // existing name-keyed handlers ({ target: { name, value } }) expect.
        const field = (name) => ({
            value: data[name] || '',
            onChange: (value) => onChange({ target: { name, value } }),
        });
        return (
            <form onSubmit={onSubmit} className="flex flex-col gap-5 px-1 py-1">
                <div className="flex gap-2">
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                        <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} {...field("name_en")}>
                            <Input type="text" placeholder={t("placeholderNameEn")} autoFocus={!isEdit} />
                        </TextField>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel>{t("labelNameAr")}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} {...field("name_ar")}>
                            <Input type="text" placeholder={t("placeholderNameAr")} dir="rtl" />
                        </TextField>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("labelCategory")}</FieldLabel>
                    <Select
                        variant="secondary"
                        fullWidth
                        placeholder={t("selectCategory")}
                        aria-label={t("labelCategory")}
                        value={data.food_category || ''}
                        onChange={(key) => onChange({ target: { name: "food_category", value: key } })}
                    >
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {categories.map(cat => (
                                    <ListBox.Item key={cat.id} id={cat.name_en} textValue={cat.name_en}>
                                        {cat.name_en}{cat.name_ar ? ` / ${cat.name_ar}` : ''}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1.5">
                        <FieldLabel>{t("labelServingSize")}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t("labelServingSize")} {...field("serving_size")}>
                            <Input type="number" step="any" inputMode="decimal" placeholder="100" />
                        </TextField>
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                        <FieldLabel>{t("labelServingUnit")}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t("labelServingUnit")} {...field("serving_unit")}>
                            <Input type="text" placeholder="g" />
                        </TextField>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("labelNutritionFacts")}</FieldLabel>
                    <div className="grid grid-cols-4 gap-3">
                        <TextField variant="secondary" fullWidth aria-label={t("labelCalories")} {...field("calories_per_serving")}>
                            <Input type="number" step="any" inputMode="decimal" placeholder={t("labelCalories")} />
                        </TextField>
                        <TextField variant="secondary" fullWidth aria-label={t("labelCarbs")} {...field("carbs_per_serving")}>
                            <Input type="number" step="any" inputMode="decimal" placeholder={t("labelCarbs")} />
                        </TextField>
                        <TextField variant="secondary" fullWidth aria-label={t("labelProtein")} {...field("protein_per_serving")}>
                            <Input type="number" step="any" inputMode="decimal" placeholder={t("labelProtein")} />
                        </TextField>
                        <TextField variant="secondary" fullWidth aria-label={t("labelFats")} {...field("fats_per_serving")}>
                            <Input type="number" step="any" inputMode="decimal" placeholder={t("labelFats")} />
                        </TextField>
                    </div>
                </div>
                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>{tCommon("cancel")}</Button>
                    <Button type="submit" variant="primary">{submitLabel}</Button>
                </ModalFooter>
            </form>
        );
    };

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
            </div>

            <Modal open={showForm} onClose={() => { setShowForm(false); setFormData(emptyForm); }} title={t("addTitle")}>
                <FoodForm data={formData} onChange={handleChange} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setFormData(emptyForm); }} submitLabel={t("submitAdd")} />
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title={t("editTitle")}>
                <FoodForm data={editingItem || emptyForm} onChange={handleEditChange} onSubmit={handleUpdate} onCancel={() => setEditingItem(null)} submitLabel={t("submitEdit")} isEdit />
            </Modal>

            <DataTable
                columns={foodItemColumns}
                data={foodItems}
                rowKey="id"
                scrollable
                quickSearch={{ fields: ["name_en", "name_ar", "food_category"], placeholder: t("searchPlaceholder") }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(!showForm)}>{t("addButton")}</Button>}
            />
        </div>
    );
}
