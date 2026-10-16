'use client';
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Apple, AlertTriangle, Tags, ListChecks, X } from "lucide-react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal, { ModalFooter } from "@/app/components/Modal";
import ActionBar from "@/app/components/ActionBar";
import FoodForm from "@/app/components/nutrition/FoodForm";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import { Skeleton } from "@heroui/react/skeleton";
import { Separator } from "@heroui/react/separator";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
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

const FOOD_ITEMS_API = "/api/nutrition/food-items";
const HTTP_FORBIDDEN = 403;
const NO_CATEGORY_KEY = "__none__"; // Select needs a real key for the "No category" choice

export default function FoodItemsPage() {
    const t = useTranslations("foodItems");
    const tCommon = useTranslations("common");
    usePageTitle(t('pageTitle'));
    const [foodItems, setFoodItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    // Bulk actions (row selection → floating action bar)
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [filteredItems, setFilteredItems] = useState([]);
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [bulkCategory, setBulkCategory] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [usage, setUsage] = useState(null); // null = still checking, false = check failed
    const [bulkWorking, setBulkWorking] = useState(false);
    const [bulkError, setBulkError] = useState('');

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

    const selectedList = [...selectedIds];

    // Server message when there is one; otherwise the generic text plus the technical reason
    // (e.g. "Network Error"), so a failure that never reached the API can be told apart.
    const bulkErrorMessage = (error) => {
        console.error('Bulk food item action failed:', error);
        if (error?.response?.status === HTTP_FORBIDDEN) return t("bulkNoPermission");
        if (error?.response?.data?.error) return error.response.data.error;
        return error?.message ? `${t("bulkError")} (${error.message})` : t("bulkError");
    };

    const openCategoryModal = () => { setBulkError(''); setBulkCategory(''); setCategoryModalOpen(true); };

    const handleBulkCategory = async () => {
        setBulkWorking(true);
        setBulkError('');
        try {
            await api.put(`${FOOD_ITEMS_API}/bulk-category`, { ids: selectedList, food_category: bulkCategory });
            setFoodItems(items => items.map(item => selectedIds.has(item.id) ? { ...item, food_category: bulkCategory || null } : item));
            setSelectedIds(new Set());
            setCategoryModalOpen(false);
        } catch (error) {
            setBulkError(bulkErrorMessage(error));
        } finally {
            setBulkWorking(false);
        }
    };

    // Deleting a food also removes it from every diet plan that uses it, so ask the server
    // how much that is before the coach confirms.
    const openDeleteModal = async () => {
        setBulkError('');
        setUsage(null);
        setDeleteModalOpen(true);
        try {
            const response = await api.post(`${FOOD_ITEMS_API}/bulk-usage`, { ids: selectedList });
            setUsage(response.data);
        } catch (error) {
            setUsage(false);
        }
    };

    const handleBulkDelete = async () => {
        setBulkWorking(true);
        setBulkError('');
        try {
            await api.delete(FOOD_ITEMS_API, { data: { ids: selectedList } });
            setFoodItems(items => items.filter(item => !selectedIds.has(item.id)));
            setSelectedIds(new Set());
            setDeleteModalOpen(false);
        } catch (error) {
            setBulkError(bulkErrorMessage(error));
        } finally {
            setBulkWorking(false);
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
                selectable
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                onFilteredDataChange={setFilteredItems}
                mobileListView
                quickSearch={{ fields: ["name_en", "name_ar", "food_category"], placeholder: t("searchPlaceholder") }}
                emptyState={{
                    icon: Apple,
                    title: t("emptyTitle"),
                    description: t("emptyHint"),
                    action: { label: t("addButton"), onPress: () => setShowForm(true) },
                }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(!showForm)}>{t("addButton")}</Button>}
            />

            <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={t("bulkCategoryTitle")}>
                <div className="flex flex-col gap-4 px-1 py-1">
                    <p className="text-sm">{t("bulkCategoryBody", { count: selectedIds.size })}</p>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>{t("bulkCategoryLabel")}</FieldLabel>
                        <Select
                            variant="secondary"
                            fullWidth
                            aria-label={t("bulkCategoryLabel")}
                            value={bulkCategory || NO_CATEGORY_KEY}
                            onChange={(key) => setBulkCategory(key === NO_CATEGORY_KEY ? '' : key)}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    <ListBox.Item id={NO_CATEGORY_KEY} textValue={t("bulkCategoryNone")}>
                                        {t("bulkCategoryNone")}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    {categories.map(c => (
                                        <ListBox.Item key={c.id} id={c.name_en} textValue={c.name_en}>
                                            {c.name_en}{c.name_ar ? ` / ${c.name_ar}` : ''}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                    {bulkError && <p role="alert" className="text-sm text-destructive">{bulkError}</p>}
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => setCategoryModalOpen(false)}>{tCommon("cancel")}</Button>
                        <Button type="button" variant="primary" onClick={handleBulkCategory} isDisabled={bulkWorking}>
                            {bulkWorking ? t("bulkWorking") : t("bulkCategoryConfirm")}
                        </Button>
                    </ModalFooter>
                </div>
            </Modal>

            <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t("bulkDeleteTitle")}>
                <div className="flex flex-col gap-4 px-1 py-1">
                    <p className="text-sm">{t("bulkDeleteBody", { count: selectedIds.size })}</p>
                    <p className="text-sm" aria-live="polite">
                        {usage === null && <span className="text-muted-foreground">{t("bulkDeleteChecking")}</span>}
                        {usage === false && <span className="text-amber-500">{t("bulkDeleteUsageUnknown")}</span>}
                        {usage && (usage.meal_items > 0 || usage.alternatives > 0
                            ? <span className="text-amber-500">{t("bulkDeleteUsage", { entries: usage.meal_items + usage.alternatives, plans: usage.plans })}</span>
                            : <span className="text-muted-foreground">{t("bulkDeleteUnused")}</span>)}
                    </p>
                    {bulkError && <p role="alert" className="text-sm text-destructive">{bulkError}</p>}
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => setDeleteModalOpen(false)}>{tCommon("cancel")}</Button>
                        <Button type="button" variant="danger" onClick={handleBulkDelete} isDisabled={bulkWorking || usage === null}>
                            {bulkWorking ? t("bulkWorking") : t("bulkDeleteConfirm", { count: selectedIds.size })}
                        </Button>
                    </ModalFooter>
                </div>
            </Modal>

            {/* Floating bulk action bar — same component/pattern as the Clients and Plans Queue tables. */}
            <ActionBar isOpen={selectedIds.size > 0} aria-label={t("selectedBar", { count: selectedIds.size })}>
                <ActionBar.Prefix>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-default px-1.5 text-xs font-semibold text-foreground">
                        {selectedIds.size}
                    </span>
                    {filteredItems.length > selectedIds.size && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set(filteredItems.map(item => item.id)))}>
                            <ListChecks className="w-4 h-4" />
                            <span className="action-bar__label">{t("selectAllFiltered", { count: filteredItems.length })}</span>
                        </Button>
                    )}
                </ActionBar.Prefix>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Content>
                    <Button variant="ghost" size="sm" onClick={openCategoryModal}>
                        <Tags className="w-4 h-4" />
                        <span className="action-bar__label">{t("bulkChangeCategory")}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={openDeleteModal}>
                        <Trash2 className="w-4 h-4" />
                        <span className="action-bar__label">{t("bulkDelete")}</span>
                    </Button>
                </ActionBar.Content>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Suffix>
                    <Tooltip>
                        <Button isIconOnly variant="ghost" size="sm" aria-label={t("clearSelection")} onClick={() => setSelectedIds(new Set())}>
                            <X className="w-4 h-4" />
                        </Button>
                        <Tooltip.Content>{t("clearSelection")}</Tooltip.Content>
                    </Tooltip>
                </ActionBar.Suffix>
            </ActionBar>
        </div>
    );
}
