'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import FoodForm from "@/app/components/nutrition/FoodForm";
import { SearchField } from "@heroui/react/search-field";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Table } from "@heroui/react/table";
import { Checkbox } from "@heroui/react/checkbox";
import { Separator } from "@heroui/react/separator";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Pagination } from "@heroui/react/pagination";
import { getPageNumbers } from "@/utils/pagination";

const PAGE_SIZE = 10;

export default function FoodItemsModal({ open, foodItems, foodSearchQuery, onSearchChange, onClose, onAddItems, lockedCategory, excludedFoodItemIds }) {
    const t = useTranslations("nutrition");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [categoryFilter, setCategoryFilter] = useState(lockedCategory || '');
    const [extraItems, setExtraItems] = useState([]);
    const [page, setPage] = useState(1);

    // Create food modal
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createFormData, setCreateFormData] = useState({});
    const [createError, setCreateError] = useState('');
    const [formCategories, setFormCategories] = useState([]);
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);

    useEffect(() => { if (!open) { setExtraItems([]); setSelectedIds(new Set()); setCreateError(''); setPage(1); setCreateModalOpen(false); } }, [open]);
    // Reset to first page whenever search or category changes
    useEffect(() => { setPage(1); }, [foodSearchQuery, categoryFilter]);

    const openCreateModal = async () => {
        setCreateFormData({
            name_en: (foodSearchQuery || '').trim(),
            name_ar: '',
            food_category: lockedCategory || '',
            serving_size: '100',
            serving_unit: 'g',
            calories_per_serving: '',
            carbs_per_serving: '',
            protein_per_serving: '',
            fats_per_serving: '',
        });
        setCreateError('');
        if (!categoriesLoaded) {
            try {
                const res = await api.get('/api/nutrition/food-categories');
                setFormCategories(res.data);
                setCategoriesLoaded(true);
            } catch {}
        }
        setCreateModalOpen(true);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreateError('');
        try {
            const res = await api.post('/api/nutrition/food-items', createFormData);
            const created = res.data;
            setExtraItems(prev => [created, ...prev]);
            onAddItems([created]);
            setCreateModalOpen(false);
        } catch (err) {
            setCreateError(err.response?.data?.error || t('createFoodFailed'));
        }
    };

    const allFoodItems = [...extraItems, ...foodItems];
    const categories = [...new Set(allFoodItems.map(fi => fi.food_category).filter(Boolean))];

    const filtered = allFoodItems.filter(fi => {
        const matchesSearch = (fi.name_en || fi.name_ar || '').toLowerCase().includes((foodSearchQuery || '').toLowerCase());
        const matchesCategory = lockedCategory
            ? fi.food_category === lockedCategory
            : (!categoryFilter || fi.food_category === categoryFilter);
        const notExcluded = !excludedFoodItemIds || !excludedFoodItemIds.has(fi.id);
        return matchesSearch && matchesCategory && notExcluded;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // Selection is scoped to the current page so the table's "select all" only
    // affects visible rows; selections on other pages are preserved.
    const pageIdSet = new Set(pageItems.map(fi => String(fi.id)));
    const visibleSelectedKeys = new Set([...selectedIds].filter(id => pageIdSet.has(id)));

    const handleTableSelectionChange = (keys) => {
        setSelectedIds(prev => {
            const outsidePage = new Set([...prev].filter(id => !pageIdSet.has(id)));
            if (keys === "all") {
                return new Set([...outsidePage, ...pageIdSet]);
            }
            return new Set([...outsidePage, ...keys]);
        });
    };

    const handleConfirm = () => {
        const selectedItems = allFoodItems.filter(fi => selectedIds.has(String(fi.id)));
        onAddItems(selectedItems);
    };


    return (
        <Modal open={open} onClose={onClose} title={t("foodModalTitle")} wide>
            <div className="flex flex-col gap-3 p-2">

                {/* Search row: field + category dropdown + result count */}
                <div className="flex gap-2 items-center">
                    <SearchField
                        value={foodSearchQuery}
                        onChange={onSearchChange}
                        variant="secondary"
                        className="flex-1"
                        aria-label={t("foodSearchPlaceholder")}
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder={t("foodSearchPlaceholder")} autoFocus />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>

                    {!lockedCategory && (
                        <Select
                            size="sm"
                            variant="secondary"
                            value={categoryFilter}
                            onChange={setCategoryFilter}
                            aria-label="Category filter"
                        >
                            <Select.Trigger className="min-w-36">
                                <Select.Value placeholder={t("foodCategoryAll")} />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    <ListBox.Item key="__all__" id="" textValue={t("foodCategoryAll")}>
                                        {t("foodCategoryAll")}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    {categories.map(cat => (
                                        <ListBox.Item key={cat} id={cat} textValue={cat}>
                                            {cat}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    )}

                    {lockedCategory && (
                        <Chip size="sm" color="primary" variant="solid">
                            <Chip.Label>{lockedCategory}</Chip.Label>
                        </Chip>
                    )}

                    <span className="text-sm text-muted-foreground shrink-0">
                        {t("foodResultsCount", { count: filtered.length })}
                    </span>
                </div>

                {/* Table */}
                {filtered.length === 0 ? (
                    <div className="py-12 text-muted-foreground flex flex-col items-center gap-3 text-center text-sm">
                        <span>
                            {foodSearchQuery
                                ? t("foodNoMatch", { query: foodSearchQuery })
                                : t("foodNoItems")}
                        </span>
                        {(foodSearchQuery || '').trim() && (
                            <Button variant="primary" onPress={openCreateModal}>
                                {t('createFoodNamed', { name: foodSearchQuery.trim() })}
                            </Button>
                        )}
                    </div>
                ) : (
                    <Table>
                        <Table.ScrollContainer>
                            <Table.Content
                                aria-label={t("foodModalTitle")}
                                selectionMode="multiple"
                                selectionBehavior="toggle"
                                selectedKeys={visibleSelectedKeys}
                                onSelectionChange={handleTableSelectionChange}
                            >
                                <Table.Header>
                                    <Table.Column id="select" className="w-8 p-2">
                                        <Checkbox aria-label="Select all" slot="selection">
                                            <Checkbox.Control>
                                                <Checkbox.Indicator />
                                            </Checkbox.Control>
                                        </Checkbox>
                                    </Table.Column>
                                    <Table.Column id="name" isRowHeader>{t("foodColName")}</Table.Column>
                                    <Table.Column id="category">{t("foodColCategory")}</Table.Column>
                                    <Table.Column id="serving">{t("foodColServing")}</Table.Column>
                                    <Table.Column id="kcal" className="text-center">
                                        <span className="text-muted-foreground font-medium">{t("foodColKcal")}</span>
                                    </Table.Column>
                                    <Table.Column id="carbs" className="text-center">
                                        <span className="text-primary font-medium">{t("foodColCarbs")}</span>
                                    </Table.Column>
                                    <Table.Column id="protein" className="text-center">
                                        <span className="text-orange-500 font-medium">{t("foodColProtein")}</span>
                                    </Table.Column>
                                    <Table.Column id="fat" className="text-center">
                                        <span className="text-amber-500 font-medium">{t("foodColFat")}</span>
                                    </Table.Column>
                                </Table.Header>
                                <Table.Body>
                                    {pageItems.map(fi => (
                                        <Table.Row
                                            key={String(fi.id)}
                                            id={String(fi.id)}
                                            className="cursor-pointer"
                                        >
                                            <Table.Cell className="p-2">
                                                <Checkbox
                                                    aria-label={`Select ${fi.name_en || fi.name_ar}`}
                                                    slot="selection"
                                                >
                                                    <Checkbox.Control>
                                                        <Checkbox.Indicator />
                                                    </Checkbox.Control>
                                                </Checkbox>
                                            </Table.Cell>
                                            <Table.Cell className="p-2 font-medium">
                                                {fi.name_en || fi.name_ar}
                                            </Table.Cell>
                                            <Table.Cell className="p-2">
                                                {fi.food_category ? (
                                                    <Chip size="sm" variant="soft" color="default">
                                                        <Chip.Label>{fi.food_category}</Chip.Label>
                                                    </Chip>
                                                ) : (
                                                    <span className="text-muted-foreground/40">—</span>
                                                )}
                                            </Table.Cell>
                                            <Table.Cell className="p-2 text-muted-foreground">
                                                {fi.serving_size} {fi.serving_unit}
                                            </Table.Cell>
                                            <Table.Cell className="p-2 text-center text-sm">
                                                {fi.calories_per_serving}
                                            </Table.Cell>
                                            <Table.Cell className="p-2 text-center text-sm">
                                                {fi.carbs_per_serving}g
                                            </Table.Cell>
                                            <Table.Cell className="p-2 text-center text-sm">
                                                {fi.protein_per_serving}g
                                            </Table.Cell>
                                            <Table.Cell className="p-2 text-center text-sm">
                                                {fi.fats_per_serving}g
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table.Content>
                        </Table.ScrollContainer>
                    </Table>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <Pagination className="justify-center" size="sm">
                        <Pagination.Content>
                            <Pagination.Item>
                                <Pagination.Previous isDisabled={safePage === 1} onPress={() => setPage(p => p - 1)}>
                                    <Pagination.PreviousIcon />
                                    <span>Previous</span>
                                </Pagination.Previous>
                            </Pagination.Item>
                            {getPageNumbers(safePage, totalPages).map((p, i) =>
                                p === "ellipsis" ? (
                                    <Pagination.Item key={`ellipsis-${i}`}>
                                        <Pagination.Ellipsis />
                                    </Pagination.Item>
                                ) : (
                                    <Pagination.Item key={p}>
                                        <Pagination.Link isActive={p === safePage} onPress={() => setPage(p)}>
                                            {p}
                                        </Pagination.Link>
                                    </Pagination.Item>
                                )
                            )}
                            <Pagination.Item>
                                <Pagination.Next isDisabled={safePage === totalPages} onPress={() => setPage(p => p + 1)}>
                                    <span>Next</span>
                                    <Pagination.NextIcon />
                                </Pagination.Next>
                            </Pagination.Item>
                        </Pagination.Content>
                    </Pagination>
                )}

                {/* Footer */}
                <Separator />
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        {t("foodSelectedCount", { count: selectedIds.size })}
                    </span>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onPress={() => setSelectedIds(new Set())}
                            isDisabled={selectedIds.size === 0}
                        >
                            {t("foodResetSelection")}
                        </Button>
                        <Button
                            variant="primary"
                            onPress={handleConfirm}
                            isDisabled={selectedIds.size === 0}
                        >
                            {t("foodAddSelected")}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Create food item modal — opened from the empty-state "Create X" button */}
            <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title={t("createFoodModalTitle")}>
                <FoodForm
                    data={createFormData}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                    onSubmit={handleCreateSubmit}
                    onCancel={() => setCreateModalOpen(false)}
                    submitLabel={t("createFoodSubmit")}
                    categories={formCategories}
                />
                {createError && <p className="text-xs text-destructive mt-2 px-1">{createError}</p>}
            </Modal>
        </Modal>
    );
}
