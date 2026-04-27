import { useState, useRef } from "react";
import CycleCalculator from "./CycleCalculator";

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString("en-GB", { month: "short" });
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    const hour12 = hours % 12 || 12;
    return `${day} ${month} ${year} at ${hour12}:${minutes} ${ampm}`;
}

function formatRelativeTime(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
}

export default function LeftPanel ({
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
    const [splitPct, setSplitPct] = useState(60);
    const containerRef = useRef(null);

    const currentCycle = selectedPlan?.cycles?.[selectedCycleIndex] ?? null;

    const handleDividerMouseDown = (e) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const onMouseMove = (moveEvent) => {
            const rect = container.getBoundingClientRect();
            const pct = ((moveEvent.clientY - rect.top) / rect.height) * 100;
            setSplitPct(Math.min(85, Math.max(15, pct)));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <div ref={containerRef} className="card w-full flex flex-col overflow-hidden min-h-full">
            {/* Plans Section */}
            <div className="flex flex-col min-h-0" style={{ flex: plansCollapsed ? '0 0 auto' : calcCollapsed ? '1 1 0' : `0 0 ${splitPct}%` }}>
                {/* Plans Header */}
                <div
                    className="flex gap-4 justify-start items-center mb-4 shrink-0 cursor-pointer select-none"
                    onClick={() => setPlansCollapsed(p => !p)}
                >
                    <div className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points={plansCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                        </svg>
                    </div>
                    <div className="flex-1 flex gap-2 items-center">
                        <h2 className="text-xl font-bold">Plans</h2>
                        <p className="text-sm text-gray-600 shrink-0">({plans.length} plans)</p>
                    </div>
                    {!plansCollapsed && (
                        <button
                            className={`cursor-pointer h-9 min-w-9 rounded-full px-3 text-sm font-semibold transition-colors ${
                                        "bg-blue-500 text-white border border-gray-200 hover:border-gray-300 hover:bg-blue-600"
                            }`}
                            onClick={(e) => { e.stopPropagation(); handleCreatePlan(); }}
                        >
                            + Create Plan
                        </button>
                    )}
                </div>

            {/* Sorting */}
            {!plansCollapsed && (
            <div className="flex gap-2 mb-4 shrink-0">
                {/* <span className="text-sm text-gray-500 flex items-center">Sort:</span> */}
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
                                : "border-gray-300 text-gray-500 hover:border-gray-400"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            )}

            {/* Plans List */}
            {!plansCollapsed && (
            <div className="flex-1 overflow-y-auto min-h-0 p-1">
                {plans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                        <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                            <p className="font-semibold text-gray-500">No plans yet</p>
                            <p className="text-sm text-gray-400 mt-1">Create your first nutrition plan to get started</p>
                        </div>
                        <button
                            className="btn btn-primary px-6"
                            onClick={() => handleCreatePlan()}
                        >
                            + Create Plan
                        </button>
                    </div>
                ) : plans.map((plan) => (
                <div
                    key={plan.id}
                    onClick={() => handleSelectedPlan(plan)}
                    className={`card px-6 py-4 mb-2 cursor-pointer transition-all duration-150 group ${selectedPlan && selectedPlan.id === plan.id ? "bg-blue-50 ring-2 ring-blue-200 shadow-sm" : "bg-gray-100"}`}
                >
                    {/* Row 1: index + name + status */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${plan.status === "active" ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"}`}>
                            {plan.status}
                        </span>
                        <h3 className="flex-1 text-lg font-bold truncate">{plan.name}</h3>
                        
                        
                    {/* Row 3: action buttons */}
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                            title="Duplicate plan"
                            className="cursor-pointer p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleDuplicatePlan(plan.id); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                        <button
                            title="Delete plan"
                            className="cursor-pointer p-2 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:border-red-300 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                        </button>
                    </div>
                    </div>

                    {/* Row 2: cycle count + created date */}
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                        <span>{plan.cycle_count} {plan.cycle_count === 1 ? "cycle" : "cycles"}</span>
                        <span>·</span>
                        <span title={formatDate(plan.created_at)}>Created {formatRelativeTime(plan.created_at)}</span>
                        <span>·</span>
                        <span title={formatDate(plan.updated_at)}>Edited {formatRelativeTime(plan.updated_at)}</span>
                    </div>

                </div>
                ))}
            </div>
            )}
            </div>

            {/* Drag Divider */}
            <div
                className="shrink-0 h-2 flex items-center justify-center cursor-row-resize group my-1"
                onMouseDown={handleDividerMouseDown}
            >
                <div className="w-10 h-1 rounded-full bg-gray-200 group-hover:bg-blue-400 transition-colors duration-150" />
            </div>

            {/* Calculator Section */}
            <div className="flex flex-col min-h-0" style={{ flex: calcCollapsed ? '0 0 auto' : plansCollapsed ? '1 1 0' : `0 0 ${100 - splitPct}%` }}>
                <div
                    className="flex gap-2 items-center mb-3 shrink-0 cursor-pointer select-none"
                    onClick={() => setCalcCollapsed(c => !c)}
                >
                    <div className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points={calcCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/>
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold">Calorie Calculator</h2>
                </div>
                {!calcCollapsed && (
                    <div className="overflow-y-auto flex-1 min-h-0">
                        {currentCycle ? (
                            <CycleCalculator
                                cycle={currentCycle}
                                onApply={(goals) => handleUpdateCycleGoals(currentCycle.id, goals)}
                            />
                        ) : (
                            <p className="text-sm text-gray-400 text-center py-4">Select a plan and cycle to use the calculator</p>
                        )}
                    </div>
                )}
            </div>

        </div>
    )
}