import React from "react";

function formatRelativeTime(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

export default function LeftPanel({
    plans,
    selectedPlan,
    handleSelectedPlan,
    handleCreatePlan,
    sortOrder,
    setSortOrder,
    handleSaveAllDrafts,
    dirtyPlanIds,
    hasDeletedPlans,
    isDirty,
    isSaving,
    saveStatus,
}) {
    const dirtyPlanCount = dirtyPlanIds?.length ?? 0;
    const showSaveAll = dirtyPlanCount > 1 || hasDeletedPlans;

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">
                    Training Plans
                    <span className="ml-2 text-xs font-normal text-gray-400">{plans.length}</span>
                </h2>
                <div className="flex items-center gap-2">
                    {showSaveAll && (
                        <button
                            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                !isDirty || isSaving
                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                            }`}
                            onClick={handleSaveAllDrafts}
                            disabled={!isDirty || isSaving}
                        >
                            {isSaving || saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save All"}
                        </button>
                    )}
                    <button
                        onClick={handleCreatePlan}
                        className="h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                        + Create
                    </button>
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                {[
                    { value: "created_desc", label: "Newest" },
                    { value: "created_asc", label: "Oldest" },
                    { value: "updated_desc", label: "Last Edited" },
                ].map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => setSortOrder(value)}
                        className={`cursor-pointer text-xs px-3 py-1 rounded-full border transition-colors ${
                            sortOrder === value
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100">
                {plans.map((plan) => {
                    const isActive = String(selectedPlan?.id) === String(plan.id);
                    const isPlanDirty = dirtyPlanIds?.includes(String(plan.id));
                    return (
                        <button
                            key={plan.id}
                            onClick={() => handleSelectedPlan(plan)}
                            className={`w-full text-left px-3 py-3 transition-colors rounded-lg ${
                                isActive ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium truncate ${isActive ? "text-blue-700" : "text-gray-800"}`}>{plan.name}</p>
                                {plan.status === "active" && (
                                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-700 font-semibold">Active</span>
                                )}
                                {isPlanDirty && (
                                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-50 text-amber-700 border border-amber-200">Unsaved</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {plan.day_count ?? plan.days?.length ?? 0} {(plan.day_count ?? plan.days?.length ?? 0) === 1 ? "day" : "days"}
                                {" · "}edited {formatRelativeTime(plan.updated_at)}
                            </p>
                        </button>
                    );
                })}

                {plans.length === 0 && (
                    <div className="text-center py-12 text-sm text-gray-400">No training plans yet</div>
                )}
            </div>
        </div>
    );
}
