import { useState } from "react";
import NameModal from "../NameModal";
import MacrosBadges from "../MacrosBadges";
import CycleCalculator from "./CycleCalculator";
import { calcCycle, calcMeal } from "@/lib/nutritionCalc";

export default function MiddlePanel({
    selectedPlan,
    setSelectedPlan,
    selectedCycleIndex,
    setSelectedCycleIndex,
    selectedMeal,
    setSelectedMeal,
    cycleNameModalOpen, setCycleNameModalOpen,
    cycleName, setCycleName,
    mealModalOpen, setMealModalOpen,
    mealName, setMealName,
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
}) {
    const [activeTab, setActiveTab] = useState("meals");
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);

    const currentMeals = selectedPlan.cycles[selectedCycleIndex]?.meals ?? [];
    const previewMeals = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return currentMeals;
        const arr = [...currentMeals];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-0">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 gap-4">
                <input
                    key={selectedPlan.id}
                    type="text"
                    defaultValue={selectedPlan.name}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim();
                        if (trimmed && trimmed !== selectedPlan.name) {
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
                className="btn btn-secondary"
                onClick={() => setSelectedPlan(null)}
                >
                Close
                </button>
            </div>
            
            {/* Cycles List + Add/Delete Cycle */}
            <div className="mb-6 flex flex-col shrink-0">
            {/* Cycles List */}
            <div className="mb-6 flex flex-col">
                {/* Header + Add Cycle Button */}
                <div className="flex flex-row justify-start items-center gap-4 mb-4">
                    <h3 className="flex-1 text-lg font-semibold">Cycles</h3>
                    <div className=" flex flex-2 justify-center items-center gap-4">
                        <button
                            className="btn-danger px-4 w-full"
                            onClick={() => handleDeleteCycle(selectedCycleIndex)}
                        >
                            - Delete Cycle
                        </button>
                        <button
                            className="btn btn-secondary px-4 w-full"
                            onClick={() => handleDuplicateCycle(selectedPlan.cycles[selectedCycleIndex].id)}
                        >
                            Duplicate Cycle
                        </button>
                        <button
                            className="btn btn-primary px-4 w-full"
                            onClick={() => setCycleNameModalOpen(true)}
                        >
                            + Create Cycle
                        </button>
                    </div>
                </div>

                {/* Cycles Navigation */}
                <div className="flex flex-col">
                    
                    <div className="flex-1">
                        {/* Current Cycle Card */}
                        {selectedPlan.cycles.length > 0 && (() => {
                            const cycle = selectedPlan.cycles[selectedCycleIndex];
                            const cycleTotals = calcCycle(cycle);
                            return (
                                <div className="card px-6 py-4 bg-gray-100">
                                    <div className="flex flex-row mb-4 items-center gap-2">
                                        <input
                                            key={cycle.id}
                                            type="text"
                                            defaultValue={cycle.name}
                                            onBlur={(e) => {
                                                const trimmed = e.target.value.trim();
                                                if (trimmed && trimmed !== cycle.name) {
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
                                        <p className="inline-block ml-2 text-sm text-gray-600 shrink-0">{cycle.meals.length} meals</p>
                                    </div>
                                    <MacrosBadges {...cycleTotals} />
                                    {cycle.goal_calories && (
                                        <div className="flex gap-2 mt-1 mb-2">
                                            <span className="text-xs text-gray-400">Target:</span>
                                            <span className="text-xs font-semibold text-green-600">{cycle.goal_calories} kcal</span>
                                            <span className="text-xs text-gray-400">P:{cycle.goal_protein}g</span>
                                            <span className="text-xs text-gray-400">C:{cycle.goal_carbs}g</span>
                                            <span className="text-xs text-gray-400">F:{cycle.goal_fats}g</span>
                                        </div>
                                    )}

                                    <div className="flex flex-row gap-2 rounded">

                                        <button
                                            className="flex-1 btn btn-secondary"
                                            onClick={() => setSelectedCycleIndex(i => Math.max(0, i - 1))}
                                            disabled={selectedCycleIndex === 0}>
                                            Back
                                        </button>

                                        <span className="flex-1 font-semibold text-sm text-gray-500 flex justify-center items-center">
                                            Cycle {selectedCycleIndex + 1} of {selectedPlan.cycles.length}
                                        </span>
                                        
                                        <button
                                            className="flex-1 btn btn-secondary"
                                            onClick={() => setSelectedCycleIndex(i => Math.min(selectedPlan.cycles.length - 1, i + 1))}
                                            disabled={selectedCycleIndex === selectedPlan.cycles.length - 1}>
                                            Next
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    
                </div>
            </div>

            <div>
                {cycleNameModalOpen && (
                    <NameModal 
                        title="Enter Cycle Name"
                        value={cycleName}
                        placeholder="Cycle Name"
                        submitText="Create"
                        onChange={setCycleName}
                        onSubmit={() => handleCreateCycle(cycleName)}
                        onClose={() => setCycleNameModalOpen(false)}
                    />
                )}
            </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-2 mb-4 shrink-0">
                <button
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === "meals" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    onClick={() => setActiveTab("meals")}
                >
                    Meals
                </button>
                <button
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === "calculator" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    onClick={() => setActiveTab("calculator")}
                >
                    ⚡ Calculator
                </button>
            </div>

            {/* Calculator Tab */}
            {activeTab === "calculator" && selectedPlan.cycles.length > 0 && (
                <CycleCalculator
                    cycle={selectedPlan.cycles[selectedCycleIndex]}
                    onApply={(goals) => {
                        handleUpdateCycleGoals(selectedPlan.cycles[selectedCycleIndex].id, goals);
                        setActiveTab("meals");
                    }}
                />
            )}

            {/* Meals List */}
            {activeTab === "meals" && (
            <div className="flex flex-col flex-1 min-h-0">
                        <div className="flex gap-4 justify-start items-center mb-4 shrink-0">
                            <h3 className="flex-1 text-lg font-semibold">
                                Meals
                            </h3>
                            <button
                                className="flex-2 btn-primary px-4 w-full"
                                onClick={() => setMealModalOpen(true)}
                            >
                                + Create Meal
                            </button>
                        </div>
                        
                        {mealModalOpen && (
                        <NameModal 
                            title="Enter Meal Name"
                            value={mealName}
                            placeholder="Meal Name"
                            submitText="Create"
                            onChange={setMealName}
                            onSubmit={() => handleCreateMeal(mealName)}
                            onClose={() => setMealModalOpen(false)}
                        />
                        )}
        
        
        
                <div className="flex-1 overflow-y-auto min-h-0">

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
                            className={`card px-6 py-4 mb-2 cursor-pointer transition-all duration-150 ${isDragging ? "opacity-30 scale-95 ring-2 ring-blue-300" : ""} ${selectedMeal && selectedMeal.id === meal.id ? "bg-gray-200" : "bg-gray-100"}`}
                            onClick={() => setSelectedMeal(meal)}
                        >
                            <div className="flex items-center mb-2 gap-2">
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
                                <span className="text-xs text-gray-500 shrink-0">{meal.items.length} items</span>
                            </div>
                            <MacrosBadges {...calcMeal(meal)} />
                            <div className="flex gap-2 mt-3">
                                <button
                                    className="flex-1 btn btn-secondary text-sm py-1"
                                    onClick={(e) => { e.stopPropagation(); handleDuplicateMeal(meal.id); }}
                                >
                                    Duplicate
                                </button>
                                <button
                                    className="btn btn-danger text-sm py-1 px-3"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteMeal(meal.id); }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                        );
                    })
                    )}
                </div>
            </div>
            )}
        </div>
    )
}