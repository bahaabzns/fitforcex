'use client';
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";

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
        return <div className="p-8">Loading...</div>;
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
                <button onClick={() => setEditingItem(row)} className="btn-primary px-3 py-1 text-sm">Edit</button>
                <button onClick={() => handleDelete(row.id)} className="btn-danger px-3 py-1 text-sm">Delete</button>
            </div>
        )},
    ];

    return (
        <div className="p-8">
            <div className="flex items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold flex-1">Food Items</h1>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 shrink-0">
                    + Add Food Item
                </button>
            </div>

            <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Food Item">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <input type="text" name="name" value={formData.name} placeholder="Name" onChange={handleChange} className="input-field" />
                            <select name="food_category" value={formData.food_category} onChange={handleChange} className="input-field">
                                <option value="">Select Category</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                            <input type="number" step="any" name="serving_size" value={formData.serving_size} placeholder="Serving Size" onChange={handleChange} className="input-field" />
                            <input type="text" name="serving_unit" value={formData.serving_unit} placeholder="Serving Unit" onChange={handleChange} className="input-field" />
                            <input type="number" step="any" name="calories_per_serving" value={formData.calories_per_serving} placeholder="Calories per Serving" onChange={handleChange} className="input-field" />
                            <input type="number" step="any" name="carbs_per_serving" value={formData.carbs_per_serving} placeholder="Carbs per Serving" onChange={handleChange} className="input-field" />
                            <input type="number" step="any" name="protein_per_serving" value={formData.protein_per_serving} placeholder="Protein per Serving" onChange={handleChange} className="input-field" />
                            <input type="number" step="any" name="fats_per_serving" value={formData.fats_per_serving} placeholder="Fats per Serving" onChange={handleChange} className="input-field" />
                            <button type="submit" className="btn-primary px-4">Add Food Item</button>
                        </form>
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Food Item">
                        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                            <input type="text" name="name" value={editingItem?.name || ''} placeholder="Name" onChange={handleEditChange} className="input-field" />
                            <select name="food_category" value={editingItem?.food_category || ''} onChange={handleEditChange} className="input-field">
                                <option value="">Select Category</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                            <input type="number" step="any" name="serving_size" value={editingItem?.serving_size || ''} placeholder="Serving Size" onChange={handleEditChange} className="input-field" />
                            <input type="text" name="serving_unit" value={editingItem?.serving_unit || ''} placeholder="Serving Unit" onChange={handleEditChange} className="input-field" />
                            <input type="number" step="any" name="calories_per_serving" value={editingItem?.calories_per_serving || ''} placeholder="Calories per Serving" onChange={handleEditChange} className="input-field" />
                            <input type="number" step="any" name="carbs_per_serving" value={editingItem?.carbs_per_serving || ''} placeholder="Carbs per Serving" onChange={handleEditChange} className="input-field" />
                            <input type="number" step="any" name="protein_per_serving" value={editingItem?.protein_per_serving || ''} placeholder="Protein per Serving" onChange={handleEditChange} className="input-field" />
                            <input type="number" step="any" name="fats_per_serving" value={editingItem?.fats_per_serving || ''} placeholder="Fats per Serving" onChange={handleEditChange} className="input-field" />
                            <button type="submit" className="btn-primary px-4">Save Changes</button>
                        </form>
            </Modal>

            <DataTable columns={foodItemColumns} data={foodItems} rowKey="id" scrollable />
        </div>
    );
}
