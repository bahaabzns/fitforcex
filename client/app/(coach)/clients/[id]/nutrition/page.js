"use client";
import { useParams } from "next/navigation";
import { useNutritionPlan } from "@/hooks/useNutritionPlan";
import { calcMeal, calcCycle, calcItem } from "@/lib/nutritionCalc";
import NameModal from "@/app/components/NameModal";
import LeftPanel from "@/app/components/nutrition/LeftPanel";
import MiddlePanel from "@/app/components/nutrition/MiddlePanel";
import RightPanel from "@/app/components/nutrition/RightPanel";
import FoodItemsModal from "@/app/components/nutrition/FoodItemsModal";

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
        handleRenameMeal,
        handleRenamePlan,
        handleRenameCycle,
        handleDeletePlan,
        handleDuplicatePlan,
        sortedPlans,
        sortOrder, setSortOrder,
    } = useNutritionPlan(id);

if (loading) {
    return <div>Loading...</div>;
}

return (
<div className="flex-1 h-full flex flex-row gap-4 overflow-hidden min-h-0">
{/* Panel 1: Plans List */}
        <LeftPanel
            plans={sortedPlans}
            selectedPlan={selectedPlan}
            planNameModalOpen={planNameModalOpen}
            setPlanNameModalOpen={setPlanNameModalOpen}
            planName={planName}
            setPlanName={setPlanName}
            handleCreatePlan={handleCreatePlan}
            handleSelectedPlan={handleSelectedPlan}
            handleDeletePlan={handleDeletePlan}
            handleDuplicatePlan={handleDuplicatePlan}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
        />

        {/* Panel 2: Plan Detail — يظهر بس لو selectedPlan مش null */}
        {selectedPlan ? (
        
        <MiddlePanel 
            selectedPlan={selectedPlan}
            handleSelectedPlan={handleSelectedPlan}
            setSelectedPlan={setSelectedPlan}
            selectedCycleIndex={selectedCycleIndex}
            setSelectedCycleIndex={setSelectedCycleIndex}
            selectedMeal={selectedMeal}
            setSelectedMeal={setSelectedMeal}
            cycleNameModalOpen={cycleNameModalOpen}
            setCycleNameModalOpen={setCycleNameModalOpen}
            cycleName={cycleName}
            setCycleName={setCycleName}
            mealModalOpen={mealModalOpen}
            setMealModalOpen={setMealModalOpen}
            mealName={mealName}
            setMealName={setMealName}
            handleDeleteCycle={handleDeleteCycle}
            handleCreateCycle={handleCreateCycle}
            handleCreateMeal={handleCreateMeal}
            handleRenamePlan={handleRenamePlan}
            handleRenameCycle={handleRenameCycle}
        />

        ) : (
            <div className="card w-1/3 flex flex-col overflow-hidden">
                <p className="text-gray-600 text-center flex justify-center items-center h-full">
                    Select a plan to view details
                    </p>
            </div>
        )}

        {/* Panel 3: Meal Detail — يظهر بس لو selectedMeal مش null */}
        {selectedMeal && selectedPlan ? (
            <RightPanel 
                selectedMeal={selectedMeal} 
                setSelectedMeal={setSelectedMeal}
                foodItems={foodItems}
                setFoodItems={setFoodItems}
                foodItemModalOpen={foodItemModalOpen}
                setFoodItemModalOpen={setFoodItemModalOpen}
                foodSearchQuery={foodSearchQuery}
                setFoodSearchQuery={setFoodSearchQuery}
                handleFoodSearch={handleFoodSearch}
                handleAddFoodItem={handleAddFoodItem}
                handleAmountChange={handleAmountChange}
                handleRenameMeal={handleRenameMeal}
            />
        ) : (
            <div className="card w-1/3 flex flex-col overflow-hidden min-h-0">
                <p className="text-gray-600 text-center flex justify-center items-center h-full">
                    Select a meal to view details
                    </p>
            </div>
        )}


        {/* Food Search Modal */}

        {foodItemModalOpen && (
            <FoodItemsModal
                foodItems={foodItems}
                foodSearchQuery={foodSearchQuery}
                onSearchChange={setFoodSearchQuery}
                onClose={() => setFoodItemModalOpen(false)}
                onSelectItem={(fi) => handleAddFoodItem(selectedMeal.id, fi)}
            />
        )}
    </div>
);
}
