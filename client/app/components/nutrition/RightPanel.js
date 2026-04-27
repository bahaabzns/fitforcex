import { useState } from "react";
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
    handleReorderFoodItems,
}) {
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);

    const currentItems = selectedMeal.items;
    const previewItems = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return currentItems;
        const arr = [...currentItems];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-0">
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
            {previewItems.map((item) => {
                const originalIndex = currentItems.findIndex(i => i.id === item.id);
                const isDragging = dragIndex !== null && currentItems[dragIndex]?.id === item.id;
                return (
                <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragIndex(originalIndex)}
                    onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                    onDrop={() => { handleReorderFoodItems(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                    onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                    className={`card px-6 py-4 flex justify-between items-center mb-2 bg-gray-100 transition-all duration-150 group ${isDragging ? "opacity-30 scale-95 ring-2 ring-blue-300" : ""}`}
                >
                <div className="flex flex-col w-full">
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className="text-gray-400 hover:text-gray-600 cursor-grab shrink-0 select-none"
                            title="Drag to reorder"
                        >
                            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                                <circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/>
                                <circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>
                                <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
                            </svg>
                        </span>
                        <div className="font-bold truncate">{item.name}</div>
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
                        <button
                            className="btn btn-danger text-sm py-1 px-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            onClick={() => handleDeleteMealItem(item.id)}
                        >
                            Delete
                        </button>
                    </div>
                </div>
                </div>
                );
            })}
            </div>
        </div>
            
    )
}