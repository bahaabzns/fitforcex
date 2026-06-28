import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import MacrosDonut from "./MacrosDonut";
import InlineEditField from "@/app/components/InlineEditField";
import { calcCycle, calcMeal } from "@/lib/nutritionCalc";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Modal } from "@heroui/react/modal";
import { TextArea } from "@heroui/react/textarea";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import MacroStat from "./MacroStat";
import CardActionsMenu, { DuplicateIcon, TrashIcon } from "../CardActionsMenu";

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
    dirtyPlanIds,
    saveStatus,
    pendingFocusPlanId, setPendingFocusPlanId,
    pendingFocusCycleId, setPendingFocusCycleId,
    activateModal,
    setActivateModal,
    activating,
    handleActivateAndMark,
}) {
    const t = useTranslations('nutrition');
    const tModal = useTranslations('modal');
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const [cycleDragIndex, setCycleDragIndex] = useState(null);
    const [cycleHoverIndex, setCycleHoverIndex] = useState(null);
    const dragRef = useRef(null);
    const hoverRef = useRef(null);
    const cycleDragRef = useRef(null);
    const cycleHoverRef = useRef(null);
    const [expandedKeys, setExpandedKeys] = useState(new Set(["meals", "notes"]));

    const planTitleRef = useRef(null);
    const cycleTitleRef = useRef(null);

    useEffect(() => {
        if (pendingFocusPlanId && selectedPlan?.id === pendingFocusPlanId) {
            planTitleRef.current?.focus();
            planTitleRef.current?.select();
            setPendingFocusPlanId(null);
        }
    }, [pendingFocusPlanId, selectedPlan?.id, setPendingFocusPlanId]);

    // When the coach switches to a different plan, focus the meals section:
    // collapse cycles and leave meals (and notes) open. Done as a during-render
    // adjustment (not an effect) so it applies before paint without cascading.
    const prevPlanIdRef = useRef(selectedPlan?.id);
    if (prevPlanIdRef.current !== selectedPlan?.id) {
        prevPlanIdRef.current = selectedPlan?.id;
        setExpandedKeys(new Set(["meals", "notes"]));
    }

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

    return (
        <>
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-3 rounded-2xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-2 gap-3">
                <InlineEditField
                    ref={planTitleRef}
                    key={selectedPlan.id}
                    value={selectedPlan.name}
                    fallback={t('untitledPlan')}
                    onCommit={(name) => handleRenamePlan(selectedPlan.id, name)}
                    ariaLabel="Plan name"
                    variant="primary"
                    className="flex-1 min-w-0"
                    inputClassName="font-semibold shadow-none"
                />
                {isSelectedPlanDirty && (
                    <Chip size="sm" className="bg-amber-500/15 text-amber-600 border border-amber-500/20 shrink-0">
                        {t('unsaved')}
                    </Chip>
                )}
                {!isSelectedPlanDirty && saveStatus === "saved" && (
                    <Chip size="sm" className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 shrink-0">
                        {t('saved')}
                    </Chip>
                )}
                <button
                    title={t('closePanel')}
                    className="cursor-pointer p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
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
                        <div className="flex items-center mb-2 gap-3 shrink-0">
                            <InlineEditField
                                ref={cycleTitleRef}
                                key={cycle.id}
                                value={cycle.name}
                                fallback={t('untitledCycle')}
                                onCommit={(name) => handleRenameCycle(cycle.id, name)}
                                ariaLabel="Cycle name"
                                variant="primary"
                                className="flex-1 min-w-0"
                                inputClassName="font-semibold shadow-none"
                            />
                        </div>
                        <Surface variant="secondary" className="rounded-lg p-3 mb-2 shrink-0">
                            <MacrosDonut
                                totals={cycleTotals}
                                labels={{ carbs: t('carbs'), fat: t('fat'), protein: t('protein'), kcal: t('calories') }}
                                goals={{
                                    calories: cycle.goal_calories,
                                    carbs:    cycle.goal_carbs,
                                    protein:  cycle.goal_protein,
                                    fats:     cycle.goal_fats,
                                }}
                            />
                        </Surface>
                    </>
                );
            })()}

            <DisclosureGroup allowsMultipleExpanded expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

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
                                {t('cyclesSection')}
                                <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedPlan.cycles.length}</span>
                                {!expandedKeys.has("cycles") && selectedPlan.cycles.length > 0 && (
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">· {selectedPlan.cycles[selectedCycleIndex]?.name}</span>
                                )}
                            </h3>
                        </Button>
                        {expandedKeys.has("cycles") && (
                            <Button variant="outline" onClick={handleCreateCycle} className="shrink-0">
                                {t('addCycle')}
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
                                            onDragStart={() => { setCycleDragIndex(originalIndex); cycleDragRef.current = originalIndex; }}
                                            onDragOver={(e) => { e.preventDefault(); if (originalIndex !== cycleDragRef.current) { setCycleHoverIndex(originalIndex); cycleHoverRef.current = originalIndex; } }}
                                            onDrop={() => { handleReorderCycles(cycleDragRef.current, cycleHoverRef.current); setCycleDragIndex(null); setCycleHoverIndex(null); cycleDragRef.current = null; cycleHoverRef.current = null; }}
                                            onDragEnd={() => { setCycleDragIndex(null); setCycleHoverIndex(null); cycleDragRef.current = null; cycleHoverRef.current = null; }}
                                            className={`group flex items-center gap-1 rounded-full pl-2.5 pr-1.5 h-9 text-sm font-semibold transition-all cursor-grab select-none ${
                                                isDragging ? "opacity-30 scale-95" : ""
                                            } ${
                                                isActive
                                                    ? "bg-primary text-white"
                                                    : "bg-card text-muted-foreground border border-border hover:border-border hover:bg-default"
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
                                                    title={t('duplicateCycle')}
                                                    className={`cursor-pointer p-1 rounded-full transition-colors ${isActive ? "hover:bg-primary/70" : "hover:bg-secondary"}`}
                                                    onClick={(e) => { e.stopPropagation(); handleDuplicateCycle(planCycle.id); }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                                </button>
                                                <button
                                                    title={t('deleteCycle')}
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
                                        {t('mealsSection')}
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedPlan.cycles[selectedCycleIndex].meals.length}</span>
                                    </h3>
                                </Button>
                                {expandedKeys.has("meals") && (
                                    <Button variant="outline" onClick={handleCreateMeal} className="shrink-0">
                                        {t('addMeal')}
                                    </Button>
                                )}
                            </div>
                        </Disclosure.Heading>
                    </Disclosure>
                    {expandedKeys.has("meals") && (
                    <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                {selectedPlan.cycles.length === 0 ? (
                                    <Surface variant="default" className="rounded-lg p-6 flex items-center justify-center mx-2 my-2">
                                        <p className="text-sm text-muted-foreground">{t('noMealsYet')}</p>
                                    </Surface>
                                ) : (
                                    <div className="flex flex-col gap-2 px-1 py-1">
                                    {previewMeals.map((meal) => {
                                        const originalIndex = currentMeals.findIndex(m => m.id === meal.id);
                                        const isDragging = dragIndex !== null && currentMeals[dragIndex]?.id === meal.id;
                                        const mealTotals = calcMeal(meal);
                                        const isSelected = selectedMeal && selectedMeal.id === meal.id;
                                        return (
                                            <div
                                                key={meal.id}
                                                draggable
                                                onDragStart={() => { setDragIndex(originalIndex); dragRef.current = originalIndex; }}
                                                onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragRef.current) { setHoverIndex(originalIndex); hoverRef.current = originalIndex; } }}
                                                onDrop={() => { handleReorderMeals(dragRef.current, hoverRef.current); setDragIndex(null); setHoverIndex(null); dragRef.current = null; hoverRef.current = null; }}
                                                onDragEnd={() => { setDragIndex(null); setHoverIndex(null); dragRef.current = null; hoverRef.current = null; }}
                                                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer select-none shadow-surface transition-all duration-150 ${
                                                    isDragging ? "opacity-30 scale-95" : ""
                                                } ${
                                                    isSelected
                                                        ? "bg-primary/5 dark:bg-primary/15 ring-1 ring-primary/40"
                                                        : "bg-card dark:bg-(--color-surface-secondary) hover:bg-default dark:hover:bg-(--color-surface-tertiary)"
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
                                                    <p className="text-xs text-muted-foreground mt-1">{meal.items.length} {t('items')}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <MacroStat label={t('carbs')} value={mealTotals.carbs} color="text-primary" />
                                                    <MacroStat label={t('protein')} value={mealTotals.protein} color="text-orange-500" />
                                                    <MacroStat label={t('fat')} value={mealTotals.fats} color="text-amber-500" />
                                                    <MacroStat label={t('calories')} value={mealTotals.calories} strong width="w-14" />
                                                </div>
                                                <CardActionsMenu
                                                    isActive={isSelected}
                                                    ariaLabel={t('mealOptions')}
                                                    items={[
                                                        { key: "duplicate", label: t('duplicateMeal'), icon: <DuplicateIcon />, onSelect: () => handleDuplicateMeal(meal.id) },
                                                        { key: "delete", label: t('deleteMeal'), icon: <TrashIcon />, danger: true, onSelect: () => handleDeleteMeal(meal.id) },
                                                    ]}
                                                />
                                            </div>
                                        );
                                    })}
                                    </div>
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
                            <h3 className="text-base font-semibold text-foreground flex-1 text-left">{t('notes')}</h3>
                        </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                        <Disclosure.Body className="px-0 pt-0">
                            {selectedPlan.cycles.length > 0 && (() => {
                                const cycle = selectedPlan.cycles[selectedCycleIndex];
                                return (
                                    <TextArea
                                        key={cycle.id + '-note'}
                                        defaultValue={cycle.note ?? ""}
                                        placeholder={t('cycleNoteHint')}
                                        rows={3}
                                        fullWidth
                                        variant="secondary"
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val !== (cycle.note ?? "")) handleUpdateCycleNote(cycle.id, val);
                                        }}
                                        className="mb-2 resize-none"
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
                            <Modal.Heading>{t('activateModalTitle')}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>
                            <p className="text-sm text-muted-foreground">
                                {t('activateModalBody')}
                            </p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="ghost" isDisabled={activating} onClick={() => setActivateModal(false)}>
                                {tModal('cancel')}
                            </Button>
                            <Button isDisabled={activating} onClick={() => handleActivateAndMark(false)}
                                className="border border-green-500/30 text-green-600 hover:bg-green-500/10">
                                {activating ? t('activating') : t('activateAndStay')}
                            </Button>
                            <Button isDisabled={activating} onClick={() => handleActivateAndMark(true)}
                                className="bg-green-600 text-white hover:bg-green-700">
                                {activating ? t('activating') : t('activateAndGoToQueue')}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
        </>
    );
}
