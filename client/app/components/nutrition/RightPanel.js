import { useState, useRef, useEffect } from "react";
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
    handleUpdateMealNote,
    pendingFocusMealId, setPendingFocusMealId,
}) {
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);

    const mealTitleRef = useRef(null);

    useEffect(() => {
        if (pendingFocusMealId && selectedMeal?.id === pendingFocusMealId) {
            mealTitleRef.current?.focus();
            mealTitleRef.current?.select();
            setPendingFocusMealId(null);
        }
    }, [pendingFocusMealId, selectedMeal?.id, setPendingFocusMealId]);

    const currentItems = selectedMeal.items;
    const previewItems = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return currentItems;
        const arr = [...currentItems];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 gap-4">
                <input
                    ref={mealTitleRef}
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
                    title="Close meal"
                    className="cursor-pointer p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                    onClick={() => setSelectedMeal(null)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            {/* Totals */}
            <MacrosBadges {...calcMeal(selectedMeal)} />
            <div className="flex gap-4 justify-start items-center my-4 shrink-0">

                <h3 className="flex-1 text-lg font-semibold">
                    Food Items
                </h3>
                {/* زرار Add Food */}

                <button
                    className={`cursor-pointer h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                    "bg-blue-500 text-white border border-gray-200 hover:border-gray-300 hover:bg-blue-600"
                    }`}
                    onClick={() => setFoodItemModalOpen(true)}
                >
                    + Add Food
                </button>
            </div>

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
                        <div className="flex-1 font-bold truncate">{item.name}</div>
                        <button
                            title="Remove food item"
                            className="cursor-pointer p-2 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-300 transition-all duration-150 shrink-0 opacity-0 group-hover:opacity-100"
                            onClick={() => handleDeleteMealItem(item.id)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                        </button>
                    </div>
                    <div className="flex justify-end items-center gap-4">
                        <span className="flex-2 flex gap-2 items-center">
                            <input
                                type="number"
                                defaultValue={item.amount}
                                onBlur={(e) => handleAmountChange(item.id, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") e.target.blur();
                                    if (e.key === "Escape") {
                                        e.target.value = item.amount;
                                        e.target.blur();
                                    }
                                }}
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
                );
            })}
            </div>
            {/* Meal Note */}
            <div className="shrink-0 pt-3 border-t border-gray-100 mt-2">
                <textarea
                    key={selectedMeal.id + '-note'}
                    defaultValue={selectedMeal.note ?? ""}
                    placeholder="Add a meal note..."
                    rows={3}
                    onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (selectedMeal.note ?? "")) {
                            handleUpdateMealNote(selectedMeal.id, val);
                        }
                    }}
                    className="w-full p-2 text-sm text-gray-600 bg-transparent border border-gray-200 rounded-md outline-none resize-none hover:border-blue-200 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                />
            </div>
        </div>
            
    )
}