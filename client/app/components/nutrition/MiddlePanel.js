import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import MacrosBadges from "../MacrosBadges";
import { calcCycle, calcMeal } from "@/lib/nutritionCalc";

export default function MiddlePanel({
    selectedPlan,
    setSelectedPlan,
    selectedCycleIndex,
    setSelectedCycleIndex,
    selectedMeal,
    setSelectedMeal,
    handleDeleteCycle,
    handleCreateCycle,
    handleCreateMeal,
    handleRenamePlan,
    handleRenameCycle,
    handleDeleteMeal,
    handleDuplicateMeal,
    handleDuplicateCycle,
    handleUpdateCycleGoals,
    handleReorderMeals,
    handleReorderCycles,
    handleUpdateCycleNote,
    handleActivatePlan,
    handleSaveSelectedPlan,
    isDirty,
    isSaving,
    saveStatus,
    dirtyPlanIds,
    pendingFocusPlanId, setPendingFocusPlanId,
    pendingFocusCycleId, setPendingFocusCycleId,
    submissionId,
}) {
    const router = useRouter();
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [cycleDragIndex, setCycleDragIndex] = useState(null);
    const [cycleHoverIndex, setCycleHoverIndex] = useState(null);
    const [cyclesCollapsed, setCyclesCollapsed] = useState(false);
    const [notesCollapsed, setNotesCollapsed] = useState(false);
    const [mealsCollapsed, setMealsCollapsed] = useState(false);
    const [activateModal, setActivateModal] = useState(false);
    const [activating, setActivating] = useState(false);

    const planTitleRef = useRef(null);
    const cycleTitleRef = useRef(null);

    useEffect(() => {
        if (pendingFocusPlanId && selectedPlan?.id === pendingFocusPlanId) {
            planTitleRef.current?.focus();
            planTitleRef.current?.select();
            setPendingFocusPlanId(null);
        }
    }, [pendingFocusPlanId, selectedPlan?.id, setPendingFocusPlanId]);

    useEffect(() => {
        if (pendingFocusCycleId && selectedPlan.cycles[selectedCycleIndex]?.id === pendingFocusCycleId) {
            cycleTitleRef.current?.focus();
            cycleTitleRef.current?.select();
            setPendingFocusCycleId(null);
        }
    }, [pendingFocusCycleId, selectedCycleIndex, selectedPlan.cycles, setPendingFocusCycleId]);

    const currentMeals = selectedPlan.cycles[selectedCycleIndex]?.meals ?? [];
    const previewMeals = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return currentMeals;
        const arr = [...currentMeals];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    const previewCycles = (() => {
        if (cycleDragIndex === null || cycleHoverIndex === null || cycleDragIndex === cycleHoverIndex) return selectedPlan.cycles;
        const arr = [...selectedPlan.cycles];
        const [moved] = arr.splice(cycleDragIndex, 1);
        arr.splice(cycleHoverIndex, 0, moved);
        return arr;
    })();
    const isSelectedPlanDirty = dirtyPlanIds?.includes(String(selectedPlan.id));

    async function handleActivateAndMark(navigateToQueue) {
        if (!selectedPlan?.id || !submissionId) return;

        setActivating(true);
        try {
            await handleActivatePlan(selectedPlan.id);
            await api.patch("/api/forms/queue/review", { ids: [submissionId], action: "review" });
            if (navigateToQueue) {
                router.push("/plans-queue");
            }
        } catch {
            // silent - upstream handlers already manage errors
        } finally {
            setActivating(false);
            setActivateModal(false);
        }
    }

    return (
        <>
        <div className="card w-full flex flex-col overflow-hidden min-h-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 gap-4">
                <input
                    ref={planTitleRef}
                    key={selectedPlan.id}
                    type="text"
                    defaultValue={selectedPlan.name}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim() || "Untitled Plan";
                        e.target.value = trimmed;
                        if (trimmed !== selectedPlan.name) {
                            handleRenamePlan(selectedPlan.id, trimmed);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                        if (e.key === 'Escape') {
                            e.target.value = selectedPlan.name;
                            e.target.blur();
                        }
                    }}
                    className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-primary/30 truncate text-foreground"
                />
                {isSelectedPlanDirty && (
                    <button
                        type="button"
                        onClick={() => handleSaveSelectedPlan(selectedPlan.id)}
                        disabled={isSaving}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                            isSaving
                                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                                : "bg-primary hover:bg-primary/90 text-white cursor-pointer"
                        }`}
                    >
                        {isSaving || saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save Plan"}
                    </button>
                )}
                {selectedPlan?.status !== "active" && (
                    <button
                        type="button"
                        onClick={() => {
                            if (submissionId) {
                                setActivateModal(true);
                                return;
                            }
                            handleActivatePlan(selectedPlan.id);
                        }}
                        disabled={isSaving || activating}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                            isSaving || activating
                                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                                : "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer"
                        }`}
                    >
                        {activating ? "Activating..." : "Activate"}
                    </button>
                )}
                {isSelectedPlanDirty && (
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0">
                        Unsaved
                    </span>
                )}
                {!isSelectedPlanDirty && saveStatus === "saved" && (
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                        Saved
                    </span>
                )}
                <button
                    title="Close plan"
                    className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                    onClick={() => setSelectedPlan(null)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            {/* Current Cycle Name + Daily Goal */}
            {selectedPlan.cycles.length > 0 && (() => {
                const cycle = selectedPlan.cycles[selectedCycleIndex];
                const cycleTotals = calcCycle(cycle);
                return (
                    <>
                        <div className="flex items-center mb-3 gap-3 shrink-0">
                            <input
                                ref={cycleTitleRef}
                                key={cycle.id}
                                type="text"
                                defaultValue={cycle.name}
                                onBlur={(e) => {
                                    const trimmed = e.target.value.trim() || "Untitled Cycle";
                                    e.target.value = trimmed;
                                    if (trimmed !== cycle.name) handleRenameCycle(cycle.id, trimmed);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') { e.target.value = cycle.name; e.target.blur(); }
                                }}
                                className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-primary/30 truncate text-foreground"
                            />
                        </div>
                        <div className="rounded-lg bg-card border border-border p-4 mb-3 shrink-0">
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-2xl font-bold text-foreground">{cycleTotals.calories}</span>
                                {cycle.goal_calories
                                    ? <span className="text-sm text-muted-foreground">/ {cycle.goal_calories} kcal</span>
                                    : <span className="text-sm text-muted-foreground">kcal</span>
                                }
                                {cycle.goal_calories && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {Math.round((cycleTotals.calories / cycle.goal_calories) * 100)}%
                                    </span>
                                )}
                            </div>
                            {cycle.goal_calories && (
                                <div className="h-1.5 bg-secondary rounded-full mb-3 overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (cycleTotals.calories / cycle.goal_calories) * 100)}%` }}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: "C", current: cycleTotals.carbs,   target: cycle.goal_carbs },
                                    { label: "P", current: cycleTotals.protein, target: cycle.goal_protein },
                                    { label: "F", current: cycleTotals.fats,    target: cycle.goal_fats },
                                ].map(({ label, current, target }) => (
                                    <div key={label}>
                                        <p className="text-sm text-foreground flex items-baseline gap-0.5">
                                            <span className="text-xs text-muted-foreground mr-0.5">{label}</span>
                                            <span className="font-medium">{current}</span>
                                            <span className="text-xs text-muted-foreground font-normal">
                                                {target ? `/${target}g` : "g"}
                                            </span>
                                        </p>
                                        {target && (
                                            <div className="h-1 bg-secondary rounded-full mt-1.5 overflow-hidden">
                                                <div
                                                    className="h-full bg-muted-foreground rounded-full"
                                                    style={{ width: `${Math.min(100, (current / target) * 100)}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* Cycles Section */}
            <div className="flex flex-col shrink-0">
                {/* Cycles Header */}
                <div className="flex items-center gap-3 mb-3 shrink-0">
                    <button
                        className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        onClick={() => setCyclesCollapsed(p => !p)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points={cyclesCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                        </svg>
                    </button>
                    <h3 className="text-base font-semibold text-foreground flex-1">
                        Cycles
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedPlan.cycles.length}</span>
                        {cyclesCollapsed && selectedPlan.cycles.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">· {selectedPlan.cycles[selectedCycleIndex]?.name}</span>
                        )}
                    </h3>
                    {!cyclesCollapsed && (
                        <button
                            className="cursor-pointer h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors"
                            onClick={handleCreateCycle}
                        >
                            + Cycle
                        </button>
                    )}
                </div>

                {!cyclesCollapsed && selectedPlan.cycles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {previewCycles.map((planCycle) => {
                            const originalIndex = selectedPlan.cycles.findIndex(c => c.id === planCycle.id);
                            const isDragging = cycleDragIndex !== null && selectedPlan.cycles[cycleDragIndex]?.id === planCycle.id;
                            const isActive = planCycle.id === selectedPlan.cycles[selectedCycleIndex]?.id;
                            const canDelete = selectedPlan.cycles.length > 1;
                            return (
                                <div
                                    key={planCycle.id}
                                    draggable
                                    onDragStart={() => setCycleDragIndex(originalIndex)}
                                    onDragOver={(e) => { e.preventDefault(); if (originalIndex !== cycleDragIndex) setCycleHoverIndex(originalIndex); }}
                                    onDrop={() => { handleReorderCycles(cycleDragIndex, cycleHoverIndex); setCycleDragIndex(null); setCycleHoverIndex(null); }}
                                    onDragEnd={() => { setCycleDragIndex(null); setCycleHoverIndex(null); }}
                                    className={`group flex items-center gap-1 rounded-full pl-2.5 pr-1.5 h-9 text-sm font-semibold transition-all cursor-grab select-none ${
                                        isDragging ? "opacity-30 scale-95" : ""
                                    } ${
                                        isActive
                                            ? "bg-primary text-white"
                                            : "bg-card text-muted-foreground border border-border hover:border-border hover:bg-accent"
                                    }`}
                                >
                                    {/* drag grip */}
                                    <svg width="8" height="13" viewBox="0 0 8 13" fill="currentColor" className={`shrink-0 transition-opacity ${isActive ? "opacity-50" : "opacity-25 group-hover:opacity-50"}`}>
                                        <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                        <circle cx="2" cy="6.5" r="1.2"/><circle cx="6" cy="6.5" r="1.2"/>
                                        <circle cx="2" cy="11" r="1.2"/><circle cx="6" cy="11" r="1.2"/>
                                    </svg>

                                    {/* name */}
                                    <span
                                        className="truncate max-w-24 cursor-pointer"
                                        onClick={() => { setSelectedCycleIndex(originalIndex); setSelectedMeal(null); }}
                                    >
                                        {planCycle.name}
                                    </span>

                                    {/* action buttons — visible on hover */}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                                        <button
                                            title="Duplicate cycle"
                                            className={`cursor-pointer p-1 rounded-full transition-colors ${isActive ? "hover:bg-primary/70" : "hover:bg-secondary"}`}
                                            onClick={(e) => { e.stopPropagation(); handleDuplicateCycle(planCycle.id); }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                        </button>
                                        <button
                                            title="Delete cycle"
                                            disabled={!canDelete}
                                            className={`p-1 rounded-full transition-colors ${!canDelete ? "opacity-30 cursor-not-allowed" : `cursor-pointer ${isActive ? "hover:bg-primary/70" : "hover:bg-destructive/10 hover:text-destructive"}`}`}
                                            onClick={(e) => { e.stopPropagation(); if (canDelete) handleDeleteCycle(originalIndex); }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="shrink-0 border-t border-border my-2" />

            {/* Lower block: Meals + Notes */}
            <div className="flex flex-col flex-1 min-h-0">

                {/* Meals Section */}
                <div className="flex flex-col min-h-0" style={{ flex: mealsCollapsed ? '0 0 auto' : '1 1 0' }}>
                    {/* Meals Header */}
                    <div className="flex items-center gap-3 mb-3 shrink-0">
                        <button
                            className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            onClick={() => setMealsCollapsed(m => !m)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points={mealsCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                            </svg>
                        </button>
                        <h3 className="text-base font-semibold text-foreground flex-1">
                            Meals
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedPlan.cycles[selectedCycleIndex].meals.length}</span>
                        </h3>
                        {!mealsCollapsed && (
                            <button
                                className="cursor-pointer h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors"
                                onClick={handleCreateMeal}
                            >
                                + Meal
                            </button>
                        )}
                    </div>

                    {!mealsCollapsed && (
                    <>
                    <div className="flex-1 overflow-y-auto min-h-0 p-1">
                        {selectedPlan.cycles.length === 0 ? (
                            <p className="text-muted-foreground">No meals added yet.</p>
                        ) : (
                            previewMeals.map((meal) => {
                                const originalIndex = currentMeals.findIndex(m => m.id === meal.id);
                                const isDragging = dragIndex !== null && currentMeals[dragIndex]?.id === meal.id;
                                const mealTotals = calcMeal(meal);
                                const isSelected = selectedMeal && selectedMeal.id === meal.id;
                                return (
                                <div
                                    key={meal.id}
                                    draggable
                                    onDragStart={() => setDragIndex(originalIndex)}
                                    onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                    onDrop={() => { handleReorderMeals(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                    onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                    className={`group flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all duration-150 mb-1.5 ${
                                        isDragging ? "opacity-30 scale-95" : ""
                                    } ${
                                        isSelected
                                            ? "bg-primary/10 border-primary/30 shadow-sm"
                                            : "bg-card border-border hover:bg-accent hover:border-primary/30 hover:shadow-sm"
                                    }`}
                                    onClick={() => setSelectedMeal(meal)}
                                >
                                    {/* Drag grip */}
                                    <span
                                        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0 select-none"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                                            <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                            <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                                            <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                                        </svg>
                                    </span>

                                    {/* Meal info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                                            {meal.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            C {mealTotals.carbs}g · P {mealTotals.protein}g · F {mealTotals.fats}g
                                            <span className="ml-2">{meal.items.length} items</span>
                                        </p>
                                    </div>

                                    {/* Calories — primary focus */}
                                    <div className="flex items-baseline gap-0.5 shrink-0">
                                        <span className="text-base font-bold text-foreground">{mealTotals.calories}</span>
                                        <span className="text-xs text-muted-foreground">kcal</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            title="Duplicate meal"
                                            className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                            onClick={(e) => { e.stopPropagation(); handleDuplicateMeal(meal.id); }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                        </button>
                                        <button
                                            title="Delete meal"
                                            className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteMeal(meal.id); }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                        </button>
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                    </>
                    )}
                </div>

                {/* Divider between Meals and Notes */}
                <div className="shrink-0 border-t border-border my-2" />

                {/* Notes Section */}
                <div className="flex flex-col shrink-0">
                    <div className="flex items-center gap-3 mb-3">
                        <button
                            className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            onClick={() => setNotesCollapsed(n => !n)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points={notesCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                            </svg>
                        </button>
                        <h3 className="text-base font-semibold text-foreground">Notes</h3>
                    </div>
                    {!notesCollapsed && selectedPlan.cycles.length > 0 && (() => {
                        const cycle = selectedPlan.cycles[selectedCycleIndex];
                        return (
                            <textarea
                                key={cycle.id + '-note'}
                                defaultValue={cycle.note ?? ""}
                                placeholder="Add a cycle note..."
                                rows={3}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val !== (cycle.note ?? "")) handleUpdateCycleNote(cycle.id, val);
                                }}
                                className="w-full mb-2 px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none resize-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                            />
                        );
                    })()}
                </div>
            </div>
        </div>
        {activateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40" onClick={() => setActivateModal(false)}>
                <div className="bg-card rounded-lg shadow-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-base font-semibold text-foreground mb-2">Activate & Mark as Done</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                        You will activate this nutrition plan for this client and mark the submission as <span className="font-medium text-emerald-600">Action Done</span>. Continue?
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setActivateModal(false)}
                            disabled={activating}
                            className="cursor-pointer px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:bg-accent transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleActivateAndMark(false)}
                            disabled={activating}
                            className="cursor-pointer px-4 py-2 rounded-lg border border-green-300 text-green-700 text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50"
                        >
                            {activating ? "Activating..." : "Activate & Stay Here"}
                        </button>
                        <button
                            onClick={() => handleActivateAndMark(true)}
                            disabled={activating}
                            className="cursor-pointer px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {activating ? "Activating..." : "Activate & Go to Queue"}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
