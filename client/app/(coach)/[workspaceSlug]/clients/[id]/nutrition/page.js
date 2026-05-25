"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useNutritionPlan } from "@/hooks/useNutritionPlan";
import { calcMeal, calcCycle, calcItem } from "@/lib/nutritionCalc";
import NameModal from "@/app/components/NameModal";
import LeftPanel from "@/app/components/nutrition/LeftPanel";
import MiddlePanel from "@/app/components/nutrition/MiddlePanel";
import RightPanel from "@/app/components/nutrition/RightPanel";
import FoodItemsModal from "@/app/components/nutrition/FoodItemsModal";
import { Surface } from "@heroui/react";

export default function NutritionPage({ onDirtyChange }) {

    const { id } = useParams();
    const searchParams = useSearchParams();
    const submissionId = searchParams.get("submissionId") || null;

    const [widths, setWidths] = useState([33, 34, 33]);
    const containerRef = useRef(null);

    function handleDividerMouseDown(index, e) {
        e.preventDefault();
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const startX = e.clientX;
        const startWidths = [...widths];

        function onMove(moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            const deltaPct = (deltaX / containerWidth) * 100;
            const newWidths = [...startWidths];
            newWidths[index] = Math.max(15, startWidths[index] + deltaPct);
            newWidths[index + 1] = Math.max(15, startWidths[index + 1] - deltaPct);
            setWidths(newWidths);
        }

        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    const {
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
        isDirty,
        isSaving,
        saveStatus,
        dirtyPlanIds,
        hasDeletedPlans,
    } = useNutritionPlan(id);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (!isDirty) return;
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [isDirty]);

if (loading) {
    return <div>Loading...</div>;
}

return (
    <div className="flex-1 h-full min-h-full flex flex-col overflow-hidden">
        

    <div ref={containerRef} className="flex-1 h-full flex flex-row overflow-hidden min-h-0">

        {/* Panel 1: Plans List */}
        <div style={{ width: `${widths[0]}%` }} className="flex flex-col h-full min-h-0 overflow-hidden">
            <LeftPanel
                plans={sortedPlans}
                selectedPlan={selectedPlan}
                handleCreatePlan={handleCreatePlan}
                handleLoadPlan={handleLoadPlan}
                handleSelectedPlan={handleSelectedPlan}
                handleDeletePlan={handleDeletePlan}
                handleDuplicatePlan={handleDuplicatePlan}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                selectedCycleIndex={selectedCycleIndex}
                handleUpdateCycleGoals={handleUpdateCycleGoals}
                handleActivatePlan={handleActivatePlan}
                handleSaveAllDrafts={handleSaveAllDrafts}
                dirtyPlanIds={dirtyPlanIds}
                hasDeletedPlans={hasDeletedPlans}
                isDirty={isDirty}
                isSaving={isSaving}
                saveStatus={saveStatus}
                clientId={id}
                submissionId={submissionId}
            />
        </div>

        {/* Divider 1 */}
        <div
                className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                onMouseDown={(e) => handleDividerMouseDown(0, e)}
            >
                <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
            </div>

        {/* Panel 2: Plan Detail */}
        <div style={{ width: `${widths[1]}%` }} className="flex flex-col h-full min-h-0 overflow-hidden">
            {selectedPlan ? (
                <MiddlePanel
                    selectedPlan={selectedPlan}
                    handleSelectedPlan={handleSelectedPlan}
                    setSelectedPlan={setSelectedPlan}
                    selectedCycleIndex={selectedCycleIndex}
                    setSelectedCycleIndex={setSelectedCycleIndex}
                    selectedMeal={selectedMeal}
                    setSelectedMeal={setSelectedMeal}
                    handleDeleteCycle={handleDeleteCycle}
                    handleCreateCycle={handleCreateCycle}
                    handleCreateMeal={handleCreateMeal}
                    handleRenamePlan={handleRenamePlan}
                    handleRenameCycle={handleRenameCycle}
                    handleUpdateCycleGoals={handleUpdateCycleGoals}
                    handleDeleteMeal={handleDeleteMeal}
                    handleDuplicateMeal={handleDuplicateMeal}
                    handleDuplicateCycle={handleDuplicateCycle}
                    handleReorderMeals={handleReorderMeals}
                    handleReorderCycles={handleReorderCycles}
                    handleUpdateCycleNote={handleUpdateCycleNote}
                    handleActivatePlan={handleActivatePlan}
                    handleSaveSelectedPlan={handleSaveSelectedPlan}
                    isDirty={isDirty}
                    isSaving={isSaving}
                    saveStatus={saveStatus}
                    dirtyPlanIds={dirtyPlanIds}
                    pendingFocusPlanId={pendingFocusPlanId}
                    setPendingFocusPlanId={setPendingFocusPlanId}
                    pendingFocusCycleId={pendingFocusCycleId}
                    setPendingFocusCycleId={setPendingFocusCycleId}
                    submissionId={submissionId}
                />
            ) : (
                <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface">
                    <p className="text-muted-foreground text-sm text-center flex justify-center items-center h-full">
                        Select a plan to view details
                    </p>
                </Surface>
            )}
        </div>

        {/* Divider 2 */}
        <div
                className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                onMouseDown={(e) => handleDividerMouseDown(1, e)}
            >
                <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
            </div>

        {/* Panel 3: Meal Detail */}
        <div style={{ width: `${widths[2]}%` }} className="flex flex-col h-full min-h-0 overflow-hidden">
            {selectedMeal && selectedPlan ? (
                <RightPanel
                    selectedMeal={selectedMeal}
                    setSelectedMeal={setSelectedMeal}
                    foodItems={foodItems}
                    setFoodItems={setFoodItems}
                    foodItemModalOpen={foodItemModalOpen}
                    setFoodItemModalOpen={setFoodItemModalOpen}
                    foodSearchQuery={foodSearchQuery}
                    setFoodSearchQuery={setFoodSearchQuery}
                    handleFoodSearch={handleFoodSearch}
                    handleAddFoodItem={handleAddFoodItem}
                    handleAmountChange={handleAmountChange}
                    handleDeleteMealItem={handleDeleteMealItem}
                    handleRenameMeal={handleRenameMeal}
                    handleReorderFoodItems={handleReorderFoodItems}
                    handleUpdateMealNote={handleUpdateMealNote}
                    pendingFocusMealId={pendingFocusMealId}
                    setPendingFocusMealId={setPendingFocusMealId}
                    alternativeModalOpenForItemId={alternativeModalOpenForItemId}
                    setAlternativeModalOpenForItemId={setAlternativeModalOpenForItemId}
                    handleDeleteAlternative={handleDeleteAlternative}
                    handleAlternativeAmountChange={handleAlternativeAmountChange}
                />
            ) : (
                <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface">
                    <p className="text-muted-foreground text-sm text-center flex justify-center items-center h-full">
                        Select a meal to view details
                    </p>
                </Surface>
            )}
        </div>

        {/* Food Search Modal */}
        <FoodItemsModal
                open={foodItemModalOpen}
                foodItems={foodItems}
                foodSearchQuery={foodSearchQuery}
                onSearchChange={setFoodSearchQuery}
                onClose={() => setFoodItemModalOpen(false)}
                onAddItems={(items) => handleAddMultipleFoodItems(selectedMeal.id, items)}
        />

        {/* Alternatives Modal */}
        <FoodItemsModal
                open={!!alternativeModalOpenForItemId}
                foodItems={foodItems}
                foodSearchQuery={foodSearchQuery}
                onSearchChange={setFoodSearchQuery}
                onClose={() => { setAlternativeModalOpenForItemId(null); setFoodSearchQuery(""); }}
                onAddItems={(items) => handleAddAlternatives(alternativeModalOpenForItemId, items)}
                lockedCategory={selectedMeal?.items.find(i => i.id === alternativeModalOpenForItemId)?.food_category}
                excludedFoodItemIds={(() => {
                    const mainItem = selectedMeal?.items.find(i => i.id === alternativeModalOpenForItemId);
                    if (!mainItem) return new Set();
                    const ids = new Set((mainItem.alternatives ?? []).map(a => a.food_item_id));
                    if (mainItem.food_item_id) ids.add(mainItem.food_item_id);
                    return ids;
                })()}
        />
    </div>
    </div>
);
}
