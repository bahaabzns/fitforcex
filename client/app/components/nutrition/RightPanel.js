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
                    className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-primary/30 truncate text-foreground"
                />
                <button
                    title="Close meal"
                    className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
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
                    className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    onClick={() => setItemsCollapsed(v => !v)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points={itemsCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                    </svg>
                </button>
                <h3 className="text-base font-semibold text-foreground flex-1">
                    Food Items
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedMeal.items.length}</span>
                </h3>
                {!itemsCollapsed && (
                <button
                    className="cursor-pointer h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors"
                    onClick={() => setFoodItemModalOpen(true)}
                >
                    + Add Food
                </button>
                )}
            </div>

            {/* Food Items List */}
            {!itemsCollapsed && (
            <div className="flex-1 overflow-y-auto min-h-0">
            <div className="divide-y divide-border">
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
                    className={`group flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-150 ${isDragging ? "opacity-30 scale-95" : ""} ${
                        isExpanded ? "bg-primary/10" : "hover:bg-accent"
                    }`}
                >
                    {/* Drag grip */}
                    <span className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0 select-none">
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                            <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                            <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                            <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                        </svg>
                    </span>

                    {/* Name + macros */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isExpanded ? "text-primary" : "text-foreground"}`}>
                            {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
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
                            className="w-14 p-1 border border-border rounded-lg text-center bg-card text-xs"
                        />
                        <span className="text-xs text-muted-foreground">{item.serving_unit}</span>
                    </div>

                    {/* Calories */}
                    <div className="flex items-baseline gap-0.5 shrink-0">
                        <span className="text-sm font-bold text-foreground">{calcItem(item).calories}</span>
                        <span className="text-xs text-muted-foreground">kcal</span>
                    </div>

                    {/* Alternatives + delete */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            title={isExpanded ? "Collapse alternatives" : "Expand alternatives"}
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                            className={`cursor-pointer px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
                                isExpanded
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-border hover:bg-accent"
                            }`}
                        >
                            {alternatives.length} alt
                        </button>
                        <button
                            title="Remove food item"
                            className="cursor-pointer p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
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
                            <div key={alt.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 mb-1">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{alt.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        C {calcItem(alt).carbs}g · P {calcItem(alt).protein}g · F {calcItem(alt).fats}g
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <input
                                        type="number"
                                        value={alt.amount}
                                        readOnly
                                        className="w-14 p-1 border rounded-lg text-center border-border bg-card/60 cursor-not-allowed text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">{alt.serving_unit}</span>
                                </div>
                                <div className="flex items-baseline gap-0.5 shrink-0">
                                    <span className="text-sm font-bold text-foreground">{calcItem(alt).calories}</span>
                                    <span className="text-xs text-muted-foreground">kcal</span>
                                </div>
                                <button
                                    title="Remove alternative"
                                    className="cursor-pointer p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                    onClick={() => handleDeleteAlternative(item.id, alt.id)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                </button>
                            </div>
                        ))}
                        <button
                            className="cursor-pointer w-full mt-1 py-2 text-xs font-medium text-primary border border-dashed border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
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
            <div className="shrink-0 border-t border-border my-3" />

            {/* Meal Notes Section */}
            <div className="flex flex-col shrink-0">
                <div className="flex items-center gap-3 mb-3">
                    <button
                        className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        onClick={() => setNotesCollapsed(v => !v)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points={notesCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                        </svg>
                    </button>
                    <h3 className="text-base font-semibold text-foreground">Notes</h3>
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
                        className="w-full mb-2 px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none resize-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                    />
                )}
            </div>
        </div>
    )
}
