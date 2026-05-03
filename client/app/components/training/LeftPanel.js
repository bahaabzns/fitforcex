import { useState, useEffect } from "react";
import api from "@/lib/axios";

const ChevronIcon = ({ up }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
    </svg>
);

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
    handleDeletePlan,
    handleDuplicatePlan,
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
                        className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        onClick={() => setPlansCollapsed(p => !p)}
                    >
                        <ChevronIcon up={!plansCollapsed} />
                    </button>
                    <h2 className="text-base font-semibold text-foreground flex-1">
                        Plans
                        <span className="ml-2 text-xs font-normal text-muted-foreground">{plans.length}</span>
                    </h2>
                    {!plansCollapsed && (
                        <div className="flex items-center gap-2">
                            {showSaveAll && (
                                <button
                                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                        !isDirty || isSaving
                                            ? "bg-secondary text-muted-foreground cursor-not-allowed"
                                            : "bg-card border border-border text-foreground hover:bg-accent cursor-pointer"
                                    }`}
                                    onClick={handleSaveAllDrafts}
                                    disabled={!isDirty || isSaving}
                                >
                                    {isSaving || saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save All"}
                                </button>
                            )}
                            <button
                                className="cursor-pointer h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors"
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
                                            ? "bg-primary border-primary text-white"
                                            : "border-border text-muted-foreground hover:border-border hover:bg-accent"
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
                                    <svg className="w-10 h-10 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
                                        <p className="text-xs text-muted-foreground mt-1">Create your first training plan</p>
                                    </div>
                                    <button
                                        className="cursor-pointer h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors"
                                        onClick={handleCreatePlan}
                                    >
                                        + Create Plan
                                    </button>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {plans.map((plan) => {
                                        const isActive = String(selectedPlan?.id) === String(plan.id);
                                        const isPlanDirty = dirtyPlanIds?.includes(String(plan.id));
                                        return (
                                            <div
                                                key={plan.id}
                                                onClick={() => handleSelectedPlan(plan)}
                                                className={`group flex items-center gap-3 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150 ${
                                                    isActive
                                                        ? "bg-primary/10 border border-primary/30"
                                                        : "hover:bg-accent border border-transparent"
                                                }`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-primary" : "bg-border group-hover:bg-muted-foreground"}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
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
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {plan.day_count ?? plan.days?.length ?? 0}{" "}
                                                        {(plan.day_count ?? plan.days?.length ?? 0) === 1 ? "day" : "days"}
                                                        {" · "}edited {formatRelativeTime(plan.updated_at)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button
                                                        title="Duplicate plan"
                                                        className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleDuplicatePlan(plan.id); }}
                                                    >
                                                        <DuplicateIcon />
                                                    </button>
                                                    <button
                                                        title="Delete plan"
                                                        className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
            <div className="shrink-0 border-t border-border my-4" />

            {/* ── Form Submissions Section ── */}
            <div className="flex flex-col min-h-0" style={{ flex: formsCollapsed ? "0 0 auto" : "1 1 0" }}>
                <div className="flex items-center gap-3 mb-4 shrink-0">
                    <button
                        className="cursor-pointer p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        onClick={() => setFormsCollapsed(f => !f)}
                    >
                        <ChevronIcon up={!formsCollapsed} />
                    </button>
                    <h2 className="text-base font-semibold text-foreground flex-1">
                        Form Submissions
                        {submittedForms.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{submittedForms.length}</span>
                        )}
                    </h2>
                </div>

                {!formsCollapsed && (
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {formsLoading ? (
                            <div className="flex flex-col gap-2">
                                {[1, 2].map(i => (
                                    <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
                                ))}
                            </div>
                        ) : submittedForms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                                <svg className="w-8 h-8 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-xs font-medium text-muted-foreground">No submitted forms yet</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {submittedForms.map(req => {
                                    const isOpen = expandedReq === req.id;
                                    return (
                                        <div key={req.id} className="rounded-lg border border-border overflow-hidden">
                                            <button
                                                onClick={() => setExpandedReq(isOpen ? null : req.id)}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors cursor-pointer"
                                            >
                                                <span className="flex-1 text-sm font-medium text-foreground truncate">{req.form_title}</span>
                                                <span className="text-[10px] text-muted-foreground shrink-0">
                                                    {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString() : ''}
                                                </span>
                                                <span className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                                                    <ChevronIcon up={false} />
                                                </span>
                                            </button>
                                            {isOpen && (
                                                <div className="px-3 pb-3 flex flex-col gap-2 border-t border-border">
                                                    {!req.responses?.length ? (
                                                        <p className="text-xs text-muted-foreground pt-2">No responses recorded.</p>
                                                    ) : (
                                                        req.responses.map((r, i) => (
                                                            <div key={i} className="pt-2">
                                                                <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">{r.question_text}</p>
                                                                <p className="text-xs text-foreground whitespace-pre-wrap">{r.answer_text || <span className="italic text-muted-foreground">No answer</span>}</p>
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
