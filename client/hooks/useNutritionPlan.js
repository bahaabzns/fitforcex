import { useState, useEffect } from "react";
import api from "@/lib/axios";

export function useNutritionPlan(clientId) {

    // State variables ------------------------------------------------------------------

    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedCycleIndex, setSelectedCycleIndex] = useState(0);
    const [selectedMeal, setSelectedMeal] = useState(null);
    const [pendingFocusPlanId, setPendingFocusPlanId] = useState(null);
    const [pendingFocusCycleId, setPendingFocusCycleId] = useState(null);
    const [pendingFocusMealId, setPendingFocusMealId] = useState(null);
    const [foodItems, setFoodItems] = useState([]);
    const [foodItemModalOpen, setFoodItemModalOpen] = useState(false);
    const [foodSearchQuery, setFoodSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState("created_desc");
    const [alternativeModalOpenForItemId, setAlternativeModalOpenForItemId] = useState(null);


    // Effects ------------------------------------------------------------------

    useEffect(() => {
            const fetchClientPlans = async () => {
            try {
                const response = await api.get(`/api/nutrition/plans?clientId=${clientId}`); // ✅ الصح
                setPlans(response.data);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching nutrition plans:", error);
                setLoading(false);
            }
            };

            fetchClientPlans();
    }, [clientId]);

    useEffect(() => {
        if (!foodItemModalOpen && !alternativeModalOpenForItemId) return;
        api.get("/api/nutrition/food-items").then((res) => setFoodItems(res.data));
    }, [foodItemModalOpen, alternativeModalOpenForItemId]);



    // Handlers ------------------------------------------------------------------

    const handleSelectedPlan = async (plan) => {
        try {
        const response = await api.get(`/api/nutrition/plans/${plan.id}`);
        setSelectedPlan(response.data);
        setSelectedCycleIndex(0);
        setSelectedMeal(null);
        } catch (error) {
        console.error("Error fetching plan details:", error);
        }
    };

    const handleCreatePlan = async () => {
        try {
            const response = await api.post("/api/nutrition/plans", { name: "New Plan", client_id: clientId });
            setPlans(prev => [...prev, response.data]);
            await handleSelectedPlan(response.data);
            setPendingFocusPlanId(response.data.id);
        } catch (error) {
            console.error("Error creating new plan:", error);
        }
    };

    const handleCreateCycle = async () => {
        try {
            const response = await api.post("/api/nutrition/cycles", { name: "New Cycle", planId: selectedPlan.id });
            const updatedPlan = {
                ...selectedPlan,
                cycles: [...selectedPlan.cycles, { ...response.data, meals: [] }],
            };
            setSelectedPlan(updatedPlan);
            setSelectedCycleIndex(updatedPlan.cycles.length - 1);
            setSelectedMeal(null);
            setPlans(prev => prev.map((p) => p.id === selectedPlan.id ? { ...p, cycle_count: updatedPlan.cycles.length, updated_at: new Date().toISOString() } : p));
            setPendingFocusCycleId(response.data.id);
        } catch (error) {
            console.error("Error adding new cycle:", error);
        }
    };

    const handleDeleteMeal = async (mealId) => {
        try {
            await api.delete(`/api/nutrition/meals/${mealId}`);
            const updatedCycles = selectedPlan.cycles.map((cycle) => ({
                ...cycle,
                meals: cycle.meals.filter((meal) => meal.id !== mealId),
            }));
            setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
            if (selectedMeal && selectedMeal.id === mealId) setSelectedMeal(null);
            setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
        } catch (error) {
            console.error("Error deleting meal:", error);
        }
    };

    const handleDuplicateMeal = async (mealId) => {
        try {
            const response = await api.post(`/api/nutrition/meals/${mealId}/duplicate`);
            const updatedCycles = selectedPlan.cycles.map((cycle) => ({
                ...cycle,
                meals: cycle.meals.some((m) => m.id === mealId)
                    ? [...cycle.meals, response.data]
                    : cycle.meals,
            }));
            setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
            setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
        } catch (error) {
            console.error("Error duplicating meal:", error);
        }
    };

    const handleDuplicateCycle = async (cycleId) => {
        try {
            const response = await api.post(`/api/nutrition/cycles/${cycleId}/duplicate`);
            setSelectedPlan({
                ...selectedPlan,
                cycles: [...selectedPlan.cycles, response.data],
            });
            setPlans(prev => prev.map((p) => p.id === selectedPlan.id ? { ...p, cycle_count: selectedPlan.cycles.length + 1, updated_at: new Date().toISOString() } : p));
        } catch (error) {
            console.error("Error duplicating cycle:", error);
        }
    };

    const handleDeleteCycle = async (cycleIndex) => {
        const cycleToDelete = selectedPlan.cycles[cycleIndex];
        try {
        await api.delete(`/api/nutrition/cycles/${cycleToDelete.id}`);
        const updatedCycles = selectedPlan.cycles.filter(
            (_, index) => index !== cycleIndex,
        );
        setSelectedPlan({
            ...selectedPlan,
            cycles: updatedCycles,
        });
        setPlans(prev => prev.map((p) => p.id === selectedPlan.id ? { ...p, cycle_count: updatedCycles.length, updated_at: new Date().toISOString() } : p));
        setSelectedCycleIndex(Math.max(0, cycleIndex - 1));
        setSelectedMeal(null);
        } catch (error) {
        console.error("Error deleting cycle:", error);
        }
    };

    const handleCreateMeal = async () => {
        try {
            const newMeal = { ...( await api.post("/api/nutrition/meals", {
                cycleId: selectedPlan.cycles[selectedCycleIndex].id,
                name: "New Meal",
            }) ).data, items: [] };
            const updatedCycles = selectedPlan.cycles.map((cycle, index) =>
                index === selectedCycleIndex
                    ? { ...cycle, meals: [...cycle.meals, newMeal] }
                    : cycle
            );
            setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
            setSelectedMeal(newMeal);
            setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
            setPendingFocusMealId(newMeal.id);
        } catch (error) {
            console.error("Error creating meal:", error);
        }
    };

    const handleFoodSearch = async (query) => {
        setFoodSearchQuery(query);
        try {
        const response = await api.get(`/api/nutrition/food-items?search=${query}`);
        setFoodItems(response.data);
        } catch (error) {
        console.error("Error searching food items:", error);
        }
    };

    const handleAddFoodItem = async (mealId, foodItem) => {
        try {
        const response = await api.post("/api/nutrition/meal-items", {
            mealId,
            foodItemId: foodItem.id,
            amount: foodItem.serving_size,
            unit: foodItem.serving_unit,
        });
        const updatedCycles = selectedPlan.cycles.map((cycle) => {
            return {
            ...cycle,
            meals: cycle.meals.map((meal) => {
                if (meal.id === mealId) {
                return { ...meal, items: [...meal.items, response.data] };
                }
                return meal;
            }),
            };
        });
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
        setFoodItemModalOpen(false);
        setAlternativeModalOpenForItemId(null);
        setFoodSearchQuery("");
        setSelectedMeal((prev) => ({
            ...prev,
            items: [...prev.items, { ...response.data, alternatives: [] }],
        }));
        setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
        } catch (error) {
        console.error("Error adding food item:", error);
        }
    };

    const handleAddMultipleFoodItems = async (mealId, items) => {
        try {
            const addedItems = await Promise.all(
                items.map(foodItem =>
                    api.post("/api/nutrition/meal-items", {
                        mealId,
                        foodItemId: foodItem.id,
                        amount: foodItem.serving_size,
                        unit: foodItem.serving_unit,
                    }).then(res => res.data)
                )
            );
            const updatedCycles = selectedPlan.cycles.map((cycle) => ({
                ...cycle,
                meals: cycle.meals.map((meal) =>
                    meal.id === mealId
                        ? { ...meal, items: [...meal.items, ...addedItems] }
                        : meal
                ),
            }));
            setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
            setFoodItemModalOpen(false);
            setAlternativeModalOpenForItemId(null);
            setFoodSearchQuery("");
            setSelectedMeal((prev) => ({ ...prev, items: [...prev.items, ...addedItems.map(i => ({ ...i, alternatives: [] }))] }));
            setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
        } catch (error) {
            console.error("Error adding food items:", error);
        }
    };

    const handleDeleteMealItem = async (itemId) => {
        try {
            await api.delete(`/api/nutrition/meal-items/${itemId}`);
            const updatedItems = selectedMeal.items.filter((i) => i.id !== itemId);
            setSelectedMeal({ ...selectedMeal, items: updatedItems });
            const updatedCycles = selectedPlan.cycles.map((cycle) => ({
                ...cycle,
                meals: cycle.meals.map((meal) =>
                    meal.id === selectedMeal.id ? { ...meal, items: updatedItems } : meal
                ),
            }));
            setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
            setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
        } catch (error) {
            console.error("Error deleting meal item:", error);
        }
    };

    const handleAmountChange = async (itemId, newAmount) => {
        const response = await api.put(`/api/nutrition/meal-items/${itemId}`, {
            amount: newAmount,
            unit: selectedMeal.items.find((i) => i.id === itemId).serving_unit,
        });
        const mainItemAlts = selectedMeal.items.find(i => i.id === itemId)?.alternatives ?? [];
        const targetCalories = (response.data.amount / response.data.serving_size) * response.data.calories_per_serving;
        let finalAlts = mainItemAlts;
        if (mainItemAlts.length > 0) {
            const updatedAlts = await Promise.all(
                mainItemAlts.map(alt => {
                    const newAltAmount = Math.round((targetCalories / alt.calories_per_serving) * alt.serving_size * 10) / 10;
                    return api.put(`/api/nutrition/meal-item-alternatives/${alt.id}`, { amount: newAltAmount })
                        .then(res => res.data)
                        .catch(() => alt);
                })
            );
            finalAlts = updatedAlts;
        }
        // عدّل selectedMeal.items
        const updatedItems = selectedMeal.items.map((i) =>
        i.id === itemId ? { ...response.data, alternatives: finalAlts } : i,
        );
        setSelectedMeal({ ...selectedMeal, items: updatedItems });
        // عدّل selectedPlan برضو
        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
        ...cycle,
        meals: cycle.meals.map((meal) =>
            meal.id === selectedMeal.id ? { ...meal, items: updatedItems } : meal,
        ),
        }));
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
        setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
    };

    const handleDeletePlan = async (planId) => {
        try {
            await api.delete(`/api/nutrition/plans/${planId}`);
            setPlans(plans.filter((p) => p.id !== planId));
            if (selectedPlan && selectedPlan.id === planId) {
                setSelectedPlan(null);
                setSelectedMeal(null);
                setSelectedCycleIndex(0);
            }
        } catch (error) {
            console.error("Error deleting plan:", error);
        }
    };

    const handleDuplicatePlan = async (planId) => {
        try {
            const response = await api.post(`/api/nutrition/plans/${planId}/duplicate`);
            setPlans([response.data, ...plans]);
        } catch (error) {
            console.error("Error duplicating plan:", error);
        }
    };

    const sortedPlans = [...plans].sort((a, b) => {
        if (sortOrder === "created_desc") return new Date(b.created_at) - new Date(a.created_at);
        if (sortOrder === "created_asc")  return new Date(a.created_at) - new Date(b.created_at);
        if (sortOrder === "updated_desc") return new Date(b.updated_at) - new Date(a.updated_at);
        return 0;
    });

    const handleRenameCycle = async (cycleId, newName) => {
        const response = await api.put(`/api/nutrition/cycles/${cycleId}`, { name: newName });
        const updatedCycles = selectedPlan.cycles.map((cycle) =>
            cycle.id === cycleId ? { ...cycle, name: response.data.name } : cycle
        );
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
        setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
    };

    const handleUpdateCycleGoals = async (cycleId, goals) => {
        const cycle = selectedPlan.cycles.find(c => c.id === cycleId);
        if (!cycle) return;
        const response = await api.put(`/api/nutrition/cycles/${cycleId}`, {
            name: cycle.name,
            ...goals,
        });
        const updatedCycles = selectedPlan.cycles.map((c) =>
            c.id === cycleId ? { ...c, ...response.data } : c
        );
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
        setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
    };

    const handleRenamePlan = async (planId, newName) => {
        const response = await api.put(`/api/nutrition/plans/${planId}`, { name: newName, status: selectedPlan.status });
        setSelectedPlan({ ...selectedPlan, name: response.data.name });
        setPlans(plans.map((p) => p.id === planId ? { ...p, name: response.data.name, updated_at: response.data.updated_at } : p));
    };

    const handleRenameMeal = async (mealId, newName) => {
        const response = await api.put(`/api/nutrition/meals/${mealId}`, { name: newName });
        setSelectedMeal({ ...selectedMeal, name: response.data.name });
        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === mealId ? { ...meal, name: response.data.name } : meal,
            ),
        }));
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
        setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
    };

    const handleReorderMeals = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        const cycle = selectedPlan.cycles[selectedCycleIndex];
        const meals = [...cycle.meals];
        const [moved] = meals.splice(fromIndex, 1);
        meals.splice(toIndex, 0, moved);
        const updatedCycles = selectedPlan.cycles.map((c, i) =>
            i === selectedCycleIndex ? { ...c, meals } : c
        );
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
    };

    const handleReorderCycles = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        const cycles = [...selectedPlan.cycles];
        const [moved] = cycles.splice(fromIndex, 1);
        cycles.splice(toIndex, 0, moved);
        setSelectedPlan({ ...selectedPlan, cycles });
        setSelectedCycleIndex(toIndex);
    };

    const handleReorderFoodItems = (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        const items = [...selectedMeal.items];
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        setSelectedMeal({ ...selectedMeal, items });
        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === selectedMeal.id ? { ...meal, items } : meal
            ),
        }));
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
    };

    // ── Alternatives ────────────────────────────────────────────────────────────

    const updateItemAlts = (mealItemId, updater) => {
        const updatedItems = selectedMeal.items.map((i) =>
            i.id === mealItemId ? { ...i, alternatives: updater(i.alternatives ?? []) } : i
        );
        setSelectedMeal({ ...selectedMeal, items: updatedItems });
        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === selectedMeal.id ? { ...meal, items: updatedItems } : meal
            ),
        }));
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
    };

    const handleAddAlternatives = async (mealItemId, foodItems) => {
        try {
            const mainItem = selectedMeal.items.find(i => i.id === mealItemId);
            const targetCalories = (mainItem.amount / mainItem.serving_size) * mainItem.calories_per_serving;
            const added = await Promise.all(
                foodItems.map((foodItem) =>
                    api.post(`/api/nutrition/meal-items/${mealItemId}/alternatives`, {
                        foodItemId: foodItem.id,
                        amount: Math.round((targetCalories / foodItem.calories_per_serving) * foodItem.serving_size * 10) / 10,
                    }).then((res) => res.data)
                )
            );
            updateItemAlts(mealItemId, (alts) => [...alts, ...added]);
            setAlternativeModalOpenForItemId(null);
            setFoodSearchQuery("");
        } catch (error) {
            console.error("Error adding alternatives:", error);
        }
    };

    const handleDeleteAlternative = async (mealItemId, altId) => {
        try {
            await api.delete(`/api/nutrition/meal-item-alternatives/${altId}`);
            updateItemAlts(mealItemId, (alts) => alts.filter((a) => a.id !== altId));
        } catch (error) {
            console.error("Error deleting alternative:", error);
        }
    };

    const handleAlternativeAmountChange = async (mealItemId, altId, newAmount) => {
        try {
            const response = await api.put(`/api/nutrition/meal-item-alternatives/${altId}`, { amount: newAmount });
            updateItemAlts(mealItemId, (alts) => alts.map((a) => (a.id === altId ? response.data : a)));
        } catch (error) {
            console.error("Error updating alternative amount:", error);
        }
    };

    const handleUpdateCycleNote = async (cycleId, note) => {
        const cycle = selectedPlan.cycles.find(c => c.id === cycleId);
        if (!cycle) return;
        await api.put(`/api/nutrition/cycles/${cycleId}`, { name: cycle.name, note });
        const updatedCycles = selectedPlan.cycles.map((c) =>
            c.id === cycleId ? { ...c, note } : c
        );
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
        setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
    };

    const handleUpdateMealNote = async (mealId, note) => {
        await api.put(`/api/nutrition/meals/${mealId}`, { name: selectedMeal.name, note });
        setSelectedMeal({ ...selectedMeal, note });
        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === mealId ? { ...meal, note } : meal
            ),
        }));
        setSelectedPlan({ ...selectedPlan, cycles: updatedCycles });
        setPlans(plans.map((p) => p.id === selectedPlan.id ? { ...p, updated_at: new Date().toISOString() } : p));
    };




    // Return all state and handlers ------------------------------------------------------------------

    return {
        plans, setPlans,
        selectedPlan, setSelectedPlan,
        selectedCycleIndex, setSelectedCycleIndex,
        selectedMeal, setSelectedMeal,
        pendingFocusPlanId, setPendingFocusPlanId,
        pendingFocusCycleId, setPendingFocusCycleId,
        pendingFocusMealId, setPendingFocusMealId,
        foodItems, setFoodItems,
        foodItemModalOpen, setFoodItemModalOpen,
        foodSearchQuery, setFoodSearchQuery,
        loading, setLoading,
        handleSelectedPlan,
        handleCreatePlan,
        handleCreateCycle,
        handleDeleteCycle,
        handleCreateMeal,
        handleAddFoodItem,
        handleAddMultipleFoodItems,
        handleDeleteMealItem,
        handleAmountChange,
        handleFoodSearch,
        handleRenameMeal,
        handleRenamePlan,
        handleRenameCycle,
        handleUpdateCycleGoals,
        handleDeletePlan,
        handleDuplicatePlan,
        handleDeleteMeal,
        handleDuplicateMeal,
        handleDuplicateCycle,
        sortedPlans,
        sortOrder, setSortOrder,
        handleReorderMeals,
        handleReorderCycles,
        handleReorderFoodItems,
        handleUpdateCycleNote,
        handleUpdateMealNote,
        alternativeModalOpenForItemId, setAlternativeModalOpenForItemId,
        handleAddAlternatives,
        handleDeleteAlternative,
        handleAlternativeAmountChange,
    }
}