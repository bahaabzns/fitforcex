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

function normalizeServerDate(dateValue) {
    // The API now always returns UTC ISO-8601 strings (enforced by toClientIso on the server).
    // We just pass through whatever the server sends; no timezone guessing needed.
    if (dateValue instanceof Date) {
        return Number.isNaN(dateValue.getTime()) ? null : dateValue.toISOString();
    }
    if (!dateValue) return null;
    return String(dateValue);
}

function hydratePlan(plan) {
    const cycles = (plan.cycles ?? []).map((cycle, cycleIndex) => {
        const meals = (cycle.meals ?? []).map((meal, mealIndex) => {
            const mealItems = (meal.items ?? []).map((item, itemIndex) => {
                const targetCalories = item.serving_size && item.calories_per_serving
                    ? (Number(item.amount) / Number(item.serving_size)) * Number(item.calories_per_serving)
                    : null;
                const alternatives = withListOrders(
                    (item.alternatives ?? []).map((alt) => {
                        if (alt.calculated_amount != null) return alt;
                        if (targetCalories != null && alt.calories_per_serving && alt.serving_size) {
                            const calculatedAmount = Math.round(
                                (targetCalories / Number(alt.calories_per_serving)) * Number(alt.serving_size) * 10
                            ) / 10;
                            return { ...alt, calculated_amount: calculatedAmount };
                        }
                        return alt;
                    }),
                    "alt_order"
                );
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
        created_at: normalizeServerDate(plan.created_at),
        updated_at: normalizeServerDate(plan.updated_at),
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
    const [dirtyPlanIds, setDirtyPlanIds] = useState(() => new Set());
    const [hasDeletedPlans, setHasDeletedPlans] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState("idle");
    const saveStatusTimeoutRef = useRef(null);
    const isDirty = dirtyPlanIds.size > 0 || hasDeletedPlans;


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

    const markPlanDirty = useCallback((planId) => {
        if (!planId) return;
        setDirtyPlanIds((prev) => {
            const next = new Set(prev);
            next.add(String(planId));
            return next;
        });
        setSaveStatus("idle");
    }, []);

    const clearPlanDirty = useCallback((planId) => {
        if (!planId) return;
        setDirtyPlanIds((prev) => {
            const next = new Set(prev);
            next.delete(String(planId));
            return next;
        });
    }, []);

    const fetchClientPlans = useCallback(async (preserveContext = null, { silent = false } = {}) => {
        if (!clientId) {
            setPlans([]);
            setSelectedPlan(null);
            setSelectedMeal(null);
            setLoading(false);
            return;
        }

        try {
            if (!silent) setLoading(true);
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
                const preferredPlanId = preserveContext?.planId ?? prev?.id;
                const preferredPlanName = preserveContext?.planName ?? prev?.name;
                if (!preferredPlanId && !preferredPlanName) return null;

                const byId = detailedPlans.find((p) => String(p.id) === String(preferredPlanId));
                if (byId) return byId;

                return detailedPlans.find((p) => p.name === preferredPlanName) ?? null;
            });

            setSelectedCycleIndex((prevCycleIndex) => {
                const preferredIndex = preserveContext?.selectedCycleIndex;
                return Number.isInteger(preferredIndex) ? Math.max(0, preferredIndex) : prevCycleIndex;
            });

            setSelectedMeal((prevMeal) => {
                const preferredMealId = preserveContext?.mealId ?? prevMeal?.id;
                const preferredMealName = preserveContext?.mealName ?? prevMeal?.name;
                const flatMeals = detailedPlans.flatMap((p) => p.cycles.flatMap((c) => c.meals));

                if (preferredMealId) {
                    const byId = flatMeals.find((m) => String(m.id) === String(preferredMealId));
                    if (byId) return byId;
                }

                if (preferredMealName) {
                    return flatMeals.find((m) => m.name === preferredMealName) ?? null;
                }

                return null;
            });
            setDirtyPlanIds(new Set());
            setHasDeletedPlans(false);
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

    const handleLoadPlan = async (sourcePlanId) => {
        try {
            const { data } = await api.get(`/api/nutrition/plans/${sourcePlanId}`);
            const now = new Date().toISOString();
            const loaded = hydratePlan({
                ...data,
                id: makeTempId("plan"),
                name: data.name,
                client_id: clientId,
                status: "inactive",
                created_at: now,
                updated_at: now,
                created_by: null,
                cycles: (data.cycles ?? []).map((cycle) => ({
                    ...cycle,
                    id: makeTempId("cycle"),
                    meals: (cycle.meals ?? []).map((meal) => ({
                        ...meal,
                        id: makeTempId("meal"),
                        items: (meal.items ?? []).map((item) => ({
                            ...item,
                            id: makeTempId("item"),
                            alternatives: (item.alternatives ?? []).map((alt) => ({
                                ...alt,
                                id: makeTempId("alt"),
                            })),
                        })),
                    })),
                })),
            });
            setPlans((prev) => [loaded, ...prev]);
            setSelectedPlan(loaded);
            setSelectedCycleIndex(0);
            setSelectedMeal(null);
            setPendingFocusPlanId(loaded.id);
            markPlanDirty(loaded.id);
            return true;
        } catch (error) {
            console.error("Error loading nutrition plan:", error);
            return false;
        }
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
        markPlanDirty(newPlan.id);
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
        markPlanDirty(selectedPlan.id);
    };

    const handleDeleteMeal = (mealId) => {
        if (!selectedPlan) return;
        const updatedCycles = selectedPlan.cycles.map((cycle) => ({
            ...cycle,
            meals: withListOrders(cycle.meals.filter((meal) => meal.id !== mealId), "meal_order"),
        }));
        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles });
        if (selectedMeal && selectedMeal.id === mealId) setSelectedMeal(null);
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
    };

    const handleDuplicateCycle = (cycleId) => {
        if (!selectedPlan) return;
        const original = selectedPlan.cycles.find((c) => c.id === cycleId);
        if (!original) return;

        const duplicated = cloneWithNewIdsForCycle(original);
        const nextCycles = withListOrders([...(selectedPlan.cycles ?? []), duplicated], "cycle_order");
        applyPlanUpdate({ ...selectedPlan, cycles: nextCycles });
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
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
            name: foodItem.name_en || foodItem.name_ar || foodItem.name,
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
        markPlanDirty(selectedPlan.id);
    };

    const handleAddMultipleFoodItems = (mealId, items) => {
        if (!selectedPlan || !selectedMeal) return;

        const toAdd = items.map((foodItem) => ({
            id: makeTempId("item"),
            food_item_id: foodItem.id,
            amount: foodItem.serving_size,
            serving_unit: foodItem.serving_unit,
            name: foodItem.name_en || foodItem.name_ar || foodItem.name,
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
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
    };

    const handleDeletePlan = (planId) => {
        const remaining = plans.filter((p) => p.id !== planId);
        setPlans(remaining);

        if (selectedPlan && selectedPlan.id === planId) {
            setSelectedPlan(null);
            setSelectedMeal(null);
            setSelectedCycleIndex(0);
        }

        setDirtyPlanIds((prev) => {
            const next = new Set(prev);
            next.delete(String(planId));
            return next;
        });
        setHasDeletedPlans(true);
        setSaveStatus("idle");
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
        markPlanDirty(duplicatedPlan.id);
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
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
    };

    const handleRenamePlan = (planId, newName) => {
        if (!selectedPlan || selectedPlan.id !== planId) return;

        const updated = { ...selectedPlan, name: newName };
        applyPlanUpdate(updated);
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
    };

    const handleReorderCycles = (fromIndex, toIndex) => {
        if (!selectedPlan || fromIndex === toIndex) return;

        const cycles = [...selectedPlan.cycles];
        const [moved] = cycles.splice(fromIndex, 1);
        cycles.splice(toIndex, 0, moved);

        const updatedCycles = withListOrders(cycles, "cycle_order");
        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles }, selectedMeal?.id ?? null);
        setSelectedCycleIndex(toIndex);
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
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

        const added = foodItemsToAdd.map((foodItem) => {
            const calculatedAmount = Math.round((targetCalories / foodItem.calories_per_serving) * foodItem.serving_size * 10) / 10;
            return {
            id: makeTempId("alt"),
            meal_item_id: mealItemId,
            food_item_id: foodItem.id,
            amount: calculatedAmount,
            calculated_amount: calculatedAmount,
            name: foodItem.name_en || foodItem.name_ar,
            serving_unit: foodItem.serving_unit,
            calories_per_serving: foodItem.calories_per_serving,
            protein_per_serving: foodItem.protein_per_serving,
            carbs_per_serving: foodItem.carbs_per_serving,
            fats_per_serving: foodItem.fats_per_serving,
            serving_size: foodItem.serving_size,
            food_category: foodItem.food_category,
            };
        });

        updateItemAlts(mealItemId, (alts) => [...alts, ...added]);
        setAlternativeModalOpenForItemId(null);
        setFoodSearchQuery("");
        markPlanDirty(selectedPlan?.id);
    };

    const handleDeleteAlternative = (mealItemId, altId) => {
        updateItemAlts(mealItemId, (alts) => alts.filter((a) => a.id !== altId));
        markPlanDirty(selectedPlan?.id);
    };

    const handleAlternativeAmountChange = (mealItemId, altId, newAmount) => {
        const parsed = Number(newAmount);
        if (!Number.isFinite(parsed) || parsed <= 0) return;

        updateItemAlts(mealItemId, (alts) =>
            alts.map((a) => (a.id === altId ? { ...a, amount: parsed } : a))
        );
        markPlanDirty(selectedPlan?.id);
    };

    const handleUpdateCycleNote = (cycleId, note) => {
        if (!selectedPlan) return;

        const updatedCycles = selectedPlan.cycles.map((cycle) =>
            cycle.id === cycleId ? { ...cycle, note } : cycle
        );

        applyPlanUpdate({ ...selectedPlan, cycles: updatedCycles });
        markPlanDirty(selectedPlan.id);
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
        markPlanDirty(selectedPlan.id);
    };

    // Package Lifecycle Phase 3b: `activationOptions` ({ cycleDays, checkInForms })
    // comes from the Configure Activation modal, pre-filled from the client's
    // package and editable by the coach before this call fires.
    const handleActivatePlan = async (planId, activationOptions = {}) => {
        if (!planId || isSaving) return;

        let resolvedPlanId = planId;
        const needsSaveBeforeActivate = dirtyPlanIds.has(String(planId)) || String(planId).startsWith("tmp-");

        if (needsSaveBeforeActivate) {
            const saveResult = await handleSaveSelectedPlan(planId);
            if (!saveResult?.success) return;
            resolvedPlanId = saveResult.newPlanId ?? planId;
        }

        const previousStatuses = plans.map((p) => ({ id: p.id, status: p.status }));

        // Optimistic UI update for immediate feedback.
        setPlans((prev) => prev.map((p) => ({ ...p, status: p.id === resolvedPlanId ? "active" : "inactive" })));
        setSelectedPlan((prev) => {
            if (!prev) return prev;
            return { ...prev, status: prev.id === resolvedPlanId ? "active" : "inactive" };
        });

        try {
            setIsSaving(true);
            const { data: activatedPlan } = await api.post(`/api/nutrition/plans/${resolvedPlanId}/activate`, {
                cycleDays: activationOptions.cycleDays ?? null,
                checkInForms: activationOptions.checkInForms ?? [],
                reviewOffsetDays: activationOptions.reviewOffsetDays ?? null,
            });

            // Package Lifecycle Phase 3b: merge the resolved activated_at/
            // cycle_days/cycle_end_at back into local state -- the optimistic
            // update above only set status, so without this the builder
            // header's remaining-days stat row never appears until reload.
            setPlans((prev) => prev.map((p) => String(p.id) === String(resolvedPlanId)
                ? { ...p, activated_at: activatedPlan.activated_at, cycle_days: activatedPlan.cycle_days, cycle_end_at: activatedPlan.cycle_end_at }
                : p));
            setSelectedPlan((prev) => (prev && String(prev.id) === String(resolvedPlanId))
                ? { ...prev, activated_at: activatedPlan.activated_at, cycle_days: activatedPlan.cycle_days, cycle_end_at: activatedPlan.cycle_end_at }
                : prev);
        } catch (error) {
            console.error("Error activating plan:", error);

            // Revert optimistic update on failure.
            setPlans((prev) => prev.map((p) => {
                const original = previousStatuses.find((s) => String(s.id) === String(p.id));
                return original ? { ...p, status: original.status } : p;
            }));
            setSelectedPlan((prev) => {
                if (!prev) return prev;
                const original = previousStatuses.find((s) => String(s.id) === String(prev.id));
                return original ? { ...prev, status: original.status } : prev;
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Package Lifecycle Phase 3b: `durationChoice` ('restart'|'extend') comes
    // from the Continue/Restart prompt, required only when `target` is
    // currently active (§12.5) -- the caller (page component) is responsible
    // for showing that prompt before calling this with a choice.
    const handleSaveSelectedPlan = async (planId = selectedPlan?.id, durationChoice = undefined) => {
        if (!clientId || isSaving || !planId) return { success: false };

        const target = plans.find((p) => String(p.id) === String(planId));
        if (!target) return { success: false };

        if (!dirtyPlanIds.has(String(planId))) return { success: true, newPlanId: planId, unchanged: true };

        try {
            setIsSaving(true);
            setSaveStatus("saving");
            const activePlan = plans.find((p) => p.status === "active");

            const response = await api.post("/api/nutrition/plans/save-plan-draft", {
                clientId,
                activePlanId: activePlan?.id ?? null,
                plan: target,
                ...(target.status === "active" && durationChoice ? { durationChoice } : {}),
            });

            const oldPlanId = response.data?.oldPlanId ?? planId;
            const newPlanId = response.data?.newPlanId ?? planId;
            const savedPlan = response.data?.savedPlan ?? {};
            const nowIso = new Date().toISOString();
            const normalizedSavedUpdatedAt = nowIso;
            const normalizedSavedCreatedAt = normalizeServerDate(savedPlan.created_at);

            setPlans((prev) => prev.map((plan) => {
                if (String(plan.id) === String(oldPlanId)) {
                    return {
                        ...plan,
                        id: newPlanId,
                        status: savedPlan.status ?? plan.status,
                        created_at: normalizedSavedCreatedAt ?? plan.created_at,
                        updated_at: normalizedSavedUpdatedAt,
                        cycle_count: savedPlan.cycle_count ?? plan.cycles?.length ?? plan.cycle_count,
                        // Package Lifecycle Phase 3b: carry forward (extend) or
                        // refreshed (restart) dates -- without this the header
                        // stat row goes stale after every save of an active plan.
                        activated_at: savedPlan.activated_at ?? plan.activated_at,
                        cycle_days: savedPlan.cycle_days ?? plan.cycle_days,
                        cycle_end_at: savedPlan.cycle_end_at ?? plan.cycle_end_at,
                    };
                }

                if ((savedPlan.status ?? target.status) === "active") {
                    return {
                        ...plan,
                        status: String(plan.id) === String(newPlanId) ? "active" : "inactive",
                    };
                }

                return plan;
            }));

            setSelectedPlan((prev) => {
                if (!prev) return prev;
                if (String(prev.id) !== String(oldPlanId)) {
                    if ((savedPlan.status ?? target.status) === "active") {
                        return { ...prev, status: "inactive" };
                    }
                    return prev;
                }

                return {
                    ...prev,
                    id: newPlanId,
                    status: savedPlan.status ?? prev.status,
                    created_at: normalizedSavedCreatedAt ?? prev.created_at,
                    updated_at: normalizedSavedUpdatedAt,
                    cycle_count: savedPlan.cycle_count ?? prev.cycles?.length ?? prev.cycle_count,
                    activated_at: savedPlan.activated_at ?? prev.activated_at,
                    cycle_days: savedPlan.cycle_days ?? prev.cycle_days,
                    cycle_end_at: savedPlan.cycle_end_at ?? prev.cycle_end_at,
                };
            });

            clearPlanDirty(oldPlanId);
            clearPlanDirty(newPlanId);
            setSaveStatus("saved");
            if (saveStatusTimeoutRef.current) {
                clearTimeout(saveStatusTimeoutRef.current);
            }
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus("idle");
                saveStatusTimeoutRef.current = null;
            }, 2200);

            return { success: true, oldPlanId, newPlanId };
        } catch (error) {
            console.error("Error saving nutrition draft:", error);
            setSaveStatus("idle");
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAllDrafts = async () => {
        if (!clientId || isSaving || !isDirty) return;

        try {
            setIsSaving(true);
            setSaveStatus("saving");
            const activePlan = plans.find((p) => p.status === "active");

            const nowIso = new Date().toISOString();
            const stampedPlans = plans.map((p) =>
                dirtyPlanIds.has(String(p.id)) ? { ...p, updated_at: nowIso } : p
            );
            await api.post("/api/nutrition/plans/save-draft", {
                clientId,
                activePlanId: activePlan?.id ?? null,
                plans: stampedPlans,
            });

            await fetchClientPlans({
                planId: selectedPlan?.id,
                planName: selectedPlan?.name,
                selectedCycleIndex,
                mealId: selectedMeal?.id,
                mealName: selectedMeal?.name,
            }, { silent: true });

            setSaveStatus("saved");
            if (saveStatusTimeoutRef.current) {
                clearTimeout(saveStatusTimeoutRef.current);
            }
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus("idle");
                saveStatusTimeoutRef.current = null;
            }, 2200);
        } catch (error) {
            console.error("Error saving all nutrition drafts:", error);
            setSaveStatus("idle");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDraft = handleSaveSelectedPlan;


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
        handleLoadPlan,
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
        handleSaveSelectedPlan,
        handleSaveAllDrafts,
        handleSaveDraft,
        isDirty,
        isSaving,
        saveStatus,
        dirtyPlanIds: Array.from(dirtyPlanIds),
        hasDeletedPlans,
    };
}
