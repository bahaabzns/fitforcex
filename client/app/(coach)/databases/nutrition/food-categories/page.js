'use client';
import { useState, useEffect } from "react";
import api from "@/lib/axios";

export default function FoodCategoriesPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState('');
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

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/nutrition/food-categories', { name: newName });
            setNewName('');
            setShowForm(false);
            await fetchCategories();
        } catch (error) {
            console.error('Error adding food category:', error);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/nutrition/food-categories/${editingItem.id}`, { name: editingItem.name });
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
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="p-8">
            <div className="flex items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold flex-1">Food Categories</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 shrink-0">
                    + Add Category
                </button>
            </div>

            {showForm && (
                <div onClick={() => setShowForm(false)} className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
                    <div onClick={(e) => e.stopPropagation()} className="card p-6 w-80">
                        <h2 className="text-lg font-semibold mb-4">New Category</h2>
                        <form onSubmit={handleAdd} className="flex flex-col gap-4">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Category name"
                                className="input-field"
                                required
                            />
                            <button type="submit" className="btn-primary px-4">Add Category</button>
                        </form>
                    </div>
                </div>
            )}

            {editingItem && (
                <div onClick={() => setEditingItem(null)} className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
                    <div onClick={(e) => e.stopPropagation()} className="card p-6 w-80">
                        <h2 className="text-lg font-semibold mb-4">Edit Category</h2>
                        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                            <input
                                type="text"
                                value={editingItem.name}
                                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                placeholder="Category name"
                                className="input-field"
                                required
                            />
                            <button type="submit" className="btn-primary px-4">Save Changes</button>
                        </form>
                    </div>
                </div>
            )}

            <div className="card">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="text-left py-3 px-4">Name</th>
                            <th className="text-left py-3 px-4">Food Items</th>
                            <th className="text-right py-3 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="text-center py-8 text-gray-400">No categories yet.</td>
                            </tr>
                        ) : (
                            categories.map(category => (
                                <tr key={category.id} className="border-t border-gray-100">
                                    <td className="py-3 px-4">{category.name}</td>
                                    <td className="py-3 px-4">{category.food_item_count}</td>
                                    <td className="py-3 px-4 text-right flex justify-end gap-2">
                                        <button onClick={() => setEditingItem(category)} className="btn-secondary px-3 py-1 text-sm">Edit</button>
                                        <button onClick={() => handleDelete(category.id)} className="btn-danger px-3 py-1 text-sm">Delete</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}