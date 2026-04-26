import NameModal from "../NameModal";
import MacrosBadges from "../MacrosBadges";
import { calcCycle, calcMeal, calcItem } from "@/lib/nutritionCalc";

export default function RightPanel({ selectedMeal, foodItems, setSelectedMeal, setFoodItemModalOpen, handleAmountChange }) {
    return (
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

            <MacrosBadges {...calcMeal(selectedMeal)} />


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
            
    )
}