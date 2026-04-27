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
    handleUpdateCycleNote,
    pendingFocusPlanId, setPendingFocusPlanId,
    pendingFocusCycleId, setPendingFocusCycleId,
}) {
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);

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

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 gap-4">
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
            
            {/* Cycles List + Add/Delete Cycle */}
            <div className="flex flex-col shrink-0">
            {/* Cycles List */}
            <div className="flex flex-col">
                {/* Header + Add Cycle Button */}
                <div className="flex flex-row justify-between items-center gap-4 mb-4">
                    <div  className="flex gap-2 items-center">
                        <h3 className="flex-1 text-lg font-semibold">Cycles</h3>
                        <p className="text-sm text-gray-600 shrink-0">
                            ({selectedPlan.cycles.length} cycles)
                        </p>
                    </div>
                    <button
                            className={`cursor-pointer h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                                "bg-blue-500 text-white border border-gray-200 hover:border-gray-300 hover:bg-blue-600"
                            }`}
                        onClick={() => handleCreateCycle()}
                        >
                            + Create Cycle
                        </button>
                </div>

                {/* Cycles Navigation */}
                <div className="flex flex-col">
                    
                    
                    <div className="flex-1 mb-2">
                        {/* Current Cycle Card */}
                        {selectedPlan.cycles.length > 0 && (() => {
                            const cycle = selectedPlan.cycles[selectedCycleIndex];
                            const cycleTotals = calcCycle(cycle);
                            return (
                                <div className="card px-4 py-4 mb-2 bg-gray-100">
                                    <div className="flex justify-between items-center gap-2 mb-4">
                                        <input
                                            ref={cycleTitleRef}
                                            key={cycle.id}
                                            type="text"
                                            defaultValue={cycle.name}
                                            onBlur={(e) => {
                                                const trimmed = e.target.value.trim() || "Untitled Cycle";
                                                e.target.value = trimmed;
                                                if (trimmed !== cycle.name) {
                                                    handleRenameCycle(cycle.id, trimmed);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') e.target.blur();
                                                if (e.key === 'Escape') {
                                                    e.target.value = cycle.name;
                                                    e.target.blur();
                                                }
                                            }}
                                            className="flex-1 text-md font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none transition-colors hover:border-blue-200 focus:border-blue-500 focus:bg-blue-100 truncate"
                                        />
                                        
                                        <div className="flex justify-end gap-2 shrink-0">
                                            <button
                                                title="Duplicate cycle"
                                                className="cursor-pointer p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0"
                                                onClick={() => handleDuplicateCycle(cycle.id)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                            </button>

                                            <button
                                                title="Delete cycle"
                                                disabled={selectedPlan.cycles.length === 1}
                                                className={`p-2 rounded-lg border transition-colors shrink-0 ${selectedPlan.cycles.length === 1 ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-300" : "cursor-pointer border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-300"}`}
                                                onClick={() => handleDeleteCycle(selectedCycleIndex)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                            </button>
                                        </div>
                                        
                                        
                                    

                                </div>
                                    
                                    <MacrosBadges {...cycleTotals} />
                                    {cycle.goal_calories && (
                                        <div className="flex gap-2 mt-3">
                                            <span className="text-xs text-gray-400">Target:</span>
                                            <span className="text-xs font-semibold text-green-600">{cycle.goal_calories} kcal</span>
                                            <span className="text-xs text-gray-400">P:{cycle.goal_protein}g</span>
                                            <span className="text-xs text-gray-400">C:{cycle.goal_carbs}g</span>
                                            <span className="text-xs text-gray-400">F:{cycle.goal_fats}g</span>
                                        </div>
                                    )}
                                    <textarea
                                        key={cycle.id + '-note'}
                                        defaultValue={cycle.note ?? ""}
                                        placeholder="Add a cycle note..."
                                        rows={2}
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val !== (cycle.note ?? "")) {
                                                handleUpdateCycleNote(cycle.id, val);
                                            }
                                        }}
                                        className="w-full mt-3 p-2 text-sm text-gray-600 bg-white border border-transparent rounded-md outline-none resize-none hover:border-blue-200 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                                    />
                                    
                                </div>
                            );
                        })()}
                    </div>
                    {selectedPlan.cycles.length > 1 && (
                    <div className="flex flex-col gap-3 items-center rounded mb-4">
                    
                        <div className="flex flex-wrap gap-2">
                            {selectedPlan.cycles.map((planCycle, index) => (
                                <button
                                    key={planCycle.id}
                                    className={`cursor-pointer h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                                        index === selectedCycleIndex
                                            ? "bg-blue-500 text-white"
                                            : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                    }`}
                                    onClick={() => { setSelectedCycleIndex(index); setSelectedMeal(null); }}
                                    aria-label={`Select cycle ${index + 1}`}
                                >
                                    {index + 1}
                                </button>
                                
                            ))}
                        
                        </div>
                    </div>
                    )}
                    
                </div>
            </div>

            <div>
            </div>
            </div>

            {/* Meals List */}
            <div className="flex flex-col flex-1 min-h-0">
                        <div className="flex gap-4 justify-start items-center mb-4 shrink-0">
                            <div  className="flex-1 flex gap-2 items-center">
                                <h3 className="text-lg font-semibold">
                                    Meals
                                </h3>
                                <p className="text-sm text-gray-600 shrink-0">
                                    ({selectedPlan.cycles[selectedCycleIndex].meals.length} meals)
                                </p>

                            </div>
                            <button
                                className={`cursor-pointer h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                                "bg-blue-500 text-white border border-gray-200 hover:border-gray-300 hover:bg-blue-600"
                                }`}
                                onClick={() => handleCreateMeal()}
                            >
                                + Create Meal
                            </button>
                        </div>
                        



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
            </div>
        </div>
    )
}