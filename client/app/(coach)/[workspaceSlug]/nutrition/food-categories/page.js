'use client';
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

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
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-44 rounded-lg" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const categoryColumns = [
        { key: "name", label: "Name", filterType: "text", sortable: true },
        { key: "food_item_count", label: "Food Items", sortable: true },
        { key: "actions", label: "Actions", cardPriority: "hidden", render: (row) => (
            <div className="flex gap-2">
                <button onClick={() => setEditingItem(row)} className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted px-3 py-1 text-sm transition-colors cursor-pointer">Edit</button>
                <button onClick={() => handleDelete(row.id)} className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1 text-sm transition-colors cursor-pointer">Delete</button>
            </div>
        )},
    ];

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Food Categories</h1>
                <p className="text-sm text-muted-foreground mt-1">Organize food items into categories for your nutrition library.</p>
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
                            <Button type="submit" variant="primary" fullWidth>Add Category</Button>
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
                            <Button type="submit" variant="primary" fullWidth>Save Changes</Button>
                        </form>
            </Modal>

            <DataTable
                columns={categoryColumns}
                data={categories}
                rowKey="id"
                quickSearch={{ fields: ["name"], placeholder: "Search categories..." }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(!showForm)}>+ Add Category</Button>}
            />
        </div>
    );
}
