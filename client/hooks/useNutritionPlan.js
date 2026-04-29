import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/lib/axios";

function makeTempId(prefix) {
    return `tmp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function withListOrders(items, orderKey) {
    return items.map((item, index) => ({ ...item, [orderKey]: index + 1 }));
}

function hydratePlan(plan) {
    const cycles = (plan.cycles ?? []).map((cycle, cycleIndex) => {
        const meals = (cycle.meals ?? []).map((meal, mealIndex) => {
            const mealItems = (meal.items ?? []).map((item, itemIndex) => {
                const alternatives = withListOrders(item.alternatives ?? [], "alt_order");
                return {
                    ...item,
                    meal_item_order: itemIndex + 1,
                    alternatives,
                };
            });
            return {
                ...meal,
                meal_order: mealIndex + 1,
                items: mealItems,
            };
        });
        return {
            ...cycle,
            cycle_order: cycleIndex + 1,
            meals,
        };
    });

    return {
        ...plan,
        cycles,
        cycle_count: cycles.length,
    };
}

function cloneWithNewIdsForCycle(cycle) {
    return {
        ...cycle,
        id: makeTempId("cycle"),
        name: `Copy of ${cycle.name}`,
        meals: withListOrders(
            (cycle.meals ?? []).map((meal) => ({
                ...meal,
                id: makeTempId("meal"),
                items: withListOrders(
                    (meal.items ?? []).map((item) => ({
                        ...item,
                        id: makeTempId("item"),
                        alternatives: withListOrders(
                            (item.alternatives ?? []).map((alt) => ({
                                ...alt,
                                id: makeTempId("alt"),
                            })),
                            "alt_order"
                        ),
                    })),
                    "meal_item_order"
                ),
            })),
            "meal_order"
        ),
    };
}

function cloneWithNewIdsForMeal(meal) {
    return {
        ...meal,
        id: makeTempId("meal"),
        name: `Copy of ${meal.name}`,
        items: withListOrders(
            (meal.items ?? []).map((item) => ({
                ...item,
                id: makeTempId("item"),
                alternatives: withListOrders(
                    (item.alternatives ?? []).map((alt) => ({
                        ...alt,
                        id: makeTempId("alt"),
                    })),
                    "alt_order"
                ),
            })),
            "meal_item_order"
        ),
    };
}

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
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState("idle");
    const saveStatusTimeoutRef = useRef(null);


    // Helpers ------------------------------------------------------------------

    const applyPlanUpdate = useCallback((nextPlan, nextMealId = null) => {
        const hydrated = hydratePlan({
            ...nextPlan,
            updated_at: new Date().toISOString(),
        });

        setSelectedPlan(hydrated);
        setPlans((prev) => prev.map((p) => (p.id === hydrated.id ? hydrated : p)));

        if (nextMealId) {
            const foundMeal = hydrated.cycles.flatMap((c) => c.meals).find((m) => m.id === nextMealId) ?? null;
            setSelectedMeal(foundMeal);
            return;
        }

        if (selectedMeal) {
            const sameMeal = hydrated.cycles.flatMap((c) => c.meals).find((m) => m.id === selectedMeal.id) ?? null;
            setSelectedMeal(sameMeal);
        }
    }, [selectedMeal]);

    const markDirty = useCallback(() => {
        setIsDirty(true);
    }, []);

    const fetchClientPlans = useCallback(async () => {
        if (!clientId) {
            setPlans([]);
            setSelectedPlan(null);
            setSelectedMeal(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const summaryResponse = await api.get(`/api/nutrition/plans?clientId=${clientId}`);
            const summaries = summaryResponse.data ?? [];

            const detailedPlans = await Promise.all(
                summaries.map(async (plan) => {
                    const detail = await api.get(`/api/nutrition/plans/${plan.id}`);
                    return hydratePlan({ ...detail.data, cycle_count: detail.data?.cycles?.length ?? 0 });
                })
            );

            setPlans(detailedPlans);
            setSelectedPlan((prev) => {
                if (!prev) return null;
                return detailedPlans.find((p) => p.id === prev.id) ?? null;
            });
            setSelectedMeal((prevMeal) => {
                if (!prevMeal) return null;
                const flatMeals = detailedPlans.flatMap((p) => p.cycles.flatMap((c) => c.meals));
                return flatMeals.find((m) => m.id === prevMeal.id) ?? null;
            });
            setIsDirty(false);
        } catch (error) {
            console.error("Error fetching nutrition plans:", error);
        } finally {
            setLoading(false);
        }
    }, [clientId]);


    // Effects ------------------------------------------------------------------

    useEffect(() => {
        fetchClientPlans();
    }, [fetchClientPlans]);

    useEffect(() => {
        if (!foodItemModalOpen && !alternativeModalOpenForItemId) return;
        api.get("/api/nutrition/food-items").then((res) => setFoodItems(res.data));
    }, [foodItemModalOpen, alternativeModalOpenForItemId]);

    useEffect(() => {
        return () => {
            if (saveStatusTimeoutRef.current) {
                clearTimeout(saveStatusTimeoutRef.current);
            }
        };
    }, []);



    // Handlers ------------------------------------------------------------------

    const handleSelectedPlan = (plan) => {
        const found = plans.find((p) => p.id === plan.id);
        if (!found) return;
        setSelectedPlan(found);
        setSelectedCycleIndex(0);
        setSelectedMeal(null);
    };

    const handleCreatePlan = () => {
        const now = new Date().toISOString();
        const newCycle = {
            id: makeTempId("cycle"),
            name: "Cycle 1",
            cycle_order: 1,
            note: "",
            goal_calories: null,
            goal_protein: null,
            goal_carbs: null,
            goal_fats: null,
            meals: [],
        };
        const newPlan = hydratePlan({
            id: makeTempId("plan"),
            name: "New Plan",
            client_id: clientId,
            status: "inactive",
            created_at: now,
            updated_at: now,
            cycles: [newCycle],
        });

        setPlans((prev) => [newPlan, ...prev]);
        setSelectedPlan(newPlan);
        setSelectedCycleIndex(0);
        setSelectedMeal(null);
        setPendingFocusPlanId(newPlan.id);
        markDirty();
    };

    const handleCreateCycle = () => {
        if (!selectedPlan) return;
        const newCycle = {
            id: makeTempId("cycle"),
            name: "New Cycle",
            cycle_order: (selectedPlan.cycles?.length ?? 0) + 1,
            note: "",
            goal_calories: null,
            goal_protein: null,
            goal_carbs: null,
            goal_fats: null,
            meals: [],
        };

        const updatedPlan = {
            ...selectedPlan,
            cycles: withListOrders([...(selectedPlan.cycles ?? []), newCycle], "cycle_order"),
        };
        applyPlanUpdate(updatedPlan);
        setSelectedCycleIndex(updatedPlan.cycles.length - 1);
        setSelectedMeal(null);
        setPendingFocusCycleId(newCycle.id);
        markDirty();
    };

    const handleDeleteMeal = (mealId) => {
        if (!selectedPlan) return;
        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: withListOrders(cycle.meals.filter((meal) => meal.id !== mealId), "meal_order"),
        }));
        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles });
        if (selectedMeal && selectedMeal.id === mealId) setSelectedMeal(null);
        markDirty();
    };

    const handleDuplicateMeal = (mealId) => {
        if (!selectedPlan) return;
        const updatedCycles = selectedPlan.cycles.map((cycle) => {
            const mealIndex = cycle.meals.findIndex((m) => m.id === mealId);
            if (mealIndex === -1) return cycle;

            const duplicated = cloneWithNewIdsForMeal(cycle.meals[mealIndex]);
            const nextMeals = [...cycle.meals, duplicated];
            return {
                ...cycle,
                meals: withListOrders(nextMeals, "meal_order"),
            };
        });

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles });
        markDirty();
    };

    const handleDuplicateCycle = (cycleId) => {
        if (!selectedPlan) return;
        const original = selectedPlan.cycles.find((c) => c.id === cycleId);
        if (!original) return;

        const duplicated = cloneWithNewIdsForCycle(original);
        const nextCycles = withListOrders([...(selectedPlan.cycles ?? []), duplicated], "cycle_order");
        applyPlanUpdate({ ...selectedPlan, cycles: nextCycles });
        markDirty();
    };

    const handleDeleteCycle = (cycleIndex) => {
        if (!selectedPlan) return;
        const cycleToDelete = selectedPlan.cycles[cycleIndex];
        if (!cycleToDelete) return;

        const updatedCycles = withListOrders(
            selectedPlan.cycles.filter((_, index) => index !== cycleIndex),
            "cycle_order"
        );

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles });
        setSelectedCycleIndex(Math.max(0, cycleIndex - 1));
        setSelectedMeal(null);
        markDirty();
    };

    const handleCreateMeal = () => {
        if (!selectedPlan || !selectedPlan.cycles[selectedCycleIndex]) return;

        const newMeal = {
            id: makeTempId("meal"),
            name: "New Meal",
            meal_order: (selectedPlan.cycles[selectedCycleIndex].meals?.length ?? 0) + 1,
            note: "",
            items: [],
        };

        const updatedCycles = selectedPlan.cycles.map((cycle, index) =>
            index === selectedCycleIndex
                ? { ...cycle, meals: withListOrders([...(cycle.meals ?? []), newMeal], "meal_order") }
                : cycle
        );

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, newMeal.id);
        setPendingFocusMealId(newMeal.id);
        markDirty();
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

    const handleAddFoodItem = (mealId, foodItem) => {
        if (!selectedPlan || !selectedMeal) return;

        const newItem = {
            id: makeTempId("item"),
            food_item_id: foodItem.id,
            amount: foodItem.serving_size,
            meal_item_order: (selectedMeal.items?.length ?? 0) + 1,
            serving_unit: foodItem.serving_unit,
            name: foodItem.name,
            calories_per_serving: foodItem.calories_per_serving,
            protein_per_serving: foodItem.protein_per_serving,
            carbs_per_serving: foodItem.carbs_per_serving,
            fats_per_serving: foodItem.fats_per_serving,
            serving_size: foodItem.serving_size,
            food_category: foodItem.food_category,
            alternatives: [],
        };

        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === mealId
                    ? { ...meal, items: withListOrders([...(meal.items ?? []), newItem], "meal_item_order") }
                    : meal
            ),
        }));

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, mealId);
        setFoodItemModalOpen(false);
        setAlternativeModalOpenForItemId(null);
        setFoodSearchQuery("");
        markDirty();
    };

    const handleAddMultipleFoodItems = (mealId, items) => {
        if (!selectedPlan || !selectedMeal) return;

        const toAdd = items.map((foodItem) => ({
            id: makeTempId("item"),
            food_item_id: foodItem.id,
            amount: foodItem.serving_size,
            serving_unit: foodItem.serving_unit,
            name: foodItem.name,
            calories_per_serving: foodItem.calories_per_serving,
            protein_per_serving: foodItem.protein_per_serving,
            carbs_per_serving: foodItem.carbs_per_serving,
            fats_per_serving: foodItem.fats_per_serving,
            serving_size: foodItem.serving_size,
            food_category: foodItem.food_category,
            alternatives: [],
        }));

        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === mealId
                    ? { ...meal, items: withListOrders([...(meal.items ?? []), ...toAdd], "meal_item_order") }
                    : meal
            ),
        }));

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, mealId);
        setFoodItemModalOpen(false);
        setAlternativeModalOpenForItemId(null);
        setFoodSearchQuery("");
        markDirty();
    };

    const handleDeleteMealItem = (itemId) => {
        if (!selectedPlan || !selectedMeal) return;

        const updatedItems = withListOrders(
            selectedMeal.items.filter((i) => i.id !== itemId),
            "meal_item_order"
        );

        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === selectedMeal.id ? { ...meal, items: updatedItems } : meal
            ),
        }));

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, selectedMeal.id);
        markDirty();
    };

    const handleAmountChange = (itemId, newAmount) => {
        if (!selectedPlan || !selectedMeal) return;

        const parsedAmount = Number(newAmount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

        const mainItem = selectedMeal.items.find((i) => i.id === itemId);
        if (!mainItem) return;

        const targetCalories = (parsedAmount / mainItem.serving_size) * mainItem.calories_per_serving;

        const updatedItems = selectedMeal.items.map((i) => {
            if (i.id !== itemId) return i;

            const updatedAlts = (i.alternatives ?? []).map((alt) => ({
                ...alt,
                amount: Math.round((targetCalories / alt.calories_per_serving) * alt.serving_size * 10) / 10,
            }));

            return {
                ...i,
                amount: parsedAmount,
                alternatives: updatedAlts,
            };
        });

        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === selectedMeal.id ? { ...meal, items: updatedItems } : meal
            ),
        }));

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, selectedMeal.id);
        markDirty();
    };

    const handleDeletePlan = (planId) => {
        const remaining = plans.filter((p) => p.id !== planId);
        setPlans(remaining);

        if (selectedPlan && selectedPlan.id === planId) {
            setSelectedPlan(null);
            setSelectedMeal(null);
            setSelectedCycleIndex(0);
        }

        markDirty();
    };

    const handleDuplicatePlan = (planId) => {
        const original = plans.find((p) => p.id === planId);
        if (!original) return;

        const now = new Date().toISOString();
        const duplicatedPlan = hydratePlan({
            ...original,
            id: makeTempId("plan"),
            name: `Copy of ${original.name}`,
            status: "inactive",
            created_at: now,
            updated_at: now,
            cycles: withListOrders(
                (original.cycles ?? []).map((cycle) => cloneWithNewIdsForCycle(cycle)),
                "cycle_order"
            ),
        });

        setPlans((prev) => [duplicatedPlan, ...prev]);
        markDirty();
    };

    const sortedPlans = [...plans].sort((a, b) => {
        if (sortOrder === "created_desc") return new Date(b.created_at) - new Date(a.created_at);
        if (sortOrder === "created_asc") return new Date(a.created_at) - new Date(b.created_at);
        if (sortOrder === "updated_desc") return new Date(b.updated_at) - new Date(a.updated_at);
        return 0;
    });

    const handleRenameCycle = (cycleId, newName) => {
        if (!selectedPlan) return;

        const updatedCycles = selectedPlan.cycles.map((cycle) =>
            cycle.id === cycleId ? { ...cycle, name: newName } : cycle
        );

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles });
        markDirty();
    };

    const handleUpdateCycleGoals = (cycleId, goals) => {
        if (!selectedPlan) return;

        const updatedCycles = selectedPlan.cycles.map((cycle) =>
            cycle.id === cycleId
                ? {
                    ...cycle,
                    goal_calories: toNumberOrNull(goals.goal_calories),
                    goal_protein: toNumberOrNull(goals.goal_protein),
                    goal_carbs: toNumberOrNull(goals.goal_carbs),
                    goal_fats: toNumberOrNull(goals.goal_fats),
                }
                : cycle
        );

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles });
        markDirty();
    };

    const handleRenamePlan = (planId, newName) => {
        if (!selectedPlan || selectedPlan.id !== planId) return;

        const updated = { ...selectedPlan, name: newName };
        applyPlanUpdate(updated);
        markDirty();
    };

    const handleRenameMeal = (mealId, newName) => {
        if (!selectedPlan || !selectedMeal) return;

        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === mealId ? { ...meal, name: newName } : meal
            ),
        }));

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, mealId);
        markDirty();
    };

    const handleReorderMeals = (fromIndex, toIndex) => {
        if (!selectedPlan || fromIndex === toIndex) return;
        const cycle = selectedPlan.cycles[selectedCycleIndex];
        if (!cycle) return;

        const meals = [...cycle.meals];
        const [moved] = meals.splice(fromIndex, 1);
        meals.splice(toIndex, 0, moved);

        const updatedCycles = selectedPlan.cycles.map((c, i) =>
            i === selectedCycleIndex ? { ...c, meals: withListOrders(meals, "meal_order") } : c
        );

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, selectedMeal?.id ?? null);
        markDirty();
    };

    const handleReorderCycles = (fromIndex, toIndex) => {
        if (!selectedPlan || fromIndex === toIndex) return;

        const cycles = [...selectedPlan.cycles];
        const [moved] = cycles.splice(fromIndex, 1);
        cycles.splice(toIndex, 0, moved);

        const updatedCycles = withListOrders(cycles, "cycle_order");
        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, selectedMeal?.id ?? null);
        setSelectedCycleIndex(toIndex);
        markDirty();
    };

    const handleReorderFoodItems = (fromIndex, toIndex) => {
        if (!selectedPlan || !selectedMeal || fromIndex === toIndex) return;

        const items = [...selectedMeal.items];
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        const orderedItems = withListOrders(items, "meal_item_order");

        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === selectedMeal.id ? { ...meal, items: orderedItems } : meal
            ),
        }));

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, selectedMeal.id);
        markDirty();
    };

    // ── Alternatives ────────────────────────────────────────────────────────────

    const updateItemAlts = (mealItemId, updater) => {
        if (!selectedMeal || !selectedPlan) return;

        const updatedItems = selectedMeal.items.map((i) =>
            i.id === mealItemId
                ? { ...i, alternatives: withListOrders(updater(i.alternatives ?? []), "alt_order") }
                : i
        );

        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === selectedMeal.id ? { ...meal, items: updatedItems } : meal
            ),
        }));

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, selectedMeal.id);
    };

    const handleAddAlternatives = (mealItemId, foodItemsToAdd) => {
        if (!selectedMeal) return;

        const mainItem = selectedMeal.items.find((i) => i.id === mealItemId);
        if (!mainItem) return;

        const targetCalories = (mainItem.amount / mainItem.serving_size) * mainItem.calories_per_serving;

        const added = foodItemsToAdd.map((foodItem) => ({
            id: makeTempId("alt"),
            meal_item_id: mealItemId,
            food_item_id: foodItem.id,
            amount: Math.round((targetCalories / foodItem.calories_per_serving) * foodItem.serving_size * 10) / 10,
            name: foodItem.name,
            serving_unit: foodItem.serving_unit,
            calories_per_serving: foodItem.calories_per_serving,
            protein_per_serving: foodItem.protein_per_serving,
            carbs_per_serving: foodItem.carbs_per_serving,
            fats_per_serving: foodItem.fats_per_serving,
            serving_size: foodItem.serving_size,
            food_category: foodItem.food_category,
        }));

        updateItemAlts(mealItemId, (alts) => [...alts, ...added]);
        setAlternativeModalOpenForItemId(null);
        setFoodSearchQuery("");
        markDirty();
    };

    const handleDeleteAlternative = (mealItemId, altId) => {
        updateItemAlts(mealItemId, (alts) => alts.filter((a) => a.id !== altId));
        markDirty();
    };

    const handleAlternativeAmountChange = (mealItemId, altId, newAmount) => {
        const parsed = Number(newAmount);
        if (!Number.isFinite(parsed) || parsed <= 0) return;

        updateItemAlts(mealItemId, (alts) =>
            alts.map((a) => (a.id === altId ? { ...a, amount: parsed } : a))
        );
        markDirty();
    };

    const handleUpdateCycleNote = (cycleId, note) => {
        if (!selectedPlan) return;

        const updatedCycles = selectedPlan.cycles.map((cycle) =>
            cycle.id === cycleId ? { ...cycle, note } : cycle
        );

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles });
        markDirty();
    };

    const handleUpdateMealNote = (mealId, note) => {
        if (!selectedPlan) return;

        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: cycle.meals.map((meal) =>
                meal.id === mealId ? { ...meal, note } : meal
            ),
        }));

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, mealId);
        markDirty();
    };

    const handleActivatePlan = (planId) => {
        setPlans((prev) => prev.map((p) => ({ ...p, status: p.id === planId ? "active" : "inactive" })));
        setSelectedPlan((prev) => {
            if (!prev) return prev;
            return { ...prev, status: prev.id === planId ? "active" : "inactive" };
        });
        markDirty();
    };

    const handleSaveDraft = async () => {
        if (!clientId || isSaving || !isDirty) return;

        try {
            setIsSaving(true);
            setSaveStatus("saving");
            const activePlan = plans.find((p) => p.status === "active");

            await api.post("/api/nutrition/plans/save-draft", {
                clientId,
                activePlanId: activePlan?.id ?? null,
                plans,
            });

            setIsDirty(false);
            setSaveStatus("saved");
            if (saveStatusTimeoutRef.current) {
                clearTimeout(saveStatusTimeoutRef.current);
            }
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus("idle");
                saveStatusTimeoutRef.current = null;
            }, 2200);
        } catch (error) {
            console.error("Error saving nutrition draft:", error);
            setSaveStatus("idle");
        } finally {
            setIsSaving(false);
        }
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
        handleActivatePlan,
        handleSaveDraft,
        isDirty,
        isSaving,
        saveStatus,
    };
}
