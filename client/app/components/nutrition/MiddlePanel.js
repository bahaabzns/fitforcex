import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import MacrosBadges from "../MacrosBadges";
import { calcCycle, calcMeal } from "@/lib/nutritionCalc";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Modal } from "@heroui/react/modal";
import { ProgressBar } from "@heroui/react/progress-bar";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";

export default function MiddlePanel({
    selectedPlan,
    setSelectedPlan,
    selectedCycleIndex,
    setSelectedCycleIndex,
    selectedMeal,
    setSelectedMeal,
    handleDeleteCycle,
    handleCreateCycle,
    handleCreateMeal,
    handleRenamePlan,
    handleRenameCycle,
    handleDeleteMeal,
    handleDuplicateMeal,
    handleDuplicateCycle,
    handleUpdateCycleGoals,
    handleReorderMeals,
    handleReorderCycles,
    handleUpdateCycleNote,
    handleActivatePlan,
    handleSaveSelectedPlan,
    isDirty,
    isSaving,
    saveStatus,
    dirtyPlanIds,
    pendingFocusPlanId, setPendingFocusPlanId,
    pendingFocusCycleId, setPendingFocusCycleId,
    submissionId,
}) {
    const router = useRouter();
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [cycleDragIndex, setCycleDragIndex] = useState(null);
    const [cycleHoverIndex, setCycleHoverIndex] = useState(null);
    const [expandedKeys, setExpandedKeys] = useState(new Set(["cycles", "meals", "notes"]));
    const [activateModal, setActivateModal] = useState(false);
    const [activating, setActivating] = useState(false);

    const planTitleRef = useRef(null);
    const cycleTitleRef = useRef(null);

    useEffect(() => {
        if (pendingFocusPlanId && selectedPlan?.id === pendingFocusPlanId) {
            planTitleRef.current?.focus();
            planTitleRef.current?.select();
            setPendingFocusPlanId(null);
        }
    }, [pendingFocusPlanId, selectedPlan?.id, setPendingFocusPlanId]);

    useEffect(() => {
        if (pendingFocusCycleId && selectedPlan.cycles[selectedCycleIndex]?.id === pendingFocusCycleId) {
            cycleTitleRef.current?.focus();
            cycleTitleRef.current?.select();
            setPendingFocusCycleId(null);
        }
    }, [pendingFocusCycleId, selectedCycleIndex, selectedPlan.cycles, setPendingFocusCycleId]);

    const currentMeals = selectedPlan.cycles[selectedCycleIndex]?.meals ?? [];
    const previewMeals = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return currentMeals;
        const arr = [...currentMeals];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    const previewCycles = (() => {
        if (cycleDragIndex === null || cycleHoverIndex === null || cycleDragIndex === cycleHoverIndex) return selectedPlan.cycles;
        const arr = [...selectedPlan.cycles];
        const [moved] = arr.splice(cycleDragIndex, 1);
        arr.splice(cycleHoverIndex, 0, moved);
        return arr;
    })();
    const isSelectedPlanDirty = dirtyPlanIds?.includes(String(selectedPlan.id));

    async function handleActivateAndMark(navigateToQueue) {
        if (!selectedPlan?.id || !submissionId) return;

        setActivating(true);
        try {
            await handleActivatePlan(selectedPlan.id);
            await api.patch("/api/forms/queue/review", { ids: [submissionId], action: "review" });
            if (navigateToQueue) {
                router.push("/plans-queue");
            }
        } catch {
            // silent - upstream handlers already manage errors
        } finally {
            setActivating(false);
            setActivateModal(false);
        }
    }

    return (
        <>
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface">
            {/* Header */}
            <div className="flex justify-between items-center mb-3 gap-4">
                <input
                    ref={planTitleRef}
                    key={selectedPlan.id}
                    type="text"
                    defaultValue={selectedPlan.name}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim() || "Untitled Plan";
                        e.target.value = trimmed;
                        if (trimmed !== selectedPlan.name) {
                            handleRenamePlan(selectedPlan.id, trimmed);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                        if (e.key === 'Escape') {
                            e.target.value = selectedPlan.name;
                            e.target.blur();
                        }
                    }}
                    className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-primary/30 truncate text-foreground"
                />
                {isSelectedPlanDirty && (
                    <Button
                        type="button"
                        variant="primary"
                        isDisabled={isSaving}
                        onClick={() => handleSaveSelectedPlan(selectedPlan.id)}
                        className="shrink-0"
                    >
                        {isSaving || saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save Plan"}
                    </Button>
                )}
                {selectedPlan?.status !== "active" && (
                    <Button
                        type="button"
                        isDisabled={isSaving || activating}
                        onClick={() => {
                            if (submissionId) {
                                setActivateModal(true);
                                return;
                            }
                            handleActivatePlan(selectedPlan.id);
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                    >
                        {activating ? "Activating..." : "Activate"}
                    </Button>
                )}
                {isSelectedPlanDirty && (
                    <Chip size="sm" className="bg-amber-500/15 text-amber-600 border border-amber-500/20 shrink-0">
                        Unsaved
                    </Chip>
                )}
                {!isSelectedPlanDirty && saveStatus === "saved" && (
                    <Chip size="sm" className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 shrink-0">
                        Saved
                    </Chip>
                )}
                <button
                    title="Close plan"
                    className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                    onClick={() => setSelectedPlan(null)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            {/* Current Cycle Name + Daily Goal */}
            {selectedPlan.cycles.length > 0 && (() => {
                const cycle = selectedPlan.cycles[selectedCycleIndex];
                const cycleTotals = calcCycle(cycle);
                return (
                    <>
                        <div className="flex items-center mb-3 gap-3 shrink-0">
                            <input
                                ref={cycleTitleRef}
                                key={cycle.id}
                                type="text"
                                defaultValue={cycle.name}
                                onBlur={(e) => {
                                    const trimmed = e.target.value.trim() || "Untitled Cycle";
                                    e.target.value = trimmed;
                                    if (trimmed !== cycle.name) handleRenameCycle(cycle.id, trimmed);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') { e.target.value = cycle.name; e.target.blur(); }
                                }}
                                className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-primary/30 truncate text-foreground"
                            />
                        </div>
                        <Surface variant="secondary" className="rounded-lg p-4 mb-3 shrink-0">
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-2xl font-bold text-foreground">{cycleTotals.calories}</span>
                                {cycle.goal_calories
                                    ? <span className="text-sm text-muted-foreground">/ {cycle.goal_calories} kcal</span>
                                    : <span className="text-sm text-muted-foreground">kcal</span>
                                }
                                {cycle.goal_calories && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {Math.round((cycleTotals.calories / cycle.goal_calories) * 100)}%
                                    </span>
                                )}
                            </div>
                            {cycle.goal_calories && (
                                <ProgressBar value={Math.min(100, (cycleTotals.calories / cycle.goal_calories) * 100)} className="mb-3">
                                    <ProgressBar.Track className="h-1.5">
                                        <ProgressBar.Fill />
                                    </ProgressBar.Track>
                                </ProgressBar>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: "C", current: cycleTotals.carbs,   target: cycle.goal_carbs },
                                    { label: "P", current: cycleTotals.protein, target: cycle.goal_protein },
                                    { label: "F", current: cycleTotals.fats,    target: cycle.goal_fats },
                                ].map(({ label, current, target }) => (
                                    <div key={label}>
                                        <p className="text-sm text-foreground flex items-baseline gap-0.5">
                                            <span className="text-xs text-muted-foreground mr-0.5">{label}</span>
                                            <span className="font-medium">{current}</span>
                                            <span className="text-xs text-muted-foreground font-normal">
                                                {target ? `/${target}g` : "g"}
                                            </span>
                                        </p>
                                        {target && (
                                            <ProgressBar value={Math.min(100, (current / target) * 100)} className="mt-1.5">
                                                <ProgressBar.Track className="h-1">
                                                    <ProgressBar.Fill className="bg-muted-foreground" />
                                                </ProgressBar.Track>
                                            </ProgressBar>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Surface>
                    </>
                );
            })()}

            <DisclosureGroup expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

            {/* Cycles Section */}
            <Disclosure id="cycles">
                <Disclosure.Heading>
                    <div className="flex items-center gap-2 w-full mb-2">
                        <Button
                            slot="trigger"
                            variant="ghost"
                            className="flex-1 justify-start gap-2 px-3 data-hover:bg-transparent min-w-0"
                        >
                            <Disclosure.Indicator />
                            <h3 className="text-base font-semibold text-foreground">
                                Cycles
                                <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedPlan.cycles.length}</span>
                                {!expandedKeys.has("cycles") && selectedPlan.cycles.length > 0 && (
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">· {selectedPlan.cycles[selectedCycleIndex]?.name}</span>
                                )}
                            </h3>
                        </Button>
                        {expandedKeys.has("cycles") && (
                            <Button variant="primary" onClick={handleCreateCycle} className="shrink-0">
                                + Cycle
                            </Button>
                        )}
                    </div>
                </Disclosure.Heading>
                <Disclosure.Content>
                    <Disclosure.Body className="px-0 pt-0">
                        {selectedPlan.cycles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {previewCycles.map((planCycle) => {
                                    const originalIndex = selectedPlan.cycles.findIndex(c => c.id === planCycle.id);
                                    const isDragging = cycleDragIndex !== null && selectedPlan.cycles[cycleDragIndex]?.id === planCycle.id;
                                    const isActive = planCycle.id === selectedPlan.cycles[selectedCycleIndex]?.id;
                                    const canDelete = selectedPlan.cycles.length > 1;
                                    return (
                                        <div
                                            key={planCycle.id}
                                            draggable
                                            onDragStart={() => setCycleDragIndex(originalIndex)}
                                            onDragOver={(e) => { e.preventDefault(); if (originalIndex !== cycleDragIndex) setCycleHoverIndex(originalIndex); }}
                                            onDrop={() => { handleReorderCycles(cycleDragIndex, cycleHoverIndex); setCycleDragIndex(null); setCycleHoverIndex(null); }}
                                            onDragEnd={() => { setCycleDragIndex(null); setCycleHoverIndex(null); }}
                                            className={`group flex items-center gap-1 rounded-full pl-2.5 pr-1.5 h-9 text-sm font-semibold transition-all cursor-grab select-none ${
                                                isDragging ? "opacity-30 scale-95" : ""
                                            } ${
                                                isActive
                                                    ? "bg-primary text-white"
                                                    : "bg-card text-muted-foreground border border-border hover:border-border hover:bg-accent"
                                            }`}
                                        >
                                            <svg width="8" height="13" viewBox="0 0 8 13" fill="currentColor" className={`shrink-0 transition-opacity ${isActive ? "opacity-50" : "opacity-25 group-hover:opacity-50"}`}>
                                                <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                                <circle cx="2" cy="6.5" r="1.2"/><circle cx="6" cy="6.5" r="1.2"/>
                                                <circle cx="2" cy="11" r="1.2"/><circle cx="6" cy="11" r="1.2"/>
                                            </svg>
                                            <span
                                                className="truncate max-w-24 cursor-pointer"
                                                onClick={() => { setSelectedCycleIndex(originalIndex); setSelectedMeal(null); }}
                                            >
                                                {planCycle.name}
                                            </span>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                                                <button
                                                    title="Duplicate cycle"
                                                    className={`cursor-pointer p-1 rounded-full transition-colors ${isActive ? "hover:bg-primary/70" : "hover:bg-secondary"}`}
                                                    onClick={(e) => { e.stopPropagation(); handleDuplicateCycle(planCycle.id); }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                                </button>
                                                <button
                                                    title="Delete cycle"
                                                    disabled={!canDelete}
                                                    className={`p-1 rounded-full transition-colors ${!canDelete ? "opacity-30 cursor-not-allowed" : `cursor-pointer ${isActive ? "hover:bg-primary/70" : "hover:bg-destructive/10 hover:text-destructive"}`}`}
                                                    onClick={(e) => { e.stopPropagation(); if (canDelete) handleDeleteCycle(originalIndex); }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Disclosure.Body>
                </Disclosure.Content>
            </Disclosure>

            <Separator className="my-2" />

            {/* Lower block: Meals + Notes */}
            <div className="flex flex-col flex-1 min-h-0">

                {/* Meals Section */}
                <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: expandedKeys.has("meals") ? "1 1 0" : "0 0 auto" }}>
                    <Disclosure id="meals">
                        <Disclosure.Heading>
                            <div className="flex items-center gap-2 w-full mb-2">
                                <Button
                                    slot="trigger"
                                    variant="ghost"
                                    className="flex-1 justify-start gap-2 px-3 data-hover:bg-transparent min-w-0"
                                >
                                    <Disclosure.Indicator />
                                    <h3 className="text-base font-semibold text-foreground">
                                        Meals
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedPlan.cycles[selectedCycleIndex].meals.length}</span>
                                    </h3>
                                </Button>
                                {expandedKeys.has("meals") && (
                                    <Button variant="primary" onClick={handleCreateMeal} className="shrink-0">
                                        + Meal
                                    </Button>
                                )}
                            </div>
                        </Disclosure.Heading>
                    </Disclosure>
                    {expandedKeys.has("meals") && (
                    <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                {selectedPlan.cycles.length === 0 ? (
                                    <Surface variant="default" className="rounded-xl p-8 flex items-center justify-center mx-2 my-2">
                                        <p className="text-sm text-muted-foreground">No meals added yet.</p>
                                    </Surface>
                                ) : (
                                    previewMeals.map((meal) => {
                                        const originalIndex = currentMeals.findIndex(m => m.id === meal.id);
                                        const isDragging = dragIndex !== null && currentMeals[dragIndex]?.id === meal.id;
                                        const mealTotals = calcMeal(meal);
                                        const isSelected = selectedMeal && selectedMeal.id === meal.id;
                                        return (
                                            <div
                                                key={meal.id}
                                                draggable
                                                onDragStart={() => setDragIndex(originalIndex)}
                                                onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                                onDrop={() => { handleReorderMeals(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                                onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                                className={`group flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all duration-150 mb-1.5 ${
                                                    isDragging ? "opacity-30 scale-95" : ""
                                                } ${
                                                    isSelected
                                                        ? "bg-primary/10 border-primary/30 shadow-sm"
                                                        : "bg-card border-border hover:bg-accent hover:border-primary/30 hover:shadow-sm"
                                                }`}
                                                onClick={() => setSelectedMeal(meal)}
                                            >
                                                <span
                                                    className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0 select-none"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                                                        <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                                        <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                                                        <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                                                    </svg>
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                                                        {meal.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        C {mealTotals.carbs}g · P {mealTotals.protein}g · F {mealTotals.fats}g
                                                        <span className="ml-2">{meal.items.length} items</span>
                                                    </p>
                                                </div>
                                                <div className="flex items-baseline gap-0.5 shrink-0">
                                                    <span className="text-base font-bold text-foreground">{mealTotals.calories}</span>
                                                    <span className="text-xs text-muted-foreground">kcal</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button
                                                        title="Duplicate meal"
                                                        className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleDuplicateMeal(meal.id); }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                                    </button>
                                                    <button
                                                        title="Delete meal"
                                                        className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteMeal(meal.id); }}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                    </ScrollShadow>
                    )}
                </div>

                <Separator className="my-2" />

                {/* Notes Section */}
                <Disclosure id="notes">
                    <Disclosure.Heading>
                        <Button
                            slot="trigger"
                            variant="ghost"
                            className="w-full justify-start gap-2 px-3 mb-2 data-hover:bg-transparent"
                        >
                            <Disclosure.Indicator />
                            <h3 className="text-base font-semibold text-foreground flex-1 text-left">Notes</h3>
                        </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                        <Disclosure.Body className="px-0 pt-0">
                            {selectedPlan.cycles.length > 0 && (() => {
                                const cycle = selectedPlan.cycles[selectedCycleIndex];
                                return (
                                    <textarea
                                        key={cycle.id + '-note'}
                                        defaultValue={cycle.note ?? ""}
                                        placeholder="Add a cycle note..."
                                        rows={3}
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val !== (cycle.note ?? "")) handleUpdateCycleNote(cycle.id, val);
                                        }}
                                        className="w-full mb-2 px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none resize-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                                    />
                                );
                            })()}
                        </Disclosure.Body>
                    </Disclosure.Content>
                </Disclosure>
            </div>
            </DisclosureGroup>
        </Surface>
        <Modal isOpen={activateModal} onOpenChange={(o) => !o && setActivateModal(false)}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>Activate & Mark as Done</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>
                            <p className="text-sm text-muted-foreground">
                                You will activate this nutrition plan for this client and mark the submission as <span className="font-medium text-emerald-600">Action Done</span>. Continue?
                            </p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="ghost" isDisabled={activating} onClick={() => setActivateModal(false)}>
                                Cancel
                            </Button>
                            <Button isDisabled={activating} onClick={() => handleActivateAndMark(false)}
                                className="border border-green-500/30 text-green-600 hover:bg-green-500/10">
                                {activating ? "Activating..." : "Activate & Stay Here"}
                            </Button>
                            <Button isDisabled={activating} onClick={() => handleActivateAndMark(true)}
                                className="bg-green-600 text-white hover:bg-green-700">
                                {activating ? "Activating..." : "Activate & Go to Queue"}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
        </>
    );
}
