import { useState, useRef, useEffect } from "react";
import MacrosBadges from "../MacrosBadges";
import { calcMeal, calcItem } from "@/lib/nutritionCalc";
import { Button } from "@heroui/react/button";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";

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
    const [expandedKeys, setExpandedKeys] = useState(new Set(["items", "notes"]));

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
        <Surface variant="default" className="w-full flex flex-col overflow-hidden min-h-full p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface">
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

            <DisclosureGroup expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

                {/* Food Items Section */}
                <div className="flex flex-col min-h-0" style={{ flex: expandedKeys.has("items") ? "1 1 0" : "0 0 auto" }}>
                    <Disclosure id="items">
                        <Disclosure.Heading>
                            <div className="flex items-center gap-2 w-full my-3">
                                <Button
                                    slot="trigger"
                                    variant="ghost"
                                    className="flex-1 justify-start gap-2 px-0 data-hover:bg-transparent min-w-0"
                                >
                                    <h3 className="text-base font-semibold text-foreground">
                                        Food Items
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedMeal.items.length}</span>
                                    </h3>
                                    <Disclosure.Indicator />
                                </Button>
                                {expandedKeys.has("items") && (
                                    <Button variant="primary" onClick={() => setFoodItemModalOpen(true)}>
                                        + Add Food
                                    </Button>
                                )}
                            </div>
                        </Disclosure.Heading>
                        <Disclosure.Content>
                            <Disclosure.Body className="flex-1 overflow-y-auto min-h-0 px-0 pt-0">
                                <DisclosureGroup className="divide-y divide-border">
                                    {previewItems.map((item) => {
                                        const originalIndex = currentItems.findIndex(i => i.id === item.id);
                                        const isDragging = dragIndex !== null && currentItems[dragIndex]?.id === item.id;
                                        const alternatives = item.alternatives ?? [];
                                        return (
                                            <Disclosure key={item.id} id={String(item.id)} className="group/disc">
                                                <Disclosure.Heading>
                                                    <div
                                                        draggable
                                                        onDragStart={() => setDragIndex(originalIndex)}
                                                        onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                                        onDrop={() => { handleReorderFoodItems(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                                        onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                                        className={`group flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-150 hover:bg-accent group-data-open/disc:bg-primary/10 ${isDragging ? "opacity-30 scale-95" : ""}`}
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
                                                            <p className="text-sm font-medium truncate text-foreground group-data-open/disc:text-primary">
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

                                                        {/* Alternatives trigger + delete */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button
                                                                slot="trigger"
                                                                className="cursor-pointer px-2 py-1 rounded-lg border text-xs font-medium transition-all border-border text-muted-foreground data-hover:bg-accent data-open:border-primary/40 data-open:bg-primary/10 data-open:text-primary"
                                                            >
                                                                {alternatives.length} alt
                                                            </Button>
                                                            <button
                                                                title="Remove food item"
                                                                className="cursor-pointer p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                onClick={() => handleDeleteMealItem(item.id)}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </Disclosure.Heading>
                                                <Disclosure.Content>
                                                    <Disclosure.Body className="ml-4 mb-1 px-0 pt-0">
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
                                                    </Disclosure.Body>
                                                </Disclosure.Content>
                                            </Disclosure>
                                        );
                                    })}
                                </DisclosureGroup>
                            </Disclosure.Body>
                        </Disclosure.Content>
                    </Disclosure>
                </div>

                <Separator className="my-2" />

                {/* Meal Notes Section */}
                <div className="flex flex-col shrink-0">
                    <Disclosure id="notes">
                        <Disclosure.Heading>
                            <Button
                                slot="trigger"
                                variant="ghost"
                                className="w-full justify-start gap-2 px-0 mb-3 data-hover:bg-transparent"
                            >
                                <h3 className="text-base font-semibold text-foreground flex-1 text-left">Notes</h3>
                                <Disclosure.Indicator />
                            </Button>
                        </Disclosure.Heading>
                        <Disclosure.Content>
                            <Disclosure.Body className="px-0 pt-0">
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
                            </Disclosure.Body>
                        </Disclosure.Content>
                    </Disclosure>
                </div>

            </DisclosureGroup>
        </Surface>
    );
}
