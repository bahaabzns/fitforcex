import { useState, useEffect } from "react";
import api from "@/lib/axios";

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
    clientId,
}) {
    const [plansCollapsed, setPlansCollapsed] = useState(false);
    const [formsCollapsed, setFormsCollapsed] = useState(true);

    const [formRequests, setFormRequests] = useState([]);
    const [formsLoading, setFormsLoading] = useState(true);
    const [expandedReq, setExpandedReq]   = useState(null);

    useEffect(() => {
        if (!clientId) return;
        api.get(`/api/forms/requests/client/${clientId}`)
            .then(res => setFormRequests(res.data ?? []))
            .catch(() => {})
            .finally(() => setFormsLoading(false));
    }, [clientId]);

    const dirtyPlanCount = dirtyPlanIds?.length ?? 0;
    const showSaveAll = dirtyPlanCount > 1 || hasDeletedPlans;
    const submittedForms = formRequests.filter(r => r.status !== 'pending' && r.status !== 'scheduled');

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
                        Training Plans
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
                                + Create
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
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">No plans yet</p>
                                        <p className="text-xs text-gray-400 mt-1">Create your first training plan</p>
                                    </div>
                                    <button
                                        className="cursor-pointer h-8 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                                        onClick={handleCreatePlan}
                                    >
                                        + Create
                                    </button>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {plans.map((plan) => {
                                        const isActive = String(selectedPlan?.id) === String(plan.id);
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
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-blue-500" : "bg-gray-200 group-hover:bg-gray-300"}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-sm font-medium truncate ${isActive ? "text-blue-700" : "text-gray-800"}`}>
                                                            {plan.name}
                                                        </p>
                                                        {plan.status === "active" && (
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
                                                        {plan.day_count ?? plan.days?.length ?? 0}{" "}
                                                        {(plan.day_count ?? plan.days?.length ?? 0) === 1 ? "day" : "days"}
                                                        {" · "}edited {formatRelativeTime(plan.updated_at)}
                                                    </p>
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
                        {submittedForms.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-400">{submittedForms.length}</span>
                        )}
                    </h2>
                </div>

                {!formsCollapsed && (
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {formsLoading ? (
                            <div className="flex flex-col gap-2">
                                {[1, 2].map(i => (
                                    <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                                ))}
                            </div>
                        ) : submittedForms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                                <svg className="w-8 h-8 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-xs font-medium text-gray-400">No submitted forms yet</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {submittedForms.map(req => {
                                    const isOpen = expandedReq === req.id;
                                    return (
                                        <div key={req.id} className="rounded-xl border border-gray-100 overflow-hidden">
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
                                            {isOpen && (
                                                <div className="px-3 pb-3 flex flex-col gap-2 border-t border-gray-100">
                                                    {!req.responses?.length ? (
                                                        <p className="text-xs text-gray-400 pt-2">No responses recorded.</p>
                                                    ) : (
                                                        req.responses.map((r, i) => (
                                                            <div key={i} className="pt-2">
                                                                <p className="text-[11px] font-semibold text-gray-500 mb-0.5">{r.question_text}</p>
                                                                <p className="text-xs text-gray-700 whitespace-pre-wrap">{r.answer_text || <span className="italic text-gray-400">No answer</span>}</p>
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
