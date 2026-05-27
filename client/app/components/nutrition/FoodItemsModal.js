'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from "@/app/components/Modal";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

export default function FoodItemsModal({ open, foodItems, foodSearchQuery, onSearchChange, onClose, onAddItems, lockedCategory, excludedFoodItemIds }) {
    const t = useTranslations("nutrition");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [categoryFilter, setCategoryFilter] = useState(lockedCategory || '');

    const categories = [...new Set(foodItems.map(fi => fi.food_category).filter(Boolean))];

    const filtered = foodItems.filter(fi => {
        const matchesSearch = fi.name.toLowerCase().includes(foodSearchQuery.toLowerCase());
        const matchesCategory = lockedCategory
            ? fi.food_category === lockedCategory
            : (!categoryFilter || fi.food_category === categoryFilter);
        const notExcluded = !excludedFoodItemIds || !excludedFoodItemIds.has(fi.id);
        return matchesSearch && matchesCategory && notExcluded;
    });

    const toggleItem = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const allFilteredSelected = filtered.length > 0 && filtered.every(fi => selectedIds.has(fi.id));
    const toggleSelectAll = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                filtered.forEach(fi => next.delete(fi.id));
            } else {
                filtered.forEach(fi => next.add(fi.id));
            }
            return next;
        });
    };

    const handleConfirm = () => {
        const selectedItems = foodItems.filter(fi => selectedIds.has(fi.id));
        onAddItems(selectedItems);
    };

    return (
        <Modal open={open} onClose={onClose} title={t("foodModalTitle")} wide>
            <div className="flex flex-col" style={{ maxHeight: '70vh' }}>

                {/* Search + results count */}
                <div className="flex gap-3 mb-3 items-center">
                    <TextField value={foodSearchQuery} onChange={onSearchChange} className="flex-1">
                        <Input type="text" placeholder={t("foodSearchPlaceholder")} autoFocus />
                    </TextField>
                    <span className="text-sm text-muted-foreground shrink-0">
                        {t("foodResultsCount", { count: filtered.length })}
                    </span>
                </div>

                {/* Category filter pills */}
                {!lockedCategory ? (
                    <div className="flex gap-2 flex-wrap mb-4">
                        {['', ...categories].map(cat => (
                            <Button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                    categoryFilter === cat
                                        ? 'bg-primary border-primary text-white'
                                        : 'border-border text-muted-foreground hover:border-border'
                                }`}
                            >
                                {cat || t("foodCategoryAll")}
                            </Button>
                        ))}
                    </div>
                ) : (
                    <div className="flex gap-2 flex-wrap mb-4 items-center">
                        <span className="text-xs px-3 py-1 rounded-full bg-primary border-primary text-white">{lockedCategory}</span>
                        <span className="text-xs text-muted-foreground">{t("foodAlternativesFiltered")}</span>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card shadow-sm">
                            <tr className="border-b-2 border-border text-left text-muted-foreground">
                                <th className="p-2 w-8">
                                    <div
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                                            allFilteredSelected
                                                ? 'bg-primary border-primary'
                                                : 'border-border bg-card hover:border-primary/40'
                                        }`}
                                        onClick={toggleSelectAll}
                                    >
                                        {allFilteredSelected && (
                                            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                                <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </div>
                                </th>
                                <th className="p-2">{t("foodColName")}</th>
                                <th className="p-2">{t("foodColCategory")}</th>
                                <th className="p-2">{t("foodColServing")}</th>
                                <th className="p-2">{t("foodColMacros")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                                        {foodSearchQuery
                                            ? t("foodNoMatch", { query: foodSearchQuery })
                                            : t("foodNoItems")}
                                    </td>
                                </tr>
                            )}
                            {filtered.map(fi => (
                                <tr
                                    key={fi.id}
                                    className={`border-b cursor-pointer transition-colors hover:bg-default ${selectedIds.has(fi.id) ? 'bg-primary/10' : ''}`}
                                    onClick={() => toggleItem(fi.id)}
                                >
                                    <td className="p-2">
                                        <div
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                selectedIds.has(fi.id)
                                                    ? 'bg-primary border-primary'
                                                    : 'border-border bg-card'
                                            }`}
                                        >
                                            {selectedIds.has(fi.id) && (
                                                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                                    <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-2 font-medium">{fi.name}</td>
                                    <td className="p-2">
                                        {fi.food_category
                                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{fi.food_category}</span>
                                            : <span className="text-muted-foreground/40">—</span>
                                        }
                                    </td>
                                    <td className="p-2 text-muted-foreground">{fi.serving_size} {fi.serving_unit}</td>
                                    <td className="p-2">
                                        <div className="flex gap-1 flex-wrap">
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-600">{fi.calories_per_serving} kcal</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-600">P {fi.protein_per_serving}g</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-lime-500/15 border border-lime-500/30 text-lime-600">C {fi.carbs_per_serving}g</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-600">F {fi.fats_per_serving}g</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">{t("foodSelectedCount", { count: selectedIds.size })}</span>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={selectedIds.size === 0}
                        >
                            {t("foodResetSelection")}
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                        >
                            {t("foodAddSelected")}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
