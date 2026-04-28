import { useState } from "react";
import CycleCalculator from "./CycleCalculator";

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

const DuplicateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
);

const ChevronIcon = ({ up }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
    </svg>
);

export default function LeftPanel({
    plans,
    selectedPlan,
    handleCreatePlan, handleSelectedPlan,
    handleDeletePlan, handleDuplicatePlan,
    sortOrder, setSortOrder,
    selectedCycleIndex,
    handleUpdateCycleGoals,
}) {
    const [plansCollapsed, setPlansCollapsed] = useState(false);
    const [calcCollapsed, setCalcCollapsed] = useState(false);

    const currentCycle = selectedPlan?.cycles?.[selectedCycleIndex] ?? null;

    return (
        <div className="card w-full flex flex-col overflow-hidden min-h-full">

            {/* ── Plans Section ── */}
            <div className="flex flex-col min-h-0" style={{ flex: plansCollapsed ? "0 0 auto" : "1 1 0" }}>

                {/* Plans Header */}
                <div className="flex items-center gap-3 mb-4 shrink-0">
                    <button
                        className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        onClick={() => setPlansCollapsed(p => !p)}
                    >
                        <ChevronIcon up={!plansCollapsed} />
                    </button>
                    <h2 className="text-base font-semibold text-gray-900 flex-1">
                        Plans
                        <span className="ml-2 text-xs font-normal text-gray-400">{plans.length}</span>
                    </h2>
                    {!plansCollapsed && (
                        <button
                            className="cursor-pointer h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                            onClick={handleCreatePlan}
                        >
                            + Create Plan
                        </button>
                    )}
                </div>

                {!plansCollapsed && (
                    <>
                        {/* Sort Pills */}
                        <div className="flex gap-2 mb-4 shrink-0">
                            {[
                                { value: "created_desc", label: "Newest" },
                                { value: "created_asc",  label: "Oldest" },
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

                        {/* Plans List */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                            {plans.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
                                    <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">No plans yet</p>
                                        <p className="text-xs text-gray-400 mt-1">Create your first nutrition plan</p>
                                    </div>
                                    <button
                                        className="cursor-pointer h-8 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                                        onClick={handleCreatePlan}
                                    >
                                        + Create Plan
                                    </button>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {plans.map((plan) => {
                                        const isActive = selectedPlan?.id === plan.id;
                                        return (
                                            <div
                                                key={plan.id}
                                                onClick={() => handleSelectedPlan(plan)}
                                                className={`group flex items-center gap-3 px-3 py-3 cursor-pointer rounded-xl transition-all duration-150 ${
                                                    isActive
                                                        ? "bg-blue-50 border border-blue-200"
                                                        : "hover:bg-gray-50 border border-transparent"
                                                }`}
                                            >
                                                {/* Active indicator dot */}
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-blue-500" : "bg-gray-200 group-hover:bg-gray-300"}`} />

                                                {/* Name + meta */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${isActive ? "text-blue-700" : "text-gray-800"}`}>
                                                        {plan.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {plan.cycle_count} {plan.cycle_count === 1 ? "cycle" : "cycles"}
                                                        {" · "}
                                                        edited {formatRelativeTime(plan.updated_at)}
                                                    </p>
                                                </div>

                                                {/* Actions — appear on hover */}
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button
                                                        title="Duplicate plan"
                                                        className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleDuplicatePlan(plan.id); }}
                                                    >
                                                        <DuplicateIcon />
                                                    </button>
                                                    <button
                                                        title="Delete plan"
                                                        className="cursor-pointer p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Divider */}
            <div className="shrink-0 border-t border-gray-100 my-4" />

            {/* ── Calorie Calculator Section ── */}
            <div className="flex flex-col min-h-0" style={{ flex: calcCollapsed ? "0 0 auto" : "1 1 0" }}>
                <div className="flex items-center gap-3 mb-4 shrink-0">
                    <button
                        className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        onClick={() => setCalcCollapsed(c => !c)}
                    >
                        <ChevronIcon up={!calcCollapsed} />
                    </button>
                    <h2 className="text-base font-semibold text-gray-900 flex-1">Calorie Calculator</h2>
                </div>

                {!calcCollapsed && (
                    <div className="overflow-y-auto flex-1 min-h-0">
                        {currentCycle ? (
                            <CycleCalculator
                                cycle={currentCycle}
                                onApply={(goals) => handleUpdateCycleGoals(currentCycle.id, goals)}
                            />
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-6">
                                Select a plan and cycle to use the calculator
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}