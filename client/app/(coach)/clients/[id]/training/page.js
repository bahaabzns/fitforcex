
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTrainingPlan } from "@/hooks/useTrainingPlan";
import LeftPanel from "@/app/components/training/LeftPanel";
import MiddlePanel from "@/app/components/training/MiddlePanel";
import RightPanel from "@/app/components/training/RightPanel";

export default function TrainingPage() {
    const { id } = useParams();
    const searchParams = useSearchParams();
    const submissionId = searchParams.get("submissionId") || null;

    const [widths, setWidths] = useState([30, 35, 35]);
    const containerRef = useRef(null);

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
        handleDeletePlan,
        handleDuplicatePlan,
        handleRenamePlan,
        handleUpdatePlanNotes,
        handleCreateDay,
        handleDeleteDay,
        handleDuplicateDay,
        handleRenameDay,
        handleUpdateDayNotes,
        handleAddExercise,
        handleDeleteExercise,
        handleRenameExercise,
        handleUpdateExerciseNotes,
        handleAddSet,
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
        return <div>Loading...</div>;
    }

    return (
        <div className="flex-1 h-full min-h-full flex flex-col overflow-hidden">
            <div ref={containerRef} className="flex-1 h-full flex flex-row overflow-hidden min-h-0">
                <div style={{ width: `${widths[0]}%` }} className="flex flex-col min-h-full overflow-hidden">
                    <LeftPanel
                        plans={sortedPlans}
                        selectedPlan={selectedPlan}
                        handleSelectedPlan={handleSelectedPlan}
                        handleCreatePlan={handleCreatePlan}
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

                <div className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group" onMouseDown={(e) => handleDividerMouseDown(0, e)}>
                    <div className="w-1.5 h-12 bg-blue-200 rounded-full group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
                </div>

                <div style={{ width: `${widths[1]}%` }} className="flex flex-col min-h-full overflow-hidden">
                    {selectedPlan ? (
                        <MiddlePanel
                            selectedPlan={selectedPlan}
                            selectedDayId={selectedDayId}
                            handleSelectDay={handleSelectDay}
                            handleCreateDay={handleCreateDay}
                            handleDeleteDay={handleDeleteDay}
                            handleDuplicateDay={handleDuplicateDay}
                            handleRenamePlan={handleRenamePlan}
                            handleRenameDay={handleRenameDay}
                            handleUpdatePlanNotes={handleUpdatePlanNotes}
                            handleActivatePlan={handleActivatePlan}
                            handleSaveSelectedPlan={handleSaveSelectedPlan}
                            handleDeletePlan={handleDeletePlan}
                            handleDuplicatePlan={handleDuplicatePlan}
                            isSaving={isSaving}
                            saveStatus={saveStatus}
                            dirtyPlanIds={dirtyPlanIds}
                            submissionId={submissionId}
                            focusPlanNameSignal={focusPlanNameSignal}
                            newlyCreatedDayId={newlyCreatedDayId}
                            onClose={handleClosePlan}
                        />
                    ) : (
                        <div className="card w-full flex flex-col overflow-hidden min-h-full">
                            <p className="text-gray-600 text-center flex justify-center items-center h-full">Select a training plan to view details</p>
                        </div>
                    )}
                </div>

                <div className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group" onMouseDown={(e) => handleDividerMouseDown(1, e)}>
                    <div className="w-1.5 h-12 bg-blue-200 rounded-full group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
                </div>

                <div style={{ width: `${widths[2]}%` }} className="flex flex-col min-h-full overflow-hidden">
                    <RightPanel
                        selectedDay={selectedDay}
                        handleAddExercise={handleAddExercise}
                        handleDeleteExercise={handleDeleteExercise}
                        handleRenameExercise={handleRenameExercise}
                        handleUpdateExerciseNotes={handleUpdateExerciseNotes}
                        handleAddSet={handleAddSet}
                        handleDeleteSet={handleDeleteSet}
                        handleUpdateSetField={handleUpdateSetField}
                        handleUpdateDayNotes={handleUpdateDayNotes}
                        onClose={handleCloseDay}
                    />
                </div>
            </div>
        </div>
    );
}
