
import { useState } from 'react';

export default function FoodItemsModal({ foodItems, foodSearchQuery, onSearchChange, onClose, onAddItems }) {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [categoryFilter, setCategoryFilter] = useState('');

    const categories = [...new Set(foodItems.map(fi => fi.food_category).filter(Boolean))];

    const filtered = foodItems.filter(fi => {
        const matchesSearch = fi.name.toLowerCase().includes(foodSearchQuery.toLowerCase());
        const matchesCategory = !categoryFilter || fi.food_category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const toggleItem = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
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
                <h2 className="text-xl font-bold mb-4">Search Food Items</h2>

                {/* Search + Category Filter */}
                <div className="flex gap-3 mb-4">
                    <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="Search for food..."
                        value={foodSearchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        autoFocus
                    />
                    <select
                        className="input-field w-48"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                            <tr className="border-b text-left text-gray-600">
                                <th className="p-2 w-8"></th>
                                <th className="p-2">Name</th>
                                <th className="p-2">Category</th>
                                <th className="p-2">Serving Size</th>
                                <th className="p-2">Unit</th>
                                <th className="p-2">Calories</th>
                                <th className="p-2">Carbs (g)</th>
                                <th className="p-2">Protein (g)</th>
                                <th className="p-2">Fats (g)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(fi => (
                                <tr
                                    key={fi.id}
                                    className={`border-b cursor-pointer hover:bg-gray-50 ${selectedIds.has(fi.id) ? 'bg-blue-50' : ''}`}
                                    onClick={() => toggleItem(fi.id)}
                                >
                                    <td className="p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(fi.id)}
                                            onChange={() => toggleItem(fi.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </td>
                                    <td className="p-2 font-medium">{fi.name}</td>
                                    <td className="p-2 text-gray-500">{fi.food_category || '—'}</td>
                                    <td className="p-2">{fi.serving_size}</td>
                                    <td className="p-2">{fi.serving_unit}</td>
                                    <td className="p-2">{fi.calories_per_serving}</td>
                                    <td className="p-2">{fi.carbs_per_serving}</td>
                                    <td className="p-2">{fi.protein_per_serving}</td>
                                    <td className="p-2">{fi.fats_per_serving}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <span className="text-sm text-gray-600">{selectedIds.size} items selected</span>
                    <div className="flex gap-3">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={selectedIds.size === 0}
                        >
                            Reset Selection
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                        >
                            Add Selected ({selectedIds.size})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}