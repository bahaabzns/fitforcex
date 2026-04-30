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
                <div className="flex items-center gap-2 mb-3">
                    <input
                        ref={planNameRef}
                        value={selectedPlan.name}
                        onChange={(e) => handleRenamePlan(selectedPlan.id, e.target.value)}
                        className="text-xl font-bold text-gray-900 bg-transparent focus:outline-none border-b border-transparent focus:border-blue-300 min-w-0 flex-1"
                    />
                    <button
                        title="Duplicate plan"
                        onClick={() => handleDuplicatePlan(selectedPlan.id)}
                        className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                    >
                        <DuplicateIcon />
                    </button>
                    <button
                        title="Delete plan"
                        onClick={() => handleDeletePlan(selectedPlan.id)}
                        className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    >
                        <TrashIcon />
                    </button>
                    {onClose && (
                        <button
                            title="Close panel"
                            onClick={onClose}
                            className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 ml-auto"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    )}
                </div>

                {/* Save + Activate */}
                <div className="flex items-center gap-2 mb-4">
                    <button
                        onClick={() => handleSaveSelectedPlan(selectedPlan.id)}
                        disabled={isSaving || !isSelectedPlanDirty}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                            isSaving || !isSelectedPlanDirty
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                        }`}
                    >
                        {isSaving || saveStatus === "saving" ? "Saving..." : "Save"}
                    </button>
                    {selectedPlan.status !== "active" && (
                        <button
                            onClick={() => {
                                if (submissionId) { setActivateModal(true); return; }
                                handleActivatePlan(selectedPlan.id);
                            }}
                            disabled={isSaving || activating}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                isSaving || activating
                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                    : "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer"
                            }`}
                        >
                            {activating ? "Activating..." : "Activate"}
                        </button>
                    )}
                </div>

                {/* Days header */}
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">
                        Days <span className="text-gray-400 font-normal">({selectedPlan.days?.length ?? 0})</span>
                    </h3>
                    <button
                        onClick={handleCreateDay}
                        className="h-7 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                        + Add Day
                    </button>
                </div>

                {/* Days list */}
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
                    {(selectedPlan.days ?? []).map((day) => {
                        const isActive = String(day.id) === String(selectedDay?.id);
                        const setCount = (day.exercises ?? []).reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
                        return (
                            <div
                                key={day.id}
                                onClick={() => handleSelectDay(day.id)}
                                className={`group relative w-full text-left rounded-xl border px-3 py-3 transition-colors cursor-pointer ${
                                    isActive ? "bg-blue-50 border-blue-200" : "border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                <input
                                    ref={(el) => { dayInputRefs.current[day.id] = el; }}
                                    value={day.name}
                                    onChange={(e) => handleRenameDay(day.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none pr-16"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {day.exercises?.length ?? 0} exercises · {setCount} sets
                                </p>
                                {/* Hover actions */}
                                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        title="Duplicate day"
                                        onClick={(e) => { e.stopPropagation(); handleDuplicateDay(day.id); }}
                                        className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors"
                                    >
                                        <DuplicateIcon />
                                    </button>
                                    <button
                                        title="Delete day"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteDay(day.id); }}
                                        className="cursor-pointer p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {(selectedPlan.days ?? []).length === 0 && (
                        <div className="text-center py-10 text-sm text-gray-400">No days yet</div>
                    )}
                </div>

                {/* Plan Notes — collapsible at bottom */}
                <div className="shrink-0 border-t border-gray-100 mt-4 pt-3">
                    <button
                        onClick={() => setNotesOpen(o => !o)}
                        className="cursor-pointer flex items-center gap-2 w-full text-left"
                    >
                        <span className="text-xs font-semibold text-gray-500 flex-1">Plan Notes</span>
                        <ChevronIcon up={notesOpen} />
                    </button>
                    {notesOpen && (
                        <textarea
                            value={selectedPlan.notes ?? ""}
                            onChange={(e) => handleUpdatePlanNotes(selectedPlan.id, e.target.value)}
                            rows={3}
                            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
                            placeholder="Add notes about this training plan..."
                        />
                    )}
                </div>
            </div>

            {activateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40" onClick={() => setActivateModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">Activate & Mark as Done</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            You will activate this training plan and mark the submission as <span className="font-medium text-emerald-600">Action Done</span>.
                        </p>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => handleActivateAndMark(false)} disabled={activating}
                                className="h-9 px-3 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer disabled:opacity-50">
                                {activating ? "Working..." : "Activate & Stay Here"}
                            </button>
                            <button type="button" onClick={() => handleActivateAndMark(true)} disabled={activating}
                                className="h-9 px-3 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white cursor-pointer disabled:opacity-50">
                                Activate & Go to Queue
                            </button>
                            <button type="button" onClick={() => setActivateModal(false)}
                                className="h-9 px-3 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
