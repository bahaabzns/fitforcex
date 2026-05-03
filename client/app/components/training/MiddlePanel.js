import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";

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
const ChevronIcon = ({ up }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
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
    const [activateModal, setActivateModal] = useState(false);
    const [activating, setActivating] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [daysCollapsed, setDaysCollapsed] = useState(false);
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
            <div className="card w-full flex flex-col overflow-hidden min-h-full">
                {/* Plan name + actions */}
                <div className="flex justify-between items-center mb-3 gap-4">
                    <input
                        ref={planNameRef}
                        key={selectedPlan.id}
                        type="text"
                        defaultValue={selectedPlan.name}
                        onBlur={(e) => {
                            const trimmed = e.target.value.trim() || "Untitled Plan";
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
                        <button
                            type="button"
                            onClick={() => handleSaveSelectedPlan(selectedPlan.id)}
                            disabled={isSaving}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                                isSaving ? "bg-secondary text-muted-foreground cursor-not-allowed" : "bg-primary hover:bg-primary/90 text-white cursor-pointer"
                            }`}
                        >
                            {isSaving || saveStatus === "saving" ? "Saving..." : "Save Plan"}
                        </button>
                    )}
                    {selectedPlan.status !== "active" && (
                        <button
                            type="button"
                            onClick={() => { if (submissionId) { setActivateModal(true); return; } handleActivatePlan(selectedPlan.id); }}
                            disabled={isSaving || activating}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                                isSaving || activating ? "bg-secondary text-muted-foreground cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer"
                            }`}
                        >
                            {activating ? "Activating..." : "Activate"}
                        </button>
                    )}
                    {isSelectedPlanDirty && (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0">
                            Unsaved
                        </span>
                    )}
                    {!isSelectedPlanDirty && saveStatus === "saved" && (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                            Saved
                        </span>
                    )}

                    {onClose && (
                        <button
                            title="Close panel"
                            onClick={onClose}
                            className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    )}
                </div>

                {/* Days header */}
                <div className="flex items-center gap-3 mb-3 shrink-0">
                    <button
                        className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        onClick={() => setDaysCollapsed(v => !v)}
                    >
                        <ChevronIcon up={!daysCollapsed} />
                    </button>
                    <h3 className="text-base font-semibold text-foreground flex-1">
                        Days
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedPlan.days?.length ?? 0}</span>
                    </h3>
                    {!daysCollapsed && (
                        <button
                            onClick={handleCreateDay}
                            className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                            + Add Day
                        </button>
                    )}
                </div>

                {/* Days list */}
                {daysCollapsed ? null : <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
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
                                    isActive ? "bg-primary/10 border-primary/30" : "border-border hover:bg-accent"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    {/* Drag grip */}
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
                                {/* Hover actions */}
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        title="Duplicate day"
                                        onClick={(e) => { e.stopPropagation(); handleDuplicateDay(day.id); }}
                                        className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
                                    >
                                        <DuplicateIcon />
                                    </button>
                                    <button
                                        title="Delete day"
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
                        <div className="text-center py-10 text-sm text-muted-foreground">No days yet</div>
                    )}
                </div>}

                {/* Divider between Meals and Notes */}
                <div className="shrink-0 border-t border-border my-2" />

                {/* Notes Section */}
                <div className="flex flex-col shrink-0">
                    <div className="flex items-center gap-3 mb-3">
                        <button
                            className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            onClick={() => setNotesOpen(n => !n)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points={notesOpen ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                            </svg>
                        </button>
                        <h3 className="text-base font-semibold text-foreground">Notes</h3>
                    </div>
                    {!notesOpen && (
                        <textarea
                            key={selectedPlan.id + "-note"}
                            defaultValue={selectedPlan.notes ?? ""}
                            placeholder="Add a cycle note..."
                            rows={3}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                if (val !== (selectedPlan.notes ?? "")) handleUpdatePlanNotes(selectedPlan.id, val);
                                }}
                                className="w-full mb-2 px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none resize-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                            />
                        )}
                </div>
            </div>

            {activateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40" onClick={() => setActivateModal(false)}>
                    <div className="bg-card rounded-lg shadow-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-base font-semibold text-foreground mb-2">Activate & Mark as Done</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            You will activate this training plan and mark the submission as <span className="font-medium text-emerald-600">Action Done</span>.
                        </p>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => handleActivateAndMark(false)} disabled={activating}
                                className="h-9 px-3 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer disabled:opacity-50">
                                {activating ? "Working..." : "Activate & Stay Here"}
                            </button>
                            <button type="button" onClick={() => handleActivateAndMark(true)} disabled={activating}
                                className="h-9 px-3 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-white cursor-pointer disabled:opacity-50">
                                Activate & Go to Queue
                            </button>
                            <button type="button" onClick={() => setActivateModal(false)}
                                className="h-9 px-3 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-accent cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
