"use client";
import { useParams } from "next/navigation";
import { useNutritionPlan } from "@/hooks/useNutritionPlan";
import { calcMeal, calcCycle, calcItem } from "@/lib/nutritionCalc";

export default function NutritionPage() {

    const { id } = useParams();
    const {
        plans, setPlans,
        selectedPlan, setSelectedPlan,
        selectedCycleIndex, setSelectedCycleIndex,
        selectedMeal, setSelectedMeal,
        planNameModalOpen, setPlanNameModalOpen,
        planName, setPlanName,
        cycleNameModalOpen, setCycleNameModalOpen,
        cycleName, setCycleName,
        mealModalOpen, setMealModalOpen,
        mealName, setMealName,
        foodItems, setFoodItems,
        foodItemModalOpen, setFoodItemModalOpen,
        foodSearchQuery, setFoodSearchQuery,
        loading, setLoading,
        handleSelectedPlan,
        handleCreatePlan,
        handleCreateCycle,
        handleDeleteCycle,
        handleCreateMeal,
        handleAddFoodItem,
        handleAmountChange,
        handleFoodSearch,
    } = useNutritionPlan(id);

if (loading) {
    return <div>Loading...</div>;
}

return (
<div className="flex-1 h-full flex flex-row gap-4 overflow-hidden min-h-0">
{/* Panel 1: Plans List */}
<div className="card w-1/3 flex flex-col overflow-hidden min-h-0">
            <div className="flex flex-row justify-center items-center gap-4 mb-4">
                <h2 className="flex-1 text-xl font-bold">Plans</h2>

                <button
                    className="flex-2 btn-primary px-4 w-full"
                    onClick={() => setPlanNameModalOpen(true)}
                >
                    + Create Plan
                </button>

            </div>
            {planNameModalOpen && (
            <div
                className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
                onClick={() => setPlanNameModalOpen(false)}
            >
                <form
                className="card p-6 w-96 flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
                >
                <h2 className="text-xl font-bold">Enter Plan Name</h2>
                <input
                    type="text"
                    className="input-field"
                    placeholder="Plan Name"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    autoFocus
                />
                <button
                    className="btn-primary px-4 w-full mb-4"
                    onClick={() => handleCreatePlan(planName)}
                >
                    Create
                </button>
                </form>
            </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0">
                {plans.map((plan) => (
                <div
                    key={plan.id}
                    onClick={() => handleSelectedPlan(plan)}
                    className={`card px-6 py-4 mb-2 cursor-pointer bg-gray-100 ${selectedPlan && selectedPlan.id === plan.id ? "bg-gray-200" : ""}`}
                >
                    <span
                    className={`px-2 py-1 rounded ${plan.status === "active" ? "bg-green-500" : "bg-gray-300"}`}
                    >
                    {plan.status}
                    </span>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-sm text-gray-600">
                    Last Edited {new Date(plan.updated_at).toLocaleDateString()}
                    </p>
                </div>
                ))}
            </div>

        </div>

        {/* Panel 2: Plan Detail — يظهر بس لو selectedPlan مش null */}
        {selectedPlan ? (
<div className="card w-1/3 flex flex-col overflow-hidden min-h-0">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{selectedPlan.name}</h2>
                <button
                className="btn btn-secondary"
                onClick={() => setSelectedPlan(null)}
                >
                Close
                </button>
            </div>

            <div className="mb-6 flex flex-col flex-shrink-0">
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
                                    <div className="flex gap-2 mb-4">
                                        <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center">{cycleTotals.calories} kcal</span>
                                        <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center"><span className="font-semibold">P: </span>{cycleTotals.protein} g</span>
                                        <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center"><span className="font-semibold">C: </span>{cycleTotals.carbs} g</span>
                                        <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center"><span className="font-semibold">F: </span>{cycleTotals.fats} g</span>
                                    </div>
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
                <div
                    className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
                    onClick={() => setCycleNameModalOpen(false)}
                >
                    <form
                    className="card p-6 w-96 flex flex-col gap-4"
                    onClick={(e) => e.stopPropagation()}
                    >
                    <h2 className="text-xl font-bold">Enter Cycle Name</h2>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Cycle Name"
                        value={cycleName}
                        onChange={(e) => setCycleName(e.target.value)}
                        autoFocus
                    />
                    <button
                        className="btn-primary px-4"
                        onClick={() => handleCreateCycle(cycleName)}
                    >
                        Create
                    </button>
                    </form>
                </div>
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
                <div
                    className="fixed inset-0 flex items-center justify-center bg-black/30 z-50"
                    onClick={() => setMealModalOpen(false)}
                >
                    <form
                    className="card p-6 w-96 flex flex-col gap-4"
                    onClick={(e) => e.stopPropagation()}
                    >
                    <h2 className="text-xl font-bold">Enter Meal Name</h2>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Meal Name"
                        value={mealName}
                        onChange={(e) => setMealName(e.target.value)}
                        autoFocus
                    />
                    <button
                        className="btn-primary px-4"
                        onClick={() => handleCreateMeal(mealName)}
                    >
                        Create
                    </button>
                    </form>
                </div>
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
                            <div className="flex gap-2">
                                <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center text-xs">{calcMeal(meal).calories} kcal</span>
                                <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center text-xs"><span className="font-semibold">P:</span> {calcMeal(meal).protein} g</span>
                                <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center text-xs"><span className="font-semibold">C:</span> {calcMeal(meal).carbs} g</span>
                                <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center text-xs"><span className="font-semibold">F:</span> {calcMeal(meal).fats} g</span>
                            </div>
                        </div>

                        
                        ),
                    )
                    )}
                </div>
            </div>
            </div>
        ) : (
            <div className="card w-1/3 flex flex-col overflow-hidden">
                <p className="text-gray-600 text-center flex justify-center items-center h-full">
                    Select a plan to view details
                    </p>
            </div>
        )}

        {/* Panel 3: Meal Detail — يظهر بس لو selectedMeal مش null */}
        {selectedMeal && selectedPlan ? (
        <div className="card w-1/3 flex flex-col overflow-hidden min-h-0">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{selectedMeal.name}</h3>
                <button
                className="btn btn-secondary"
                onClick={() => setSelectedMeal(null)}
                >
                Close
                </button>
            </div>

            {/* Totals */}
            {/* احسب totals بـ calcMeal(selectedMeal) */}

            <div className="card bg-gray-100 flex gap-2 mb-4">
                <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center">
                    {calcMeal(selectedMeal).calories} kcal
                </span>
                <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center">
                    <span className="font-semibold">P:</span> {calcMeal(selectedMeal).protein} g
                </span>
                <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center">
                    <span className="font-semibold">C:</span> {calcMeal(selectedMeal).carbs} g
                </span>
                <span className="flex-1 px-2 py-1 bg-yellow-200 rounded text-center">
                    <span className="font-semibold">F:</span> {calcMeal(selectedMeal).fats} g
                </span>
            </div>


            {/* زرار Add Food */}
            <button
                className="btn btn-primary mb-4 w-full"
                onClick={() => setFoodItemModalOpen(true)}
            >
                + Add Food
            </button>

            {
                /* لما showFoodSearch = true، اعمل useEffect يجيب /api/nutrition/food-items */
                <div
                className={`absolute top-full left-0 mt-2 w-full bg-white border rounded shadow-lg z-50 ${foodItems.length > 0 ? "" : "hidden"}`}
                ></div>
            }

            {/* ليستة الـ items */}
            <div className="flex-1 overflow-y-auto min-h-0">
            {selectedMeal.items.map((item) => (
                /* كل item: اسم + كالوريز محسوبة + input للـ amount */
                <div
                key={item.id}
                className="card px-6 py-4 flex justify-between items-center mb-2 bg-gray-100"
                >
                <div className="flex-1 flex-col">
                    <div className="font-bold mb-2">{item.name}</div>
                    <div>
                        
                    </div>

                    <div className="flex justify-end items-center gap-4">
                        <span className="flex-2 flex gap-2 items-center">
                            <input
                                type="number"
                                defaultValue={item.amount}
                                onBlur={(e) => handleAmountChange(item.id, e.target.value)}
                                className="flex-1 p-1 w-16 border rounded-lg text-center border-gray-200 bg-white"
                            />
                            <span className="flex-1">{item.serving_unit}</span>
                        </span>
                        <span className="flex-1 text-sm">{calcItem(item).calories} kcal</span>
                        <span className="flex-1 text-sm"><span className="font-semibold">P: </span>{calcItem(item).protein} g</span>
                        <span className="flex-1 text-sm"><span className="font-semibold">C: </span>{calcItem(item).carbs} g</span>
                        <span className="flex-1 text-sm"><span className="font-semibold">F: </span>{calcItem(item).fats} g</span>
                    </div>
                </div>
                
                
                
                </div>
            ))}
            </div>
            </div>
        ) : (
            <div className="card w-1/3 flex flex-col overflow-hidden min-h-0">
                <p className="text-gray-600 text-center flex justify-center items-center h-full">
                    Select a meal to view details
                    </p>
            </div>
        )}




        

        {/* Food Search Modal */}
        {foodItemModalOpen && (
            <div
            className={`fixed inset-0 flex items-center justify-center bg-black/30 z-50 ${foodItemModalOpen ? "" : "hidden"}`}
            onClick={() => setFoodItemModalOpen(false)}
            >
            <div
                className="card px-6 py-4 w-96 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-4">Search Food Items</h2>
                <input
                type="text"
                className="input-field mb-4"
                placeholder="Search for food..."
                value={foodSearchQuery}
                onChange={(e) => handleFoodSearch(e.target.value)}
                autoFocus
                />
                <div className="flex-1 overflow-y-auto min-h-0 mt-2">
                {foodItems
                    .filter((fi) =>
                    fi.name.toLowerCase().includes(foodSearchQuery.toLowerCase()),
                    )
                    .map((fi) => (
                    <div
                        key={fi.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleAddFoodItem(selectedMeal.id, fi)}
                    >
                        <p className="font-medium">{fi.name}</p>
                        <p className="text-sm text-gray-500">
                        {fi.calories_per_serving} kcal / {fi.serving_size} {fi.serving_unit}
                        </p>
                    </div>
                    ))}
                </div>
            </div>
            </div>
        )}
    </div>
);
}
