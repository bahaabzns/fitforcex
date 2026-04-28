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
    alternativeModalOpenForItemId, setAlternativeModalOpenForItemId,
    handleDeleteAlternative,
    handleAlternativeAmountChange,
}) {
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [expandedItemId, setExpandedItemId] = useState(null);
    const [itemsCollapsed, setItemsCollapsed] = useState(false);
    const [notesCollapsed, setNotesCollapsed] = useState(false);

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
            <div className="flex justify-between items-center mb-3 gap-4">
                <input
                    ref={mealTitleRef}
                    key={selectedMeal.id}
                    type="text"
                    defaultValue={selectedMeal.name}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim() || "Untitled Meal";
                        e.target.value = trimmed;
                        if (trimmed !== selectedMeal.name) {
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
                    className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-blue-200 focus:border-blue-500 focus:bg-blue-50 truncate text-gray-900"
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
            <div className="mb-3">
                <MacrosBadges {...calcMeal(selectedMeal)} />
            </div>

            {/* Food Items Section */}
            <div className="flex flex-col min-h-0" style={{ flex: itemsCollapsed ? '0 0 auto' : '1 1 0' }}>
            <div className="flex items-center gap-3 my-3 shrink-0">
                <button
                    className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    onClick={() => setItemsCollapsed(v => !v)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points={itemsCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                    </svg>
                </button>
                <h3 className="text-base font-semibold text-gray-900 flex-1">
                    Food Items
                    <span className="ml-2 text-xs font-normal text-gray-400">{selectedMeal.items.length}</span>
                </h3>
                {!itemsCollapsed && (
                <button
                    className="cursor-pointer h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                    onClick={() => setFoodItemModalOpen(true)}
                >
                    + Add Food
                </button>
                )}
            </div>

            {/* Food Items List */}
            {!itemsCollapsed && (
            <div className="flex-1 overflow-y-auto min-h-0">
            <div className="divide-y divide-gray-100">
            {previewItems.map((item) => {
                const originalIndex = currentItems.findIndex(i => i.id === item.id);
                const isDragging = dragIndex !== null && currentItems[dragIndex]?.id === item.id;
                const isExpanded = expandedItemId === item.id;
                const alternatives = item.alternatives ?? [];
                return (
                <div key={item.id}>
                <div
                    draggable
                    onDragStart={() => setDragIndex(originalIndex)}
                    onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                    onDrop={() => { handleReorderFoodItems(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                    onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                    className={`group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 ${isDragging ? "opacity-30 scale-95" : ""} ${
                        isExpanded ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                >
                    {/* Drag grip */}
                    <span className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0 select-none">
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                            <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                            <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                            <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                        </svg>
                    </span>

                    {/* Name + macros */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isExpanded ? "text-blue-700" : "text-gray-800"}`}>
                            {item.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            C {calcItem(item).carbs}g · P {calcItem(item).protein}g · F {calcItem(item).fats}g
                        </p>
                    </div>

                    {/* Amount input */}
                    <div className="flex items-center gap-1 shrink-0">
                        <input
                            type="number"
                            defaultValue={item.amount}
                            onClick={(e) => e.target.select()}
                            onBlur={(e) => handleAmountChange(item.id, e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") e.target.blur();
                                if (e.key === "Escape") { e.target.value = item.amount; e.target.blur(); }
                            }}
                            className="w-14 p-1 border border-gray-200 rounded-lg text-center bg-white text-xs"
                        />
                        <span className="text-xs text-gray-400">{item.serving_unit}</span>
                    </div>

                    {/* Calories */}
                    <div className="flex items-baseline gap-0.5 shrink-0">
                        <span className="text-sm font-bold text-gray-900">{calcItem(item).calories}</span>
                        <span className="text-xs text-gray-400">kcal</span>
                    </div>

                    {/* Alternatives + delete */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            title={isExpanded ? "Collapse alternatives" : "Expand alternatives"}
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                            className={`cursor-pointer px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
                                isExpanded
                                    ? "border-blue-300 bg-blue-100 text-blue-600"
                                    : "border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-100"
                            }`}
                        >
                            {alternatives.length} alt
                        </button>
                        <button
                            title="Remove food item"
                            className="cursor-pointer p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            onClick={() => handleDeleteMealItem(item.id)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                        </button>
                    </div>
                </div>

                {/* Alternatives section */}
                {isExpanded && (
                    <div className="ml-4 mb-1">
                        {alternatives.map((alt) => (
                            <div key={alt.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 mb-1">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">{alt.name}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        C {calcItem(alt).carbs}g · P {calcItem(alt).protein}g · F {calcItem(alt).fats}g
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <input
                                        type="number"
                                        value={alt.amount}
                                        readOnly
                                        className="w-14 p-1 border rounded-lg text-center border-gray-200 bg-white/60 cursor-not-allowed text-xs"
                                    />
                                    <span className="text-xs text-gray-400">{alt.serving_unit}</span>
                                </div>
                                <div className="flex items-baseline gap-0.5 shrink-0">
                                    <span className="text-sm font-bold text-gray-700">{calcItem(alt).calories}</span>
                                    <span className="text-xs text-gray-400">kcal</span>
                                </div>
                                <button
                                    title="Remove alternative"
                                    className="cursor-pointer p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                    onClick={() => handleDeleteAlternative(item.id, alt.id)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                </button>
                            </div>
                        ))}
                        <button
                            className="cursor-pointer w-full mt-1 py-2 text-xs font-medium text-blue-500 border border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
                            onClick={() => setAlternativeModalOpenForItemId(item.id)}
                        >
                            + Add Alternative
                        </button>
                    </div>
                )}
                </div>
                );
            })}
            </div>
            </div>
            )}
            </div>

            {/* Divider */}
            <div className="shrink-0 border-t border-gray-100 my-3" />

            {/* Meal Notes Section */}
            <div className="flex flex-col shrink-0">
                <div className="flex items-center gap-3 mb-3">
                    <button
                        className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        onClick={() => setNotesCollapsed(v => !v)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points={notesCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                        </svg>
                    </button>
                    <h3 className="text-base font-semibold text-gray-900">Notes</h3>
                </div>
                {!notesCollapsed && (
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
                        className="w-full mb-2 px-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl outline-none resize-none placeholder-gray-400 hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                    />
                )}
            </div>
        </div>
    )
}