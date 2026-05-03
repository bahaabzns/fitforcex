'use client';
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

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

    const categoryColumns = [
        { key: "name", label: "Name", filterType: "text", sortable: true },
        { key: "food_item_count", label: "Food Items", sortable: true },
        { key: "actions", label: "Actions", cardPriority: "hidden", render: (row) => (
            <div className="flex gap-2">
                <button onClick={() => setEditingItem(row)} className="btn-secondary px-3 py-1 text-sm">Edit</button>
                <button onClick={() => handleDelete(row.id)} className="btn-danger px-3 py-1 text-sm">Delete</button>
            </div>
        )},
    ];

    return (
        <div className="p-8">
            <div className="flex items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold flex-1">Food Categories</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 shrink-0">
                    + Add Category
                </button>
            </div>

            <Modal open={showForm} onClose={() => setShowForm(false)} title="New Category">
                        <form onSubmit={handleAdd} className="flex flex-col gap-4">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Category name"
                                className={inputCls}
                                required
                            />
                            <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition-colors cursor-pointer">Add Category</button>
                        </form>
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Category">
                        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                            <input
                                type="text"
                                value={editingItem?.name || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                placeholder="Category name"
                                className={inputCls}
                                required
                            />
                            <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition-colors cursor-pointer">Save Changes</button>
                        </form>
            </Modal>

            <DataTable columns={categoryColumns} data={categories} rowKey="id" />
        </div>
    );
}
