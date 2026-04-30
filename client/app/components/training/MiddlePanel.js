import React, { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";

export default function MiddlePanel({
    selectedPlan,
    selectedDayId,
    handleSelectDay,
    handleCreateDay,
    handleRenamePlan,
    handleRenameDay,
    handleUpdatePlanNotes,
    handleUpdateDayNotes,
    handleActivatePlan,
    handleSaveSelectedPlan,
    isSaving,
    saveStatus,
    dirtyPlanIds,
    submissionId,
}) {
    const router = useRouter();
    const [activateModal, setActivateModal] = useState(false);
    const [activating, setActivating] = useState(false);

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
                <div className="flex items-center justify-between mb-3 gap-3">
                    <input
                        value={selectedPlan.name}
                        onChange={(e) => handleRenamePlan(selectedPlan.id, e.target.value)}
                        className="text-xl font-bold text-gray-900 bg-transparent focus:outline-none border-b border-transparent focus:border-blue-300 min-w-0 flex-1"
                    />
                    <div className="flex items-center gap-2">
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
                                    if (submissionId) {
                                        setActivateModal(true);
                                        return;
                                    }
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
                </div>

                <div className="mb-3">
                    <label className="text-xs font-medium text-gray-500">Plan Notes</label>
                    <textarea
                        value={selectedPlan.notes ?? ""}
                        onChange={(e) => handleUpdatePlanNotes(selectedPlan.id, e.target.value)}
                        rows={2}
                        className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
                        placeholder="Add notes about this training plan..."
                    />
                </div>

                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">Days ({selectedPlan.days?.length ?? 0})</h3>
                    <button
                        onClick={handleCreateDay}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                    >
                        + Add Day
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
                    {(selectedPlan.days ?? []).map((day) => {
                        const isActive = String(day.id) === String(selectedDay?.id);
                        const setCount = (day.exercises ?? []).reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
                        return (
                            <button
                                key={day.id}
                                onClick={() => handleSelectDay(day.id)}
                                className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                                    isActive ? "bg-blue-50 border-blue-200" : "border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                <input
                                    value={day.name}
                                    onChange={(e) => handleRenameDay(day.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">{day.exercises?.length ?? 0} exercises · {setCount} total sets</p>
                            </button>
                        );
                    })}
                </div>

                {selectedDay && (
                    <div className="mt-3">
                        <label className="text-xs font-medium text-gray-500">Day Notes</label>
                        <textarea
                            value={selectedDay.notes ?? ""}
                            onChange={(e) => handleUpdateDayNotes(selectedDay.id, e.target.value)}
                            rows={2}
                            className="w-full mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-300"
                            placeholder="Add notes for this day..."
                        />
                    </div>
                )}
            </div>

            {activateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40" onClick={() => setActivateModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">Activate & Mark as Done</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            You will activate this training plan and mark the submission as <span className="font-medium text-emerald-600">Action Done</span>.
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => handleActivateAndMark(false)}
                                disabled={activating}
                                className="h-9 px-3 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer disabled:opacity-50"
                            >
                                {activating ? "Working..." : "Activate & Stay Here"}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleActivateAndMark(true)}
                                disabled={activating}
                                className="h-9 px-3 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white cursor-pointer disabled:opacity-50"
                            >
                                Activate & Go to Queue
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivateModal(false)}
                                className="h-9 px-3 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
