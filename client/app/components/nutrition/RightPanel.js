import MacrosBadges from "../MacrosBadges";
import { calcMeal, calcItem } from "@/lib/nutritionCalc";

export default function RightPanel({ 
    selectedMeal, 
    foodItems, 
    setSelectedMeal, 
    setFoodItemModalOpen, 
    handleAmountChange,
    handleDeleteMealItem,
    handleRenameMeal,
}) {
    return (
        <div className="card w-1/3 flex flex-col overflow-hidden min-h-0">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 gap-4">
                <input
                    key={selectedMeal.id}
                    type="text"
                    defaultValue={selectedMeal.name}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim();
                        if (trimmed && trimmed !== selectedMeal.name) {
                            handleRenameMeal(selectedMeal.id, trimmed);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") {
                            e.target.value = selectedMeal.name;
                            e.target.blur();
                        }
                    }}
                    className="flex-1 text-xl font-bold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-blue-200 focus:border-blue-500 focus:bg-blue-100 truncate"
                />
                <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedMeal(null)}
                    >
                Close
                </button>
            </div>

            {/* Totals */}
            <MacrosBadges {...calcMeal(selectedMeal)} />


            {/* زرار Add Food */}
            <button
                className="btn btn-primary mb-4 w-full"
                onClick={() => setFoodItemModalOpen(true)}
            >
                + Add Food
            </button>

            {/* Food Items List */}
            <div className="flex-1 overflow-y-auto min-h-0">
            {selectedMeal.items.map((item) => (
                <div
                    key={item.id}
                    className="card px-6 py-4 flex justify-between items-center mb-2 bg-gray-100"
                >
                <div className="flex flex-col w-full">
                    <div className="font-bold mb-2 truncate">{item.name}</div>

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
                        <button
                            className="btn btn-danger text-sm py-1 px-3 shrink-0"
                            onClick={() => handleDeleteMealItem(item.id)}
                        >
                            Delete
                        </button>
                    </div>
                </div>
                </div>
            ))}
            </div>
        </div>
            
    )
}