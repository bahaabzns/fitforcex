import NameModal from "../NameModal";
import MacrosBadges from "../MacrosBadges";
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
}) {    
    return (
        <div className="card w-1/3 flex flex-col overflow-hidden min-h-0">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{selectedPlan.name}</h2>
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
                                    <div className="flex flex-row mb-4 items-center">
                                        <h4 className="flex-1 inline-block text-md font-semibold">{cycle.name}</h4>
                                        <p className="inline-block ml-2 text-sm text-gray-600">{cycle.meals.length} meals</p>
                                    </div>
                                    <MacrosBadges {...cycleTotals} />

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

            {/* Meals List */}
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
                    selectedPlan.cycles[selectedCycleIndex].meals.map(
                        (meal, index) => (
                        
                        <div
                            key={index}
                            className={`card px-6 py-4 mb-2 cursor-pointer ${selectedMeal && selectedMeal.id === meal.id ? "bg-gray-200" : "bg-gray-100"}`}
                            onClick={() => setSelectedMeal(meal)}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-md font-semibold">{meal.name}</h4>
                                <span className="text-xs text-gray-500">{meal.items.length} items</span>
                            </div>
                            <MacrosBadges {...calcMeal(meal)} />
                        </div>

                        
                        ),
                    )
                    )}
                </div>
            </div>
        </div>
    )
}