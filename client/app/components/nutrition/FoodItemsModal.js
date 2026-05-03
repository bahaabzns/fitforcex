
import { useState } from 'react';
import Modal from "@/app/components/Modal";

export default function FoodItemsModal({ open, foodItems, foodSearchQuery, onSearchChange, onClose, onAddItems, lockedCategory, excludedFoodItemIds }) {
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

    // #7 — select / deselect all visible rows
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
        <Modal open={open} onClose={onClose} title="Search Food Items" wide>
            <div className="flex flex-col" style={{ maxHeight: '70vh' }}>

                {/* Search + results count */}
                <div className="flex gap-3 mb-3 items-center">
                    <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="Search for food..."
                        value={foodSearchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        autoFocus
                    />
                    {/* #1 — results count */}
                    <span className="text-sm text-muted-foreground shrink-0">
                        {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* #4 — pill-style category filter (replaces native <select>) */}
                {!lockedCategory ? (
                    <div className="flex gap-2 flex-wrap mb-4">
                        {['', ...categories].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                    categoryFilter === cat
                                        ? 'bg-primary border-primary text-white'
                                        : 'border-border text-muted-foreground hover:border-border'
                                }`}
                            >
                                {cat || 'All'}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex gap-2 flex-wrap mb-4 items-center">
                        <span className="text-xs px-3 py-1 rounded-full bg-primary border-primary text-white">{lockedCategory}</span>
                        <span className="text-xs text-muted-foreground">Alternatives are filtered to this category</span>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <table className="w-full text-sm">
                        {/* #3 — stronger header separation */}
                        <thead className="sticky top-0 bg-card shadow-sm">
                            <tr className="border-b-2 border-border text-left text-muted-foreground">
                                {/* #7 — select-all checkbox */}
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
                                <th className="p-2">Name</th>
                                <th className="p-2">Category</th>
                                <th className="p-2">Serving</th>
                                {/* #5 — single Macros column replacing 4 columns */}
                                <th className="p-2">Macros</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* #2 — empty state */}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                                        {foodSearchQuery
                                            ? `No food items match "${foodSearchQuery}"`
                                            : 'No food items in this category'}
                                    </td>
                                </tr>
                            )}
                            {filtered.map(fi => (
                                <tr
                                    key={fi.id}
                                    className={`border-b cursor-pointer transition-colors hover:bg-accent ${selectedIds.has(fi.id) ? 'bg-primary/10' : ''}`}
                                    onClick={() => toggleItem(fi.id)}
                                >
                                    {/* #6 — custom styled checkbox */}
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
                                    {/* #5 — color-coded macro badges in a single cell */}
                                    <td className="p-2">
                                        <div className="flex gap-1 flex-wrap">
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800">{fi.calories_per_serving} kcal</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 border border-blue-300 text-blue-800">P {fi.protein_per_serving}g</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-lime-100 border border-lime-300 text-lime-800">C {fi.carbs_per_serving}g</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 border border-purple-300 text-purple-800">F {fi.fats_per_serving}g</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected</span>
                    <div className="flex gap-3">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={selectedIds.size === 0}
                        >
                            Reset Selection
                        </button>
                        <button
                            className="btn btn-primary px-4"
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                        >
                            Add Selected
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
