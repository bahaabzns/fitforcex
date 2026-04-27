import { useState, useRef, useEffect } from "react";
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
    pendingFocusPlanId, setPendingFocusPlanId,
    pendingFocusCycleId, setPendingFocusCycleId,
}) {
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [cycleDragIndex, setCycleDragIndex] = useState(null);
    const [cycleHoverIndex, setCycleHoverIndex] = useState(null);
    const [cyclesCollapsed, setCyclesCollapsed] = useState(false);
    const [notesCollapsed, setNotesCollapsed] = useState(false);
    const [mealsCollapsed, setMealsCollapsed] = useState(false);

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

    return (
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
                    className="flex-1 text-xl font-bold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-blue-200 focus:border-blue-500 focus:bg-blue-100 truncate"
                />
                <button
                    title="Close plan"
                    className="cursor-pointer p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
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
                        <div className="flex items-center mb-2 gap-4 shrink-0">
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
                                className="flex-1 text-xl font-bold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-blue-200 focus:border-blue-500 focus:bg-blue-100 truncate"
                            />
                        </div>
                        <div className="rounded-xl bg-white border border-gray-200 p-3 mb-2 shrink-0">
                            {cycle.goal_calories && (
                                <p className="text-xs text-gray-500 mb-2">Daily Goal</p>
                            )}
                            {cycle.goal_calories && (
                                <div className="h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
                                    <div
                                        className="h-full bg-blue-400 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (cycleTotals.calories / cycle.goal_calories) * 100)}%` }}
                                    />
                                </div>
                            )}
                            <div className="flex items-baseline gap-1 mb-2">
                                <span className="text-2xl font-bold text-gray-800">{cycleTotals.calories}</span>
                                {cycle.goal_calories
                                    ? <span className="text-sm text-gray-400">/{cycle.goal_calories} kcal</span>
                                    : <span className="text-sm text-gray-400">kcal</span>
                                }
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: "C", current: cycleTotals.carbs,   target: cycle.goal_carbs,   color: "text-teal-600",   bar: "bg-teal-400" },
                                    { label: "P", current: cycleTotals.protein, target: cycle.goal_protein, color: "text-red-500",    bar: "bg-red-400" },
                                    { label: "F", current: cycleTotals.fats,    target: cycle.goal_fats,    color: "text-yellow-600", bar: "bg-yellow-400" },
                                ].map(({ label, current, target, color, bar }) => (
                                    <div key={label}>
                                        <p className="text-sm font-semibold text-gray-800 flex items-baseline gap-1">
                                            <span className={`text-xs font-bold ${color}`}>{label}</span>
                                            {current}
                                            <span className="text-xs text-gray-400 font-normal">
                                                {target ? `/${target}g` : "g"}
                                            </span>
                                        </p>
                                        {target && (
                                            <div className="h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${bar}`}
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
                <div
                    className="flex gap-4 justify-start items-center mb-2 shrink-0 cursor-pointer select-none"
                    onClick={() => setCyclesCollapsed(p => !p)}
                >
                    <div className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points={cyclesCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                        </svg>
                    </div>
                    <div className="flex-1 flex gap-2 items-center">
                        <h3 className="text-lg font-semibold text-blue-500">Cycles</h3>
                        <p className="text-sm text-gray-600 shrink-0">({selectedPlan.cycles.length} cycles)</p>
                        {cyclesCollapsed && selectedPlan.cycles.length > 0 && (
                            <span className="text-sm text-gray-400 shrink-0">· {selectedPlan.cycles[selectedCycleIndex]?.name}</span>
                        )}
                    </div>
                    {!cyclesCollapsed && (
                        <button
                            className="cursor-pointer h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors bg-blue-500 text-white border border-gray-200 hover:border-gray-300 hover:bg-blue-600"
                            onClick={(e) => { e.stopPropagation(); handleCreateCycle(); }}
                        >
                            + Create Cycle
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
                                            ? "bg-blue-500 text-white"
                                            : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
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
                                            className={`cursor-pointer p-1 rounded-full transition-colors ${isActive ? "hover:bg-blue-400" : "hover:bg-gray-200"}`}
                                            onClick={(e) => { e.stopPropagation(); handleDuplicateCycle(planCycle.id); }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                        </button>
                                        <button
                                            title="Delete cycle"
                                            disabled={!canDelete}
                                            className={`p-1 rounded-full transition-colors ${!canDelete ? "opacity-30 cursor-not-allowed" : `cursor-pointer ${isActive ? "hover:bg-blue-400" : "hover:bg-red-100 hover:text-red-500"}`}`}
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
            <div className="shrink-0 border-t  border-gray-100 my-2" />

            {/* Lower block: Meals + Notes */}
            <div className="flex flex-col flex-1 min-h-0">

                {/* Meals Section */}
                <div className="flex flex-col min-h-0" style={{ flex: mealsCollapsed ? '0 0 auto' : '1 1 0' }}>
                    {/* Meals Header */}
                    <div
                        className="flex gap-4 justify-start items-center mb-2 shrink-0 cursor-pointer select-none"
                        onClick={() => setMealsCollapsed(m => !m)}
                    >
                        <div className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points={mealsCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                            </svg>
                        </div>
                        <div className="flex-1 flex gap-2 items-center">
                            <h3 className="text-lg font-semibold text-blue-500">Meals</h3>
                            <p className="text-sm text-gray-600 shrink-0">({selectedPlan.cycles[selectedCycleIndex].meals.length} meals)</p>
                        </div>
                        {!mealsCollapsed && (
                            <button
                                className="cursor-pointer h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors bg-blue-500 text-white border border-gray-200 hover:border-gray-300 hover:bg-blue-600"
                                onClick={(e) => { e.stopPropagation(); handleCreateMeal(); }}
                            >
                                + Create Meal
                            </button>
                        )}
                    </div>

                    {!mealsCollapsed && (
                    <>
                    <div className="flex-1 overflow-y-auto min-h-0 p-1">
                        {selectedPlan.cycles.length === 0 ? (
                            <p className="text-gray-600">No meals added yet.</p>
                        ) : (
                            previewMeals.map((meal) => {
                                const originalIndex = currentMeals.findIndex(m => m.id === meal.id);
                                const isDragging = dragIndex !== null && currentMeals[dragIndex]?.id === meal.id;
                                return (
                                <div
                                    key={meal.id}
                                    draggable
                                    onDragStart={() => setDragIndex(originalIndex)}
                                    onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                    onDrop={() => { handleReorderMeals(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                    onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                    className={`card px-6 py-4 mb-2 cursor-pointer transition-all duration-150 group ${isDragging ? "opacity-30 scale-95 ring-2 ring-blue-300" : ""} ${selectedMeal && selectedMeal.id === meal.id ? "bg-blue-50 ring-2 ring-blue-200 shadow-sm" : "bg-gray-100"}`}
                                    onClick={() => setSelectedMeal(meal)}
                                >
                                    <div className="flex items-center justify-center mb-2 gap-2">
                                        <span
                                            className="text-gray-400 hover:text-gray-600 cursor-grab shrink-0 select-none"
                                            title="Drag to reorder"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                                                <circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/>
                                                <circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>
                                                <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
                                            </svg>
                                        </span>
                                        <h4 className="flex-1 text-md font-semibold truncate">{meal.name}</h4>
                                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                            <button
                                                title="Duplicate meal"
                                                className="cursor-pointer p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); handleDuplicateMeal(meal.id); }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                            </button>
                                            <button
                                                title="Delete meal"
                                                className="cursor-pointer p-2 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-300 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteMeal(meal.id); }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                            </button>
                                        </div>
                                        <span className="text-xs text-gray-500 shrink-0">{meal.items.length} items</span>
                                    </div>
                                    <MacrosBadges {...calcMeal(meal)} />
                                </div>
                                );
                            })
                        )}
                    </div>
                    </>
                    )}
                </div>

                {/* Divider between Meals and Notes */}
                <div className="shrink-0 border-t border-gray-100 my-2" />

                {/* Notes Section */}
                <div className="flex flex-col shrink-0">
                    <div
                        className="flex gap-2 items-center mb-2 cursor-pointer select-none"
                        onClick={() => setNotesCollapsed(n => !n)}
                    >
                        <div className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points={notesCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-blue-500">Notes</h3>
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
                                className="w-full mb-2 p-2 text-sm text-gray-600 bg-white border border-transparent rounded-md outline-none resize-none hover:border-blue-200 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                            />
                        );
                    })()}
                </div>
            </div>
        </div>
    )
}