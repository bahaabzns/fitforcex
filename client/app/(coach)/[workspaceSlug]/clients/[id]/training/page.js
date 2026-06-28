
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { useTrainingPlan } from "@/hooks/useTrainingPlan";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import LeftPanel from "@/app/components/training/LeftPanel";
import MiddlePanel from "@/app/components/training/MiddlePanel";
import RightPanel from "@/app/components/training/RightPanel";
import { Button } from "@heroui/react/button";
import { Surface } from "@heroui/react";

export default function TrainingPage({ onDirtyChange, onHeaderActionsChange }) {
    const { id } = useParams();
    const t = useTranslations('training');
    const tCommon = useTranslations('common');
    const router = useRouter();
    const searchParams = useSearchParams();
    const submissionId = searchParams.get("submissionId") || null;

    const [widths, setWidths] = useState([33, 34, 33]);
    const containerRef = useRef(null);
    const [activating, setActivating] = useState(false);
    const [activateModal, setActivateModal] = useState(false);
    // Below this width three side-by-side columns get cramped, so the deepest
    // panel (day detail) switches to an overlay drawer. Wide layout unchanged.
    const isNarrow = useMediaQuery("(max-width: 1279px)");

    function handleDividerMouseDown(index, e) {
        e.preventDefault();
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const startX = e.clientX;
        const startWidths = [...widths];

        function onMove(moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            const deltaPct = (deltaX / containerWidth) * 100;
            const next = [...startWidths];
            next[index] = Math.max(18, startWidths[index] + deltaPct);
            next[index + 1] = Math.max(18, startWidths[index + 1] - deltaPct);
            setWidths(next);
        }

        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    const {
        selectedPlan,
        selectedDay,
        selectedDayId,
        loading,
        sortOrder,
        sortedPlans,
        dirtyPlanIds,
        hasDeletedPlans,
        isDirty,
        isSaving,
        saveStatus,
        setSortOrder,
        handleSelectedPlan,
        handleSelectDay,
        handleCreatePlan,
        handleLoadPlan,
        handleDeletePlan,
        handleDuplicatePlan,
        handleRenamePlan,
        handleUpdatePlanNotes,
        handleCreateDay,
        handleDeleteDay,
        handleDuplicateDay,
        handleRenameDay,
        handleUpdateDayNotes,
        handleReorderDays,
        handleAddExercise,
        handleAddMultipleExercises,
        handleDeleteExercise,
        handleUpdateExerciseNotes,
        handleReorderExercises,
        handleAddSet,
        handleDuplicateSet,
        handleApplySetsToAll,
        handleDeleteSet,
        handleUpdateSetField,
        handleSaveSelectedPlan,
        handleSaveAllDrafts,
        handleActivatePlan,
        handleClosePlan,
        handleCloseDay,
        focusPlanNameSignal,
        newlyCreatedDayId,
    } = useTrainingPlan(id);

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
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    if (loading) {
        return <div>{tCommon('loading')}</div>;
    }

    // Rendered either as the third column (wide) or inside the overlay drawer
    // (narrow). Defined once so the prop list isn't duplicated across branches.
    const dayPanel = (
        <RightPanel
            selectedDay={selectedDay}
            handleAddExercise={handleAddExercise}
            handleAddMultipleExercises={handleAddMultipleExercises}
            handleDeleteExercise={handleDeleteExercise}
            handleUpdateExerciseNotes={handleUpdateExerciseNotes}
            handleReorderExercises={handleReorderExercises}
            handleRenameDay={handleRenameDay}
            handleAddSet={handleAddSet}
            handleDuplicateSet={handleDuplicateSet}
            handleApplySetsToAll={handleApplySetsToAll}
            handleDeleteSet={handleDeleteSet}
            handleUpdateSetField={handleUpdateSetField}
            handleUpdateDayNotes={handleUpdateDayNotes}
            onClose={handleCloseDay}
        />
    );

    return (
        <div className="flex-1 h-full min-h-full flex flex-col overflow-hidden">
            <div ref={containerRef} className={`flex-1 h-full flex flex-row overflow-hidden min-h-0 ${isNarrow ? "gap-2" : ""}`}>
                <div style={isNarrow ? undefined : { width: `${widths[0]}%` }} className={`flex flex-col h-full min-h-0 overflow-hidden ${isNarrow ? "w-[34%] shrink-0" : ""}`}>
                    <LeftPanel
                        plans={sortedPlans}
                        selectedPlan={selectedPlan}
                        handleSelectedPlan={handleSelectedPlan}
                        handleCreatePlan={handleCreatePlan}
                        handleLoadPlan={handleLoadPlan}
                        handleDeletePlan={handleDeletePlan}
                        handleDuplicatePlan={handleDuplicatePlan}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                        handleSaveAllDrafts={handleSaveAllDrafts}
                        dirtyPlanIds={dirtyPlanIds}
                        hasDeletedPlans={hasDeletedPlans}
                        isDirty={isDirty}
                        isSaving={isSaving}
                        saveStatus={saveStatus}
                        clientId={id}
                    />
                </div>

                {!isNarrow && (
                <div className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group" onMouseDown={(e) => handleDividerMouseDown(0, e)}>
                    <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
                </div>
                )}

                <div style={isNarrow ? undefined : { width: `${widths[1]}%` }} className={`flex flex-col h-full min-h-0 overflow-hidden ${isNarrow ? "flex-1" : ""}`}>
                    {selectedPlan ? (
                        <MiddlePanel
                            selectedPlan={selectedPlan}
                            selectedDayId={selectedDayId}
                            handleSelectDay={handleSelectDay}
                            handleCreateDay={handleCreateDay}
                            handleDeleteDay={handleDeleteDay}
                            handleDuplicateDay={handleDuplicateDay}
                            handleReorderDays={handleReorderDays}
                            handleRenamePlan={handleRenamePlan}
                            handleRenameDay={handleRenameDay}
                            handleUpdatePlanNotes={handleUpdatePlanNotes}
                            handleDeletePlan={handleDeletePlan}
                            handleDuplicatePlan={handleDuplicatePlan}
                            dirtyPlanIds={dirtyPlanIds}
                            saveStatus={saveStatus}
                            focusPlanNameSignal={focusPlanNameSignal}
                            newlyCreatedDayId={newlyCreatedDayId}
                            onClose={handleClosePlan}
                            activateModal={activateModal}
                            setActivateModal={setActivateModal}
                            activating={activating}
                            handleActivateAndMark={handleActivateAndMark}
                        />
                    ) : (
                        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-2xl shadow-surface">
                            <p className="text-muted-foreground text-sm text-center flex justify-center items-center h-full">{t('selectPlanHint')}</p>
                        </Surface>
                    )}
                </div>

                {!isNarrow && (
                <>
                <div className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group" onMouseDown={(e) => handleDividerMouseDown(1, e)}>
                    <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
                </div>

                <div style={{ width: `${widths[2]}%` }} className="flex flex-col h-full min-h-0 overflow-hidden">
                    {dayPanel}
                </div>
                </>
                )}

                {/* Narrow: day detail as an overlay drawer */}
                {isNarrow && selectedDay && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <div className="absolute inset-0 bg-black/40" onClick={handleCloseDay} />
                        <div className="relative h-full w-full max-w-md p-2 flex flex-col">
                            {dayPanel}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
