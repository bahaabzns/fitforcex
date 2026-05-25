'use client';
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";
const labelCls = "text-xs text-muted-foreground mb-1 block";

const emptyForm = {
    name_en: '',
    name_ar: '',
    food_category: '',
    serving_size: '',
    serving_unit: '',
    calories_per_serving: '',
    carbs_per_serving: '',
    protein_per_serving: '',
    fats_per_serving: '',
};

export default function FoodItemsPage() {
    const [foodItems, setFoodItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

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

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleEditChange = (e) => setEditingItem({ ...editingItem, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/api/nutrition/food-items', formData);
            setFoodItems([...foodItems, response.data]);
            setFormData(emptyForm);
            setShowForm(false);
        } catch (error) {
            console.error('Error adding food item:', error);
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

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/nutrition/food-items/${id}`);
            setFoodItems(foodItems.filter(item => item.id !== id));
        } catch (error) {
            console.error('Error deleting food item:', error);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-36 rounded-lg" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const categoryOptions = categories.map(c => c.name_en);
    const foodItemColumns = [
        { key: "name_en", label: "Name (EN)", filterType: "text", sortable: true },
        { key: "name_ar", label: "الاسم (AR)", render: (row) => <span dir="rtl">{row.name_ar || "—"}</span> },
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

    const FoodForm = ({ data, onChange, onSubmit, submitLabel, isEdit }) => (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Name (English) *</label>
                    <input type="text" name="name_en" value={data.name_en || ''} placeholder="e.g. Apple" onChange={onChange} className={inputCls} required autoFocus={!isEdit} />
                </div>
                <div>
                    <label className={labelCls}>الاسم (عربي)</label>
                    <input type="text" name="name_ar" value={data.name_ar || ''} placeholder="مثال: تفاحة" onChange={onChange} className={inputCls} dir="rtl" />
                </div>
            </div>
            <div>
                <label className={labelCls}>Food Category</label>
                <select name="food_category" value={data.food_category || ''} onChange={onChange} className={inputCls}>
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.name_en}>{cat.name_en}{cat.name_ar ? ` / ${cat.name_ar}` : ''}</option>
                    ))}
                </select>
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className={labelCls}>Serving Size</label>
                    <input type="number" step="any" name="serving_size" value={data.serving_size || ''} placeholder="100" onChange={onChange} className={inputCls} />
                </div>
                <div className="flex-1">
                    <label className={labelCls}>Serving Unit</label>
                    <input type="text" name="serving_unit" value={data.serving_unit || ''} placeholder="g" onChange={onChange} className={inputCls} />
                </div>
            </div>
            <div>
                <label className={labelCls}>Nutrition facts per serving</label>
                <div className="grid grid-cols-4 gap-3">
                    <div>
                        <span className="text-xs text-muted-foreground">Calories</span>
                        <input type="number" step="any" name="calories_per_serving" value={data.calories_per_serving || ''} placeholder="kcal" onChange={onChange} className={inputCls} />
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Carbs</span>
                        <input type="number" step="any" name="carbs_per_serving" value={data.carbs_per_serving || ''} placeholder="g" onChange={onChange} className={inputCls} />
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Protein</span>
                        <input type="number" step="any" name="protein_per_serving" value={data.protein_per_serving || ''} placeholder="g" onChange={onChange} className={inputCls} />
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground">Fats</span>
                        <input type="number" step="any" name="fats_per_serving" value={data.fats_per_serving || ''} placeholder="g" onChange={onChange} className={inputCls} />
                    </div>
                </div>
            </div>
            <Button type="submit" variant="primary" fullWidth>{submitLabel}</Button>
        </form>
    );

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Food Items</h1>
                <p className="text-sm text-muted-foreground mt-1">Build your food database with nutritional values per serving.</p>
            </div>

            <Modal open={showForm} onClose={() => { setShowForm(false); setFormData(emptyForm); }} title="Add Food Item">
                <FoodForm data={formData} onChange={handleChange} onSubmit={handleSubmit} submitLabel="Add Food Item" />
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Food Item">
                <FoodForm data={editingItem || emptyForm} onChange={handleEditChange} onSubmit={handleUpdate} submitLabel="Save Changes" isEdit />
            </Modal>

            <DataTable
                columns={foodItemColumns}
                data={foodItems}
                rowKey="id"
                scrollable
                quickSearch={{ fields: ["name_en", "name_ar", "food_category"], placeholder: "Search food items..." }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(!showForm)}>+ Add Food Item</Button>}
            />
        </div>
    );
}
