import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Modal } from "@heroui/react/modal";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
);
const DuplicateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
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
    handleActivatePlan,
    handleSaveSelectedPlan,
    handleDeletePlan,
    handleDuplicatePlan,
    isSaving,
    saveStatus,
    dirtyPlanIds,
    submissionId,
    focusPlanNameSignal,
    newlyCreatedDayId,
    onClose,
}) {
    const router = useRouter();
    const t = useTranslations('training');
    const tModal = useTranslations('modal');
    const tCommon = useTranslations('common');
    const [activateModal, setActivateModal] = useState(false);
    const [activating, setActivating] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState(new Set(["days", "notes"]));
    const [dragIndex, setDragIndex] = useState(null);
    const [hoverIndex, setHoverIndex] = useState(null);
    const planNameRef = useRef(null);
    const dayInputRefs = useRef({});

    useEffect(() => {
        if (focusPlanNameSignal > 0) planNameRef.current?.select();
    }, [focusPlanNameSignal]);

    useEffect(() => {
        if (newlyCreatedDayId) dayInputRefs.current[newlyCreatedDayId]?.select();
    }, [newlyCreatedDayId]);

    const isSelectedPlanDirty = dirtyPlanIds?.includes(String(selectedPlan.id));
    const selectedDay = selectedPlan.days?.find((d) => String(d.id) === String(selectedDayId)) ?? selectedPlan.days?.[0] ?? null;

    const currentDays = selectedPlan.days ?? [];
    const previewDays = (() => {
        if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return currentDays;
        const arr = [...currentDays];
        const [moved] = arr.splice(dragIndex, 1);
        arr.splice(hoverIndex, 0, moved);
        return arr;
    })();

    async function handleActivateAndMark(navigateToQueue) {
        if (!selectedPlan?.id || !submissionId) return;
        setActivating(true);
        try {
            await handleActivatePlan(selectedPlan.id);
            await api.patch("/api/forms/queue/review", { ids: [submissionId], action: "review" });
            if (navigateToQueue) router.push("/plans-queue");
        } catch {
            // Silent: existing handlers show errors where needed.
        } finally {
            setActivating(false);
            setActivateModal(false);
        }
    }

    return (
        <>
            <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface">
                {/* Plan name + actions */}
                <div className="flex justify-between items-center mb-3 gap-4">
                    <input
                        ref={planNameRef}
                        key={selectedPlan.id}
                        type="text"
                        defaultValue={selectedPlan.name}
                        onBlur={(e) => {
                            const trimmed = e.target.value.trim() || t('untitledPlan');
                            e.target.value = trimmed;
                            if (trimmed !== selectedPlan.name) handleRenamePlan(selectedPlan.id, trimmed);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                            if (e.key === "Escape") { e.target.value = selectedPlan.name; e.target.blur(); }
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
                            {isSaving || saveStatus === "saving" ? t('saving') : t('savePlan')}
                        </Button>
                    )}
                    {selectedPlan.status !== "active" && (
                        <Button
                            type="button"
                            isDisabled={isSaving || activating}
                            onClick={() => { if (submissionId) { setActivateModal(true); return; } handleActivatePlan(selectedPlan.id); }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                        >
                            {activating ? t('activating') : t('activate')}
                        </Button>
                    )}
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

                    {onClose && (
                        <button
                            title={t('closePanel')}
                            onClick={onClose}
                            className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    )}
                </div>

                <DisclosureGroup expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

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
                                <Button variant="primary" onClick={handleCreateDay} className="shrink-0">
                                    {t('addDay')}
                                </Button>
                            )}
                        </div>
                    </Disclosure.Heading>
                </Disclosure>
                {expandedKeys.has("days") && (
                <ScrollShadow className="flex flex-col gap-2 flex-1 min-h-0" hideScrollBar>
                            {previewDays.map((day) => {
                                const originalIndex = currentDays.findIndex((d) => d.id === day.id);
                                const isDragging = dragIndex !== null && currentDays[dragIndex]?.id === day.id;
                                const isActive = String(day.id) === String(selectedDay?.id);
                                const setCount = (day.exercises ?? []).reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
                                return (
                                    <div
                                        key={day.id}
                                        draggable
                                        onDragStart={() => setDragIndex(originalIndex)}
                                        onDragOver={(e) => { e.preventDefault(); if (originalIndex !== dragIndex) setHoverIndex(originalIndex); }}
                                        onDrop={() => { handleReorderDays(dragIndex, hoverIndex); setDragIndex(null); setHoverIndex(null); }}
                                        onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
                                        onClick={() => handleSelectDay(day.id)}
                                        className={`group relative w-full text-left rounded-lg border px-3 py-3 transition-all cursor-pointer select-none ${
                                            isDragging ? "opacity-30 scale-95" : ""
                                        } ${
                                            isActive ? "bg-primary/10 border-primary/30" : "border-border hover:bg-default"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground/50 hover:text-muted-foreground cursor-grab shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                                                    <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                                                    <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
                                                    <circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/>
                                                </svg>
                                            </span>
                                            <div className="flex-1 min-w-0 pr-14">
                                                <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                                                    {day.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {day.exercises?.length ?? 0} exercises · {setCount} sets
                                                </p>
                                            </div>
                                        </div>
                                        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                title={tCommon('duplicate')}
                                                onClick={(e) => { e.stopPropagation(); handleDuplicateDay(day.id); }}
                                                className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
                                            >
                                                <DuplicateIcon />
                                            </button>
                                            <button
                                                title={tCommon('delete')}
                                                onClick={(e) => { e.stopPropagation(); handleDeleteDay(day.id); }}
                                                className="cursor-pointer p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {currentDays.length === 0 && (
                                <Surface variant="default" className="rounded-xl p-8 flex items-center justify-center mx-2 my-2">
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
                            <textarea
                                key={selectedPlan.id + "-note"}
                                defaultValue={selectedPlan.notes ?? ""}
                                placeholder={t('planNoteHint')}
                                rows={3}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val !== (selectedPlan.notes ?? "")) handleUpdatePlanNotes(selectedPlan.id, val);
                                }}
                                className="w-full mb-2 px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none resize-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
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
