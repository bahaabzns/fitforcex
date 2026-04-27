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
            <div className="flex justify-between items-center mb-4 gap-4">
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

            {/* Food Items Section */}
            <div className="flex flex-col min-h-0" style={{ flex: itemsCollapsed ? '0 0 auto' : '1 1 0' }}>
            <div
                className="flex gap-4 justify-start items-center my-4 shrink-0 cursor-pointer select-none"
                onClick={() => setItemsCollapsed(v => !v)}
            >
                <div className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points={itemsCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                    </svg>
                </div>
                <div className="flex-1 flex gap-2 items-center">
                    <h3 className="text-lg font-semibold">Food Items</h3>
                    <p className="text-sm text-gray-600 shrink-0">({selectedMeal.items.length} items)</p>
                </div>
                {!itemsCollapsed && (
                <button
                    className="cursor-pointer h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors bg-blue-500 text-white border border-gray-200 hover:border-gray-300 hover:bg-blue-600"
                    onClick={(e) => { e.stopPropagation(); setFoodItemModalOpen(true); }}
                >
                    + Add Food
                </button>
                )}
            </div>

            {/* Food Items List */}
            {!itemsCollapsed && (
            <div className="flex-1 overflow-y-auto min-h-0">
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
                    className={`flex gap-2 items-stretch mb-1 transition-all duration-150 ${isDragging ? "opacity-30 scale-95" : ""}`}
                >
                    {/* Item card */}
                    <div className={`flex-1 card px-4 py-3 flex justify-between items-center group ${isExpanded ? "border-blue-400 bg-blue-50" : "bg-gray-100"}`}>
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
                                <div className={`flex-1 font-bold truncate ${isExpanded ? "text-blue-700" : ""}`}>{item.name}</div>
                                <button
                                    title="Remove food item"
                                    className="cursor-pointer p-2 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-300 transition-all duration-150 shrink-0 opacity-0 group-hover:opacity-100"
                                    onClick={() => handleDeleteMealItem(item.id)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                </button>
                                <button
                                    title={isExpanded ? "Collapse alternatives" : "Expand alternatives"}
                                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                    className={`cursor-pointer px-2.5 py-2 rounded-lg border transition-all duration-150 shrink-0 text-xs font-semibold ${
                                        isExpanded
                                            ? "border-blue-400 bg-blue-100 text-blue-600 hover:bg-blue-200"
                                            : "border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100 hover:border-blue-300"
                                    }`}
                                >
                                    {alternatives.length} alters
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="flex gap-1.5 items-center shrink-0">
                                    <input
                                        type="number"
                                        defaultValue={item.amount}
                                        onClick={(e) => e.target.select()}
                                        onBlur={(e) => handleAmountChange(item.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") e.target.blur();
                                            if (e.key === "Escape") {
                                                e.target.value = item.amount;
                                                e.target.blur();
                                            }
                                        }}
                                        className="p-1 w-16 border rounded-lg text-center border-gray-200 bg-white text-sm"
                                    />
                                    <span className="text-sm text-gray-500">{item.serving_unit}</span>
                                </span>
                                <div className="h-5 w-px bg-gray-200 shrink-0" />
                                <div className="flex items-baseline gap-1">
                                    <span className="text-base font-bold text-gray-800">{calcItem(item).calories}</span>
                                    <span className="text-xs text-gray-400">kcal</span>
                                </div>
                                <div className="h-5 w-px bg-gray-200 shrink-0" />
                                <div className="flex gap-3">
                                    {[
                                        { label: "C", value: calcItem(item).carbs,   color: "text-teal-600" },
                                        { label: "P", value: calcItem(item).protein, color: "text-red-500" },
                                        { label: "F", value: calcItem(item).fats,    color: "text-yellow-600" },
                                    ].map(({ label, value, color }) => (
                                        <p key={label} className="text-sm font-semibold text-gray-800 flex items-baseline gap-0.5">
                                            <span className={`text-xs font-bold ${color}`}>{label}</span>
                                            {value}<span className="text-xs text-gray-400 font-normal">g</span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alternatives section */}
                {isExpanded && (
                    <div className="mb-2">
                        {alternatives.map((alt) => (
                            <div key={alt.id} className="card px-4 py-3 mb-1 bg-white border border-blue-100 group">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex-1 font-bold truncate text-gray-700">{alt.name}</div>
                                    <button
                                        title="Remove alternative"
                                        className="cursor-pointer p-2 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-300 transition-all duration-150 shrink-0 opacity-0 group-hover:opacity-100"
                                        onClick={() => handleDeleteAlternative(item.id, alt.id)}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="flex gap-1.5 items-center shrink-0">
                                        <input
                                            type="number"
                                            value={alt.amount}
                                            readOnly
                                            className="p-1 w-16 border rounded-lg text-center border-gray-200 bg-gray-100 cursor-not-allowed text-sm"
                                        />
                                        <span className="text-sm text-gray-500">{alt.serving_unit}</span>
                                    </span>
                                    <div className="h-5 w-px bg-gray-200 shrink-0" />
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-base font-bold text-gray-800">{calcItem(alt).calories}</span>
                                        <span className="text-xs text-gray-400">kcal</span>
                                    </div>
                                    <div className="h-5 w-px bg-gray-200 shrink-0" />
                                    <div className="flex gap-3">
                                        {[
                                            { label: "C", value: calcItem(alt).carbs,   color: "text-teal-600" },
                                            { label: "P", value: calcItem(alt).protein, color: "text-red-500" },
                                            { label: "F", value: calcItem(alt).fats,    color: "text-yellow-600" },
                                        ].map(({ label, value, color }) => (
                                            <p key={label} className="text-sm font-semibold text-gray-800 flex items-baseline gap-0.5">
                                                <span className={`text-xs font-bold ${color}`}>{label}</span>
                                                {value}<span className="text-xs text-gray-400 font-normal">g</span>
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button
                            className="cursor-pointer w-full mt-1 py-1.5 text-xs font-semibold text-blue-500 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
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
            )}
            </div>

            {/* Divider */}
            <div className="shrink-0 border-t border-gray-100 my-1" />

            {/* Meal Notes Section */}
            <div className="flex flex-col shrink-0">
                <div
                    className="flex gap-2 items-center mb-2 cursor-pointer select-none"
                    onClick={() => setNotesCollapsed(v => !v)}
                >
                    <div className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points={notesCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold">Notes</h3>
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
                        className="w-full mb-2 p-2 text-sm text-gray-600 bg-white border border-transparent rounded-md outline-none resize-none hover:border-blue-200 focus:border-blue-500 focus:bg-blue-50 transition-colors"
                    />
                )}
            </div>
        </div>
    )
}