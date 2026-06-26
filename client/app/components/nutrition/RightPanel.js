import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import MacrosDonut from "./MacrosDonut";
import InlineEditField from "@/app/components/InlineEditField";
import { calcMeal, calcItem } from "@/lib/nutritionCalc";
import { Button } from "@heroui/react/button";
import { TextArea } from "@heroui/react/textarea";
import { Disclosure, DisclosureGroup, NumberField, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import MacroStat from "./MacroStat";

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
    const t = useTranslations('nutrition');
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const dragRef = useRef(null);
    const hoverRef = useRef(null);
    const [expandedKeys, setExpandedKeys] = useState(new Set(["items", "notes"]));
    const [expandedItemIds, setExpandedItemIds] = useState(new Set());

    const mealTitleRef = useRef(null);
    const prevAltModalItemId = useRef(null);
    const altCountAtModalOpen = useRef(0);

    useEffect(() => {
        if (pendingFocusMealId && selectedMeal?.id === pendingFocusMealId) {
            mealTitleRef.current?.focus();
            mealTitleRef.current?.select();
            setPendingFocusMealId(null);
        }
    }, [pendingFocusMealId, selectedMeal?.id, setPendingFocusMealId]);

    // Reset item expansions when the meal changes.
    useEffect(() => { setExpandedItemIds(new Set()); }, [selectedMeal?.id]);

    // Auto-expand the just-edited item only if new alternatives were actually added.
    useEffect(() => {
        const prev = prevAltModalItemId.current;
        prevAltModalItemId.current = alternativeModalOpenForItemId;

        if (alternativeModalOpenForItemId) {
            // Modal just opened — snapshot current alt count for this item.
            const item = selectedMeal.items.find(i => i.id === alternativeModalOpenForItemId);
            altCountAtModalOpen.current = (item?.alternatives ?? []).length;
        } else if (prev) {
            // Modal just closed — expand only if count grew.
            const item = selectedMeal.items.find(i => i.id === prev);
            const newCount = (item?.alternatives ?? []).length;
            if (newCount > altCountAtModalOpen.current) {
                setExpandedItemIds(new Set([String(prev)]));
            }
        }
    }, [alternativeModalOpenForItemId, selectedMeal.items]);

    // Accordion handler: only one item open at a time.
    const handleItemExpandedChange = (newSet) => {
        const added = [...newSet].find(k => !expandedItemIds.has(k));
        setExpandedItemIds(added ? new Set([added]) : newSet);
    };

    const currentItems = selectedMeal.items;
    const previewItems = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return currentItems;
        const arr = [...currentItems];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-3 rounded-2xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-2 gap-3">
                <InlineEditField
                    ref={mealTitleRef}
                    key={selectedMeal.id}
                    value={selectedMeal.name}
                    fallback={t('untitledMeal')}
                    onCommit={(name) => handleRenameMeal(selectedMeal.id, name)}
                    ariaLabel="Meal name"
                    variant="primary"
                    className="flex-1 min-w-0"
                    inputClassName="font-semibold shadow-none"
                />
                <button
                    title={t('closePanel')}
                    className="cursor-pointer p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
                    onClick={() => setSelectedMeal(null)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            {/* Totals */}
            <div className="mb-2">
                <MacrosDonut
                    totals={calcMeal(selectedMeal)}
                    labels={{ carbs: t('carbs'), fat: t('fat'), protein: t('protein'), kcal: t('calories') }}
                />
            </div>

            <DisclosureGroup allowsMultipleExpanded expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

                {/* Food Items Section */}
                <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: expandedKeys.has("items") ? "1 1 0" : "0 0 auto" }}>
                    <Disclosure id="items">
                        <Disclosure.Heading>
                            <div className="flex items-center gap-2 w-full my-2">
                                <Button
                                    slot="trigger"
                                    variant="ghost"
                                    className="flex-1 justify-start gap-2 px-3 data-hover:bg-transparent min-w-0"
                                >
                                    <Disclosure.Indicator />
                                    <h3 className="text-base font-semibold text-foreground">
                                        {t('foodItems')}
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedMeal.items.length}</span>
                                    </h3>
                                </Button>
                                {expandedKeys.has("items") && (
                                    <Button variant="outline" onClick={() => setFoodItemModalOpen(true)}>
                                        {t('addFood')}
                                    </Button>
                                )}
                            </div>
                        </Disclosure.Heading>
                    </Disclosure>
                    {expandedKeys.has("items") && (
                    <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                <DisclosureGroup allowsMultipleExpanded expandedKeys={expandedItemIds} onExpandedChange={handleItemExpandedChange} className="divide-y divide-border py-2">
                                    {previewItems.map((item) => {
                                        const originalIndex = currentItems.findIndex(i => i.id === item.id);
                                        const isDragging = dragIndex !== null && currentItems[dragIndex]?.id === item.id;
                                        const alternatives = item.alternatives ?? [];
                                        const itemMacros = calcItem(item);
                                        return (
                                            <Disclosure key={item.id} id={String(item.id)} className="group/disc">
                                                <Disclosure.Heading>
                                                    <div
                                                        draggable
                                                        onDragStart={() => { setDragIndex(originalIndex); dragRef.current = originalIndex; }}
                                                        onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragRef.current) { setHoverIndex(originalIndex); hoverRef.current = originalIndex; } }}
                                                        onDrop={() => { handleReorderFoodItems(dragRef.current, hoverRef.current); setDragIndex(null); setHoverIndex(null); dragRef.current = null; hoverRef.current = null; }}
                                                        onDragEnd={() => { setDragIndex(null); setHoverIndex(null); dragRef.current = null; hoverRef.current = null; }}
                                                        className={`group flex items-center gap-2 px-3 py-2 select-none transition-all duration-150 hover:bg-default group-data-open/disc:bg-primary/10 group-data-open/disc:hover:bg-primary/15 ${isDragging ? "opacity-30 scale-95" : ""}`}
                                                    >
                                                        {/* Drag grip */}
                                                        <span className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0 select-none">
                                                            <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                                                                <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                                                <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                                                                <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                                                            </svg>
                                                        </span>

                                                        {/* Name + quantity stepper */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate text-foreground group-data-open/disc:text-primary">
                                                                {item.name}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <NumberField
                                                                    value={Number(item.amount) || 0}
                                                                    minValue={0}
                                                                    onChange={(val) => handleAmountChange(item.id, String(val ?? 0))}
                                                                    aria-label="Amount"
                                                                    variant="secondary"
                                                                >
                                                                    <NumberField.Group className="h-7 !flex items-center !rounded">
                                                                        <NumberField.Input className="w-16 py-0 px-1.5 text-center text-sm font-semibold" />
                                                                        <span className="pr-1.5 text-xs text-muted-foreground pointer-events-none select-none leading-none">{item.serving_unit}</span>
                                                                    </NumberField.Group>
                                                                </NumberField>
                                                            </div>
                                                            {alternatives.length > 0 && (
                                                                <Button
                                                                    slot="trigger"
                                                                    variant="ghost"
                                                                    title={alternatives.map(a => a.name).filter(Boolean).join(', ')}
                                                                    className="group/alttrigger mt-1 h-auto p-0 text-xs text-muted-foreground/70 hover:text-primary data-hover:bg-transparent cursor-pointer transition-colors font-normal justify-start leading-none"
                                                                >
                                                                    <span className="font-medium">{t('alternativesCount', { count: alternatives.length })}</span>
                                                                    <span className="text-muted-foreground/40 mx-1">·</span>
                                                                    <span>{alternatives.slice(0, 2).map(a => a.name).filter(Boolean).join(' · ')}{alternatives.length > 2 && ` +${alternatives.length - 2}`}</span>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5 shrink-0 transition-transform group-aria-expanded/alttrigger:rotate-180"><polyline points="6 9 12 15 18 9"/></svg>
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* Macro columns */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <MacroStat label={t('carbs')} value={itemMacros.carbs} color="text-primary" />
                                                            <MacroStat label={t('protein')} value={itemMacros.protein} color="text-orange-500" />
                                                            <MacroStat label={t('fat')} value={itemMacros.fats} color="text-amber-500" />
                                                            <MacroStat label={t('calories')} value={itemMacros.calories} strong width="w-14" />
                                                        </div>

                                                        {/* Actions column — fixed width so macro columns never shift */}
                                                        <div className="w-[72px] flex items-center justify-end gap-1.5 shrink-0">
                                                            <button
                                                                title={t('addAlternatives')}
                                                                className={`cursor-pointer flex items-center gap-1 w-[46px] px-1.5 py-1.5 rounded-lg text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors ${alternatives.length === 0 ? 'justify-center' : 'justify-start'}`}
                                                                onClick={() => setAlternativeModalOpenForItemId(item.id)}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                                                    <path d="M8 3L4 7l4 4"/><path d="M4 7h16"/>
                                                                    <path d="M16 21l4-4-4-4"/><path d="M20 17H4"/>
                                                                </svg>
                                                                {alternatives.length > 0 && (
                                                                    <span className="w-4 text-center text-[11px] font-medium tabular-nums leading-none">
                                                                        {alternatives.length}
                                                                    </span>
                                                                )}
                                                            </button>
                                                            <button
                                                                title={t('removeFoodItem')}
                                                                className="cursor-pointer p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                                onClick={() => handleDeleteMealItem(item.id)}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </Disclosure.Heading>
                                                {alternatives.length > 0 && expandedItemIds.has(String(item.id)) && (
                                                <Disclosure.Content>
                                                    <Disclosure.Body className="px-0 pt-0 pb-0">
                                                        <div className="ml-8 border-l-2 border-border/50 pl-3 pb-2 flex flex-col gap-1">
                                                            {alternatives.map((alt) => {
                                                                const altMacros = calcItem(alt);
                                                                return (
                                                                <div key={alt.id} className="group flex items-center gap-2 px-2 py-2.5 rounded-md hover:bg-default/60 transition-colors">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm text-foreground/75 truncate">{alt.name}</p>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <NumberField
                                                                                value={Number(alt.amount) || 0}
                                                                                minValue={0}
                                                                                onChange={(val) => handleAlternativeAmountChange(item.id, alt.id, String(val ?? 0))}
                                                                                aria-label="Amount"
                                                                                variant="secondary"
                                                                            >
                                                                                <NumberField.Group className="h-7 !flex items-center !rounded">
                                                                                    <NumberField.Input className="w-16 py-0 px-1.5 text-center text-sm font-medium" />
                                                                                    <span className="pr-1.5 text-xs text-muted-foreground/60 pointer-events-none select-none leading-none">{alt.serving_unit}</span>
                                                                                </NumberField.Group>
                                                                            </NumberField>
                                                                            {alt.calculated_amount != null && Number(alt.amount) !== Number(alt.calculated_amount) && (
                                                                                <button
                                                                                    title={t('resetToCalculated')}
                                                                                    className="cursor-pointer p-1.5 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                                                                                    onClick={() => handleAlternativeAmountChange(item.id, alt.id, String(alt.calculated_amount))}
                                                                                >
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                                                                                    </svg>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <MacroStat label={t('carbs')} value={altMacros.carbs} color="text-primary" />
                                                                        <MacroStat label={t('protein')} value={altMacros.protein} color="text-orange-500" />
                                                                        <MacroStat label={t('fat')} value={altMacros.fats} color="text-amber-500" />
                                                                        <MacroStat label={t('calories')} value={altMacros.calories} strong width="w-14" />
                                                                    </div>
                                                                    <button
                                                                        title={t('removeAlternative')}
                                                                        className="cursor-pointer p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                                                        onClick={() => handleDeleteAlternative(item.id, alt.id)}
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                                                    </button>
                                                                </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </Disclosure.Body>
                                                </Disclosure.Content>
                                                )}
                                            </Disclosure>
                                        );
                                    })}
                                </DisclosureGroup>
                    </ScrollShadow>
                    )}
                </div>

                <Separator className="my-2" />

                {/* Meal Notes Section */}
                <div className="flex flex-col shrink-0">
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
                                <TextArea
                                    key={selectedMeal.id + '-note'}
                                    defaultValue={selectedMeal.note ?? ""}
                                    placeholder={t('addMealNote')}
                                    rows={3}
                                    fullWidth
                                    variant="secondary"
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val !== (selectedMeal.note ?? "")) {
                                            handleUpdateMealNote(selectedMeal.id, val);
                                        }
                                    }}
                                    className="mb-2 resize-none"
                                />
                            </Disclosure.Body>
                        </Disclosure.Content>
                    </Disclosure>
                </div>

            </DisclosureGroup>
        </Surface>
    );
}
