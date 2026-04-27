
import { useState } from 'react';

export default function FoodItemsModal({ foodItems, foodSearchQuery, onSearchChange, onClose, onAddItems, lockedCategory, excludedFoodItemIds }) {
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
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
            onClick={onClose}
        >
            <div
                className="card px-6 py-4 w-4/5 max-w-5xl max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* #8 — header with close button */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Search Food Items</h2>
                    <button
                        title="Close"
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        onClick={onClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

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
                    <span className="text-sm text-gray-400 shrink-0">
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
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'border-gray-300 text-gray-500 hover:border-gray-400'
                                }`}
                            >
                                {cat || 'All'}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex gap-2 flex-wrap mb-4 items-center">
                        <span className="text-xs px-3 py-1 rounded-full bg-blue-500 border-blue-500 text-white">{lockedCategory}</span>
                        <span className="text-xs text-gray-400">Alternatives are filtered to this category</span>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <table className="w-full text-sm">
                        {/* #3 — stronger header separation */}
                        <thead className="sticky top-0 bg-white shadow-sm">
                            <tr className="border-b-2 border-gray-200 text-left text-gray-600">
                                {/* #7 — select-all checkbox */}
                                <th className="p-2 w-8">
                                    <div
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                                            allFilteredSelected
                                                ? 'bg-blue-500 border-blue-500'
                                                : 'border-gray-300 bg-white hover:border-blue-300'
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
                                    <td colSpan={5} className="text-center py-12 text-gray-400">
                                        {foodSearchQuery
                                            ? `No food items match "${foodSearchQuery}"`
                                            : 'No food items in this category'}
                                    </td>
                                </tr>
                            )}
                            {filtered.map(fi => (
                                <tr
                                    key={fi.id}
                                    className={`border-b cursor-pointer transition-colors hover:bg-gray-50 ${selectedIds.has(fi.id) ? 'bg-blue-50' : ''}`}
                                    onClick={() => toggleItem(fi.id)}
                                >
                                    {/* #6 — custom styled checkbox */}
                                    <td className="p-2">
                                        <div
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                selectedIds.has(fi.id)
                                                    ? 'bg-blue-500 border-blue-500'
                                                    : 'border-gray-300 bg-white'
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
                                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{fi.food_category}</span>
                                            : <span className="text-gray-300">—</span>
                                        }
                                    </td>
                                    <td className="p-2 text-gray-500">{fi.serving_size} {fi.serving_unit}</td>
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
                    <span className="text-sm text-gray-600">{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected</span>
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
        </div>
    );
}