"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
import ConfigureActivationModal from "@/app/components/ConfigureActivationModal";
import ContinueOrRestartPrompt from "@/app/components/ContinueOrRestartPrompt";
import { Button } from "@heroui/react/button";
import { Surface } from "@heroui/react";

export default function NutritionPage({ onDirtyChange, onHeaderActionsChange }) {
    const t = useTranslations('nutrition');
    const tCommon = useTranslations('common');
    const router = useRouter();

    const { id, workspaceSlug } = useParams();
    const searchParams = useSearchParams();
    // Captured once at mount, not re-read on every render: this page is kept
    // mounted (client/[id]/layout.js's tab keep-alive) while the coach clicks
    // between tabs, and tab links don't preserve the query string — re-reading
    // searchParams here would silently drop the queue linkage on tab-away/back,
    // even though the in-progress plan-building session survives untouched.
    const [submissionId] = useState(() => searchParams.get("submissionId") || null);

    const [widths, setWidths] = useState([33, 34, 33]);
    const containerRef = useRef(null);
    const [activating, setActivating] = useState(false);
    const [activateModal, setActivateModal] = useState(false);
    // Package Lifecycle Phase 3b: Configure Activation always fires before an
    // activation goes through; the existing submission-linked "Mark as Done"
    // modal (activateModal, above) fires after it, only when a submissionId
    // is present (AD-3 -- two single-responsibility modals, not merged).
    const [configureActivationOpen, setConfigureActivationOpen] = useState(false);
    const [pendingActivationOptions, setPendingActivationOptions] = useState(null);
    // The Continue/Restart prompt fires when saving an edit to an already-
    // active plan (§12.5) -- not dismissible without a choice.
    const [durationChoicePrompt, setDurationChoicePrompt] = useState(false);
    const [savingDurationChoice, setSavingDurationChoice] = useState(false);
    // Post-review refinement: choosing "Restart" no longer saves silently --
    // it opens the same Configure Activation experience used for first
    // activation, pre-filled from the package, so the coach can change
    // duration and/or check-in forms before the restart actually saves.
    const [restartConfigureOpen, setRestartConfigureOpen] = useState(false);
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

    // Observation counts per food item, for the small count chip next to each
    // row's "Observations" action — refetched whenever Food Insights closes
    // (create/edit/delete all funnel through there) rather than tracked
    // incrementally, matching this file's own fetch-and-replace conventions.
    const [observationCounts, setObservationCounts] = useState({});
    const fetchObservationCounts = useCallback(() => {
        if (!id) return;
        api.get(`/api/clients/${id}/observations?relatedType=foodItem`)
            .then(({ data }) => {
                const counts = {};
                for (const o of data ?? []) {
                    for (const ri of o.relatedItems ?? []) counts[ri.id] = (counts[ri.id] ?? 0) + 1;
                }
                setObservationCounts(counts);
            })
            .catch(() => setObservationCounts({}));
    }, [id]);
    useEffect(() => { fetchObservationCounts(); }, [fetchObservationCounts]);

    // Stable ref so onClick handlers inside the effect always call the latest version.
    const actionsRef = useRef({});
    actionsRef.current = {
        handleSaveAllDrafts, handleSaveSelectedPlan, handleActivatePlan,
        selectedPlanId: selectedPlan?.id, selectedPlanStatus: selectedPlan?.status,
        submissionId, setActivateModal, setConfigureActivationOpen, setDurationChoicePrompt,
    };

    async function handleActivateAndMark(navigateToQueue) {
        if (!selectedPlan?.id || !submissionId) return;
        setActivating(true);
        try {
            await handleActivatePlan(selectedPlan.id, pendingActivationOptions ?? {});
            await api.patch("/api/forms/queue/review", { ids: [submissionId], action: "review" });
            if (navigateToQueue) router.push(`/${workspaceSlug}/plans-queue`);
        } catch {} finally {
            setActivating(false);
            setActivateModal(false);
            setPendingActivationOptions(null);
        }
    }

    // Package Lifecycle Phase 3b: Configure Activation confirms first, always.
    // If this activation is closing out a form submission, the existing
    // Mark-as-Done confirmation follows; otherwise activation happens here.
    async function handleConfigureActivationConfirm(options) {
        setConfigureActivationOpen(false);
        if (submissionId) {
            setPendingActivationOptions(options);
            setActivateModal(true);
            return;
        }
        setActivating(true);
        try {
            await handleActivatePlan(selectedPlan.id, options);
        } finally {
            setActivating(false);
        }
    }

    // Package Lifecycle Phase 3b: fires only when saving an edit to a plan
    // that is currently active (§12.5).
    //
    // Post-review refinement: "Continue Remaining Duration" still saves
    // immediately (nothing about duration/check-ins changes). "Restart Plan
    // Duration" no longer saves here -- it hands off to the Configure
    // Activation modal (below) so the coach can set a new duration and/or
    // check-in forms first; that modal's confirm is what actually saves.
    async function handleDurationChoice(choice) {
        if (choice === "restart") {
            setDurationChoicePrompt(false);
            setRestartConfigureOpen(true);
            return;
        }
        setSavingDurationChoice(true);
        try {
            await handleSaveSelectedPlan(selectedPlan?.id, choice);
        } finally {
            setSavingDurationChoice(false);
            setDurationChoicePrompt(false);
        }
    }

    async function handleRestartConfigureConfirm(options) {
        setRestartConfigureOpen(false);
        setSavingDurationChoice(true);
        try {
            await handleSaveSelectedPlan(selectedPlan?.id, "restart", options);
        } finally {
            setSavingDurationChoice(false);
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
                        onClick={() => {
                            // Package Lifecycle §12.5: only prompt when the plan being
                            // saved is currently active -- a draft save is unaffected.
                            if (actionsRef.current.selectedPlanStatus === "active") {
                                actionsRef.current.setDurationChoicePrompt(true);
                                return;
                            }
                            actionsRef.current.handleSaveSelectedPlan(actionsRef.current.selectedPlanId);
                        }}>
                        {isSaving || saveStatus === "saving" ? t('saving') : t('savePlan')}
                    </Button>
                )}
                {activateVisible && (
                    <Button
                        isDisabled={isSaving || activating}
                        onClick={() => actionsRef.current.setConfigureActivationOpen(true)}
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
        clientId={id}
        observationCounts={observationCounts}
        onObservationsChanged={fetchObservationCounts}
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

        {/* Package Lifecycle Phase 3b */}
        <ConfigureActivationModal
            open={configureActivationOpen}
            onClose={() => setConfigureActivationOpen(false)}
            clientId={id}
            planType="nutrition"
            onConfirm={handleConfigureActivationConfirm}
            confirming={activating}
        />
        <ContinueOrRestartPrompt
            open={durationChoicePrompt}
            endDateLabel={selectedPlan?.cycle_days
                ? new Date(Date.now() + selectedPlan.cycle_days * 86400000).toLocaleDateString()
                : null}
            onContinue={() => handleDurationChoice("extend")}
            onRestart={() => handleDurationChoice("restart")}
            submitting={savingDurationChoice}
        />
        {/* Post-review refinement: restart reconfiguration, same modal as first activation */}
        <ConfigureActivationModal
            open={restartConfigureOpen}
            onClose={() => setRestartConfigureOpen(false)}
            clientId={id}
            planType="nutrition"
            onConfirm={handleRestartConfigureConfirm}
            confirming={savingDurationChoice}
            titleKey="restartConfigureTitle"
        />
    </div>
    </div>
);
}
