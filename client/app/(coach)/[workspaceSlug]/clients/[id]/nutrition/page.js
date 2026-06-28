"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { useNutritionPlan } from "@/hooks/useNutritionPlan";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { calcMeal, calcCycle, calcItem } from "@/lib/nutritionCalc";
import NameModal from "@/app/components/NameModal";
import LeftPanel from "@/app/components/nutrition/LeftPanel";
import MiddlePanel from "@/app/components/nutrition/MiddlePanel";
import RightPanel from "@/app/components/nutrition/RightPanel";
import FoodItemsModal from "@/app/components/nutrition/FoodItemsModal";
import { Button } from "@heroui/react/button";
import { Surface } from "@heroui/react";

export default function NutritionPage({ onDirtyChange, onHeaderActionsChange }) {
    const t = useTranslations('nutrition');
    const tCommon = useTranslations('common');
    const router = useRouter();

    const { id } = useParams();
    const searchParams = useSearchParams();
    const submissionId = searchParams.get("submissionId") || null;

    const [widths, setWidths] = useState([33, 34, 33]);
    const containerRef = useRef(null);
    const [activating, setActivating] = useState(false);
    const [activateModal, setActivateModal] = useState(false);
    // Below this width three side-by-side columns get cramped, so the deepest
    // panel (meal detail) switches to an overlay drawer. Wide layout unchanged.
    const isNarrow = useMediaQuery("(max-width: 1279px)");

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

    const isSelectedPlanDirty = selectedPlan ? dirtyPlanIds?.includes(String(selectedPlan.id)) : false;
    const showSaveAll = (dirtyPlanIds?.length ?? 0) > 1 || hasDeletedPlans;

    // Stable ref so onClick handlers inside the effect always call the latest version.
    const actionsRef = useRef({});
    actionsRef.current = { handleSaveAllDrafts, handleSaveSelectedPlan, handleActivatePlan, selectedPlanId: selectedPlan?.id, submissionId, setActivateModal };

    async function handleActivateAndMark(navigateToQueue) {
        if (!selectedPlan?.id || !submissionId) return;
        setActivating(true);
        try {
            await handleActivatePlan(selectedPlan.id);
            await api.patch("/api/forms/queue/review", { ids: [submissionId], action: "review" });
            if (navigateToQueue) router.push("/plans-queue");
        } catch {} finally {
            setActivating(false);
            setActivateModal(false);
        }
    }

    useEffect(() => {
        if (!onHeaderActionsChange) return;
        const savePlanVisible = isSelectedPlanDirty;
        const activateVisible = selectedPlan && selectedPlan.status !== "active";
        if (!showSaveAll && !savePlanVisible && !activateVisible) {
            onHeaderActionsChange(null);
            return;
        }
        onHeaderActionsChange(
            <div className="flex items-center gap-2">
                {showSaveAll && (
                    <Button variant="outline" isDisabled={!isDirty || isSaving}
                        onClick={() => actionsRef.current.handleSaveAllDrafts()}>
                        {isSaving || saveStatus === "saving" ? t('saving') : saveStatus === "saved" ? t('saved') : t('saveAll')}
                    </Button>
                )}
                {savePlanVisible && (
                    <Button variant="primary" isDisabled={isSaving}
                        onClick={() => actionsRef.current.handleSaveSelectedPlan(actionsRef.current.selectedPlanId)}>
                        {isSaving || saveStatus === "saving" ? t('saving') : t('savePlan')}
                    </Button>
                )}
                {activateVisible && (
                    <Button
                        isDisabled={isSaving || activating}
                        onClick={() => {
                            if (actionsRef.current.submissionId) { actionsRef.current.setActivateModal(true); return; }
                            actionsRef.current.handleActivatePlan(actionsRef.current.selectedPlanId);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                        {activating ? t('activating') : t('activate')}
                    </Button>
                )}
            </div>
        );
    }, [selectedPlan?.id, selectedPlan?.status, showSaveAll, isSelectedPlanDirty, isDirty, isSaving, saveStatus, activating, submissionId, onHeaderActionsChange, t]);

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
    return <div>{tCommon('loading')}</div>;
}

// Rendered either as the third column (wide) or inside the overlay drawer
// (narrow). Defined once so the prop list isn't duplicated across branches.
const mealPanel = (
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
);

return (
    <div className="flex-1 h-full min-h-full flex flex-col overflow-hidden">


    <div ref={containerRef} className={`flex-1 h-full flex flex-row overflow-hidden min-h-0 ${isNarrow ? "gap-2" : ""}`}>

        {/* Panel 1: Plans List */}
        <div style={isNarrow ? undefined : { width: `${widths[0]}%` }} className={`flex flex-col h-full min-h-0 overflow-hidden ${isNarrow ? "w-[34%] shrink-0" : ""}`}>
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
                handleSaveAllDrafts={handleSaveAllDrafts}
                dirtyPlanIds={dirtyPlanIds}
                hasDeletedPlans={hasDeletedPlans}
                isDirty={isDirty}
                isSaving={isSaving}
                saveStatus={saveStatus}
                clientId={id}
            />
        </div>

        {/* Divider 1 (wide only) */}
        {!isNarrow && (
        <div
                className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                onMouseDown={(e) => handleDividerMouseDown(0, e)}
            >
                <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
            </div>
        )}

        {/* Panel 2: Plan Detail */}
        <div style={isNarrow ? undefined : { width: `${widths[1]}%` }} className={`flex flex-col h-full min-h-0 overflow-hidden ${isNarrow ? "flex-1" : ""}`}>
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
                    dirtyPlanIds={dirtyPlanIds}
                    saveStatus={saveStatus}
                    pendingFocusPlanId={pendingFocusPlanId}
                    setPendingFocusPlanId={setPendingFocusPlanId}
                    pendingFocusCycleId={pendingFocusCycleId}
                    setPendingFocusCycleId={setPendingFocusCycleId}
                    activateModal={activateModal}
                    setActivateModal={setActivateModal}
                    activating={activating}
                    handleActivateAndMark={handleActivateAndMark}
                />
            ) : (
                <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-2xl shadow-surface">
                    <p className="text-muted-foreground text-sm text-center flex justify-center items-center h-full">
                        {t('selectPlanHint')}
                    </p>
                </Surface>
            )}
        </div>

        {/* Divider 2 + Panel 3: Meal Detail (wide only) */}
        {!isNarrow && (
        <>
        <div
                className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                onMouseDown={(e) => handleDividerMouseDown(1, e)}
            >
                <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
            </div>

        <div style={{ width: `${widths[2]}%` }} className="flex flex-col h-full min-h-0 overflow-hidden">
            {selectedMeal && selectedPlan ? mealPanel : (
                <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-2xl shadow-surface">
                    <p className="text-muted-foreground text-sm text-center flex justify-center items-center h-full">
                        {t('selectMealHint')}
                    </p>
                </Surface>
            )}
        </div>
        </>
        )}

        {/* Narrow: meal detail as an overlay drawer */}
        {isNarrow && selectedMeal && selectedPlan && (
            <div className="fixed inset-0 z-50 flex justify-end">
                <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedMeal(null)} />
                <div className="relative h-full w-full max-w-md p-2 flex flex-col">
                    {mealPanel}
                </div>
            </div>
        )}

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
