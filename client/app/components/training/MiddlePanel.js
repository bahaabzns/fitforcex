import React, { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Modal } from "@heroui/react/modal";
import { TextArea } from "@heroui/react/textarea";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import InlineEditField from "@/app/components/InlineEditField";
import CardActionsMenu, { DuplicateIcon, TrashIcon } from "@/app/components/CardActionsMenu";

const StatusDot = () => (
    <svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true">
        <circle cx="3" cy="3" r="3" fill="currentColor" />
    </svg>
);


export default function MiddlePanel({
    selectedPlan,
    selectedDayId,
    handleSelectDay,
    handleCreateDay,
    handleDeleteDay,
    handleDuplicateDay,
    handleReorderDays,
    handleRenamePlan,
    handleRenameDay,
    handleUpdatePlanNotes,
    handleDeletePlan,
    handleDuplicatePlan,
    dirtyPlanIds,
    saveStatus,
    focusPlanNameSignal,
    newlyCreatedDayId,
    onClose,
    activateModal,
    setActivateModal,
    activating,
    handleActivateAndMark,
}) {
    const t = useTranslations('training');
    const tModal = useTranslations('modal');
    const tCommon = useTranslations('common');
    const [expandedKeys, setExpandedKeys] = useState(new Set(["days", "notes"]));
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const dragRef = useRef(null);
    const hoverRef = useRef(null);
    const planNameRef = useRef(null);
    const dayInputRefs = useRef({});

    useEffect(() => {
        if (focusPlanNameSignal > 0) planNameRef.current?.select();
    }, [focusPlanNameSignal]);

    useEffect(() => {
        if (newlyCreatedDayId) dayInputRefs.current[newlyCreatedDayId]?.select();
    }, [newlyCreatedDayId]);

    const isSelectedPlanDirty = dirtyPlanIds?.includes(String(selectedPlan.id));
    // Mirror the hook: a null selectedDayId means no day is open, so no day is
    // highlighted. Only fall back to the first day for a stale (deleted) id.
    const selectedDay = selectedDayId == null
        ? null
        : (selectedPlan.days?.find((d) => String(d.id) === String(selectedDayId)) ?? selectedPlan.days?.[0] ?? null);

    const currentDays = selectedPlan.days ?? [];
    const previewDays = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return currentDays;
        const arr = [...currentDays];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    return (
        <>
            <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-3 rounded-2xl">
                {/* Plan name + actions */}
                <div className="flex justify-between items-center mb-2 gap-3">
                    <InlineEditField
                        ref={planNameRef}
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
                        <Chip size="sm" color="warning" variant="soft" className="shrink-0">
                            <StatusDot />
                            <Chip.Label>{t('unsaved')}</Chip.Label>
                        </Chip>
                    )}
                    {!isSelectedPlanDirty && saveStatus === "saved" && (
                        <Chip size="sm" color="success" variant="soft" className="shrink-0">
                            <StatusDot />
                            <Chip.Label>{t('saved')}</Chip.Label>
                        </Chip>
                    )}

                    {onClose && (
                        <button
                            title={t('closePanel')}
                            onClick={onClose}
                            className="cursor-pointer p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    )}
                </div>

                <DisclosureGroup allowsMultipleExpanded expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

                {/* Days Section */}
                <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: expandedKeys.has("days") ? "1 1 0" : "0 0 auto" }}>
                <Disclosure id="days">
                    <Disclosure.Heading>
                        <div className="flex items-center gap-2 w-full mb-2">
                            <Button
                                slot="trigger"
                                variant="ghost"
                                className="flex-1 justify-start gap-2 px-3 data-hover:bg-transparent min-w-0"
                            >
                                <Disclosure.Indicator />
                                <h3 className="text-base font-semibold text-foreground">
                                    {t('daysSection')}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedPlan.days?.length ?? 0}</span>
                                </h3>
                            </Button>
                            {expandedKeys.has("days") && (
                                <Button variant="outline" onClick={handleCreateDay} className="shrink-0">
                                    {t('addDay')}
                                </Button>
                            )}
                        </div>
                    </Disclosure.Heading>
                </Disclosure>
                {expandedKeys.has("days") && (
                <ScrollShadow className="flex flex-col gap-2 px-1 py-1 flex-1 min-h-0" hideScrollBar>
                            {previewDays.map((day) => {
                                const originalIndex = currentDays.findIndex((d) => d.id === day.id);
                                const isDragging = dragIndex !== null && currentDays[dragIndex]?.id === day.id;
                                const isActive = String(day.id) === String(selectedDay?.id);
                                const setCount = (day.exercises ?? []).reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
                                return (
                                    <div
                                        key={day.id}
                                        draggable
                                        onDragStart={() => { setDragIndex(originalIndex); dragRef.current = originalIndex; }}
                                        onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragRef.current) { setHoverIndex(originalIndex); hoverRef.current = originalIndex; } }}
                                        onDrop={() => { handleReorderDays(dragRef.current, hoverRef.current); setDragIndex(null); setHoverIndex(null); dragRef.current = null; hoverRef.current = null; }}
                                        onDragEnd={() => { setDragIndex(null); setHoverIndex(null); dragRef.current = null; hoverRef.current = null; }}
                                        onClick={() => handleSelectDay(day.id)}
                                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer select-none shadow-surface transition-all duration-150 ${
                                            isDragging ? "opacity-30 scale-95" : ""
                                        } ${
                                            isActive ? "bg-primary/5 dark:bg-primary/15 ring-1 ring-primary/40" : "bg-card dark:bg-(--color-surface-secondary) hover:bg-default dark:hover:bg-(--color-surface-tertiary)"
                                        }`}
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
                                        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold transition-colors ${
                                            isActive ? "bg-primary/25 text-primary" : "bg-foreground/10 text-muted group-hover:text-foreground"
                                        }`}>
                                            {originalIndex + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                                                {day.name}
                                            </p>
                                            <p className="text-xs leading-5 text-muted truncate">
                                                {day.exercises?.length ?? 0} exercises · {setCount} sets
                                            </p>
                                        </div>
                                        <CardActionsMenu
                                            isActive={isActive}
                                            ariaLabel={t('dayOptions')}
                                            items={[
                                                { key: "duplicate", label: tCommon('duplicate'), icon: <DuplicateIcon />, onSelect: () => handleDuplicateDay(day.id) },
                                                { key: "delete", label: tCommon('delete'), icon: <TrashIcon />, danger: true, onSelect: () => handleDeleteDay(day.id) },
                                            ]}
                                        />
                                    </div>
                                );
                            })}
                            {currentDays.length === 0 && (
                                <Surface variant="default" className="rounded-lg p-6 flex items-center justify-center mx-2 my-2">
                                    <p className="text-sm text-muted-foreground">{t('noDaysYet')}</p>
                                </Surface>
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
                            <TextArea
                                key={selectedPlan.id + "-note"}
                                defaultValue={selectedPlan.notes ?? ""}
                                placeholder={t('planNoteHint')}
                                rows={3}
                                fullWidth
                                variant="secondary"
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val !== (selectedPlan.notes ?? "")) handleUpdatePlanNotes(selectedPlan.id, val);
                                }}
                                className="mb-2 resize-none"
                            />
                        </Disclosure.Body>
                    </Disclosure.Content>
                </Disclosure>
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
                                <Button type="button" variant="ghost" onClick={() => setActivateModal(false)}>
                                    {tModal('cancel')}
                                </Button>
                                <Button type="button" isDisabled={activating} onClick={() => handleActivateAndMark(false)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                    {activating ? t('working') : t('activateAndStay')}
                                </Button>
                                <Button type="button" variant="primary" isDisabled={activating} onClick={() => handleActivateAndMark(true)}>
                                    {t('activateAndGoToQueue')}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </>
    );
}
