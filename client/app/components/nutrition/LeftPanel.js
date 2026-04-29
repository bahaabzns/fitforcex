import { useState, useEffect } from "react";
import api from "@/lib/axios";
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

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
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
    handleActivatePlan,
    handleSaveAllDrafts,
    dirtyPlanIds,
    hasDeletedPlans,
    isDirty,
    isSaving,
    saveStatus,
    clientId,
}) {
    const [plansCollapsed, setPlansCollapsed] = useState(false);
    const [calcCollapsed, setCalcCollapsed]   = useState(false);
    const [formsCollapsed, setFormsCollapsed] = useState(false);

    const [formRequests, setFormRequests]     = useState([]);
    const [formsLoading, setFormsLoading]     = useState(true);
    const [expandedReq, setExpandedReq]       = useState(null);

    useEffect(() => {
        if (!clientId) return;
        api.get(`/api/forms/requests/client/${clientId}`)
            .then(res => setFormRequests(res.data ?? []))
            .catch(() => {})
            .finally(() => setFormsLoading(false));
    }, [clientId]);

    const currentCycle = selectedPlan?.cycles?.[selectedCycleIndex] ?? null;
    const dirtyPlanCount = dirtyPlanIds?.length ?? 0;
    const showSaveAll = dirtyPlanCount > 1 || hasDeletedPlans;

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
                                className="cursor-pointer h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                                onClick={handleCreatePlan}
                            >
                                + Create Plan
                            </button>
                        </div>
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
                                        const isPlanDirty = dirtyPlanIds?.includes(String(plan.id));
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
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-sm font-medium truncate ${isActive ? "text-blue-700" : "text-gray-800"}`}>
                                                            {plan.name}
                                                        </p>
                                                        {plan.status === 'active' && (
                                                            <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 text-xs font-semibold">
                                                                <CheckIcon /> Active
                                                            </span>
                                                        )}
                                                        {isPlanDirty && (
                                                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200/70">
                                                                Unsaved
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {plan.cycle_count} {plan.cycle_count === 1 ? "cycle" : "cycles"}
                                                        {" · "}
                                                        edited {formatRelativeTime(plan.updated_at)}
                                                    </p>
                                                </div>

                                                {/* Actions — appear on hover */}
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    {plan.status === 'active' ? (
                                                        <span
                                                            title="Active plan"
                                                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-xs font-semibold"
                                                        >
                                                            <CheckIcon /> Active
                                                        </span>
                                                    ) : (
                                                        <button
                                                            title="Activate plan for client"
                                                            className="cursor-pointer px-2 py-0.5 rounded-full border border-gray-300 text-gray-500 hover:border-green-500 hover:text-green-600 hover:bg-green-50 text-xs font-medium transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); handleActivatePlan(plan.id); }}
                                                        >
                                                            Activate
                                                        </button>
                                                    )}
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

            {/* Divider */}
            <div className="shrink-0 border-t border-gray-100 my-4" />

            {/* ── Form Submissions Section ── */}
            <div className="flex flex-col min-h-0" style={{ flex: formsCollapsed ? "0 0 auto" : "1 1 0" }}>
                <div className="flex items-center gap-3 mb-4 shrink-0">
                    <button
                        className="cursor-pointer p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                        onClick={() => setFormsCollapsed(f => !f)}
                    >
                        <ChevronIcon up={!formsCollapsed} />
                    </button>
                    <h2 className="text-base font-semibold text-gray-900 flex-1">
                        Form Submissions
                        {formRequests.filter(r => r.status === 'submitted').length > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-400">
                                {formRequests.filter(r => r.status === 'submitted').length}
                            </span>
                        )}
                    </h2>
                </div>

                {!formsCollapsed && (
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {formsLoading ? (
                            <div className="flex flex-col gap-2">
                                {[1,2].map(i => (
                                    <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                                ))}
                            </div>
                        ) : formRequests.filter(r => r.status === 'submitted').length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                                <svg className="w-8 h-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-xs font-medium text-gray-400">No submitted forms yet</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {formRequests.filter(r => r.status === 'submitted').map(req => {
                                    const isOpen = expandedReq === req.id;
                                    return (
                                        <div key={req.id} className="rounded-xl border border-gray-100 overflow-hidden">
                                            {/* Header row */}
                                            <button
                                                onClick={() => setExpandedReq(isOpen ? null : req.id)}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                                            >
                                                <span className="flex-1 text-sm font-medium text-gray-800 truncate">{req.form_title}</span>
                                                <span className="text-[10px] text-gray-400 shrink-0">
                                                    {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString() : ''}
                                                </span>
                                                <span className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                                                    <ChevronIcon up={false} />
                                                </span>
                                            </button>

                                            {/* Answers */}
                                            {isOpen && (
                                                <div className="px-3 pb-3 flex flex-col gap-2 border-t border-gray-100">
                                                    {req.responses?.length === 0 ? (
                                                        <p className="text-xs text-gray-400 pt-2">No responses recorded.</p>
                                                    ) : (
                                                        req.responses?.map((r, i) => (
                                                            <div key={i} className="pt-2">
                                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                                                                    {r.label}
                                                                </p>
                                                                <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                                                                    {r.answer || <span className="italic text-gray-300">—</span>}
                                                                </p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}