'use client';
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

export default function FoodItemsPage() {
    const [foodItems, setFoodItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        food_category: '',
        serving_size: '',
        serving_unit: '',
        calories_per_serving: '',
        carbs_per_serving: '',
        protein_per_serving: '',
        fats_per_serving: ''
    });

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/api/nutrition/food-items', formData);
            setFoodItems([...foodItems, response.data]);
            setFormData({
                name: '',
                food_category: '',
                serving_size: '',
                serving_unit: '',
                calories_per_serving: '',
                carbs_per_serving: '',
                protein_per_serving: '',
                fats_per_serving: ''
            });
            setShowForm(false);
        } catch (error) {
            console.error('Error adding food item:', error);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/nutrition/food-items/${id}`);
            setFoodItems(foodItems.filter(item => item.id !== id));
        } catch (error) {
            console.error('Error deleting food item:', error);
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

    const handleEditChange = (e) => {
        setEditingItem({ ...editingItem, [e.target.name]: e.target.value });
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-36 rounded-lg" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const categoryOptions = categories.map(c => c.name);
    const foodItemColumns = [
        { key: "name", label: "Name", filterType: "text", sortable: true },
        { key: "food_category", label: "Category", filterType: "multi", options: categoryOptions, sortable: true },
        { key: "serving_size", label: "Serving Size", sortable: true },
        { key: "serving_unit", label: "Unit" },
        { key: "calories_per_serving", label: "Calories", sortable: true },
        { key: "carbs_per_serving", label: "Carbs", sortable: true },
        { key: "protein_per_serving", label: "Protein", sortable: true },
        { key: "fats_per_serving", label: "Fat", sortable: true },
        { key: "actions", label: "Actions", cardPriority: "hidden", render: (row) => (
            <div className="flex gap-2">
                <button onClick={() => setEditingItem(row)} className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted px-3 py-1 text-sm transition-colors cursor-pointer">Edit</button>
                <button onClick={() => handleDelete(row.id)} className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1 text-sm transition-colors cursor-pointer">Delete</button>
            </div>
        )},
    ];

    return (
        <div className="p-8">
            <div className="flex items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold flex-1">Food Items</h1>
                <Button onClick={() => setShowForm(!showForm)} variant="primary" className="shrink-0">
                    + Add Food Item
                </Button>
            </div>

            <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Food Item">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">Name</label>
                                <input type="text" name="name" value={formData.name} placeholder="eg. Apple" onChange={handleChange} className={inputCls} />
                            </div>

                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">Food Category</label>
                                <select name="food_category" value={formData.food_category} onChange={handleChange} className={inputCls}>
                                <option value="">Select Category</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                            </div>


                            <div className="flex gap-4">
                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">Serving Size</label>
                                    <input type="number" step="any" name="serving_size" value={formData.serving_size} placeholder="100" onChange={handleChange} className={inputCls} />
                                </div>

                                <div>
                                    <label className="block text-sm text-muted-foreground mb-1">Serving Unit</label>
                                    <input type="text" name="serving_unit" value={formData.serving_unit} placeholder="g" onChange={handleChange} className={inputCls} />
                                </div>

                            </div>

                            <div>
                                <label className="block text-sm text-muted-foreground mb-1">Nutrition facts per serving</label>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <span className="text-xs text-muted-foreground">Calories</span>
                                        <input type="number" step="any" name="calories_per_serving" value={formData.calories_per_serving} placeholder="kcal" onChange={handleChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Carbs</span>
                                        <input type="number" step="any" name="carbs_per_serving" value={formData.carbs_per_serving} placeholder="g" onChange={handleChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Protein</span>
                                        <input type="number" step="any" name="protein_per_serving" value={formData.protein_per_serving} placeholder="g" onChange={handleChange} className={inputCls} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Fats</span>
                                        <input type="number" step="any" name="fats_per_serving" value={formData.fats_per_serving} placeholder="g" onChange={handleChange} className={inputCls} />
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" variant="primary" fullWidth>Add Food Item</Button>
                        </form>
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Food Item">
                        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                            <input type="text" name="name" value={editingItem?.name || ''} placeholder="Name" onChange={handleEditChange} className={inputCls} />
                            <select name="food_category" value={editingItem?.food_category || ''} onChange={handleEditChange} className={inputCls}>
                                <option value="">Select Category</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                            <input type="number" step="any" name="serving_size" value={editingItem?.serving_size || ''} placeholder="Serving Size" onChange={handleEditChange} className={inputCls} />
                            <input type="text" name="serving_unit" value={editingItem?.serving_unit || ''} placeholder="Serving Unit" onChange={handleEditChange} className={inputCls} />
                            <input type="number" step="any" name="calories_per_serving" value={editingItem?.calories_per_serving || ''} placeholder="Calories per Serving" onChange={handleEditChange} className={inputCls} />
                            <input type="number" step="any" name="carbs_per_serving" value={editingItem?.carbs_per_serving || ''} placeholder="Carbs per Serving" onChange={handleEditChange} className={inputCls} />
                            <input type="number" step="any" name="protein_per_serving" value={editingItem?.protein_per_serving || ''} placeholder="Protein per Serving" onChange={handleEditChange} className={inputCls} />
                            <input type="number" step="any" name="fats_per_serving" value={editingItem?.fats_per_serving || ''} placeholder="Fats per Serving" onChange={handleEditChange} className={inputCls} />
                            <Button type="submit" variant="primary" fullWidth>Save Changes</Button>
                        </form>
            </Modal>

            <DataTable columns={foodItemColumns} data={foodItems} rowKey="id" scrollable />
        </div>
    );
}
