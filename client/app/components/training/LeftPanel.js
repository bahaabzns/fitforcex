import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Chip } from "@heroui/react/chip";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";

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
    const [expandedKeys, setExpandedKeys] = useState(new Set(["plans"]));

    const [formRequests, setFormRequests] = useState([]);
    const [formsLoading, setFormsLoading] = useState(true);

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
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-[min(32px,var(--radius-3xl))] shadow-surface">
            <DisclosureGroup expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

            {/* ── Plans Section ── */}
            <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: expandedKeys.has("plans") ? "1 1 0" : "0 0 auto" }}>
                <Disclosure id="plans">
                    <Disclosure.Heading>
                        <div className="flex items-center gap-2 w-full mb-2">
                            <Button
                                slot="trigger"
                                variant="ghost"
                                className="flex-1 justify-start gap-2 px-3 data-hover:bg-transparent min-w-0"
                            >
                                <Disclosure.Indicator />
                                <h2 className="text-base font-semibold text-foreground">
                                    Plans
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">{plans.length}</span>
                                </h2>
                            </Button>
                            {expandedKeys.has("plans") && (
                                <div className="flex items-center gap-2 shrink-0">
                                    {showSaveAll && (
                                        <Button
                                            variant="outline"
                                            isDisabled={!isDirty || isSaving}
                                            onClick={handleSaveAllDrafts}
                                        >
                                            {isSaving || saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save All"}
                                        </Button>
                                    )}
                                    <Button variant="primary" onClick={handleCreatePlan}>
                                        + Create Plan
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Disclosure.Heading>
                </Disclosure>
                {expandedKeys.has("plans") && (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
                            <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                {plans.length === 0 ? (
                                    <Surface variant="default" className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center mx-2 my-2">
                                        <svg className="w-10 h-10 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                        </svg>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">No plans yet</p>
                                            <p className="text-xs text-muted-foreground mt-1">Create your first training plan</p>
                                        </div>
                                        <Button variant="primary" onClick={handleCreatePlan}>
                                            + Create Plan
                                        </Button>
                                    </Surface>
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
                                                                <Chip size="sm" className="bg-green-500/15 text-green-600 shrink-0">
                                                                    <span className="flex items-center gap-0.5"><CheckIcon /> Active</span>
                                                                </Chip>
                                                            )}
                                                            {isPlanDirty && (
                                                                <Chip size="sm" className="bg-amber-500/15 text-amber-600 border border-amber-500/20 shrink-0">
                                                                    Unsaved
                                                                </Chip>
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
                            </ScrollShadow>
                </div>
                )}
            </div>

            <Separator className="my-2" />

            {/* ── Form Submissions Section ── */}
            <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: expandedKeys.has("forms") ? "1 1 0" : "0 0 auto" }}>
                <Disclosure id="forms">
                    <Disclosure.Heading>
                        <Button
                            slot="trigger"
                            variant="ghost"
                            className="w-full justify-start gap-2 px-3 mb-2 data-hover:bg-transparent"
                        >
                            <Disclosure.Indicator />
                            <h2 className="text-base font-semibold text-foreground flex-1 text-left">
                                Form Submissions
                                {submittedForms.length > 0 && (
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">{submittedForms.length}</span>
                                )}
                            </h2>
                        </Button>
                    </Disclosure.Heading>
                </Disclosure>
                {expandedKeys.has("forms") && (
                <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                            {formsLoading ? (
                                <div className="flex flex-col gap-2">
                                    {[1, 2].map(i => (
                                        <Skeleton key={i} className="h-14 rounded-lg" />
                                    ))}
                                </div>
                            ) : submittedForms.length === 0 ? (
                                <Surface variant="default" className="rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center mx-2 my-1">
                                    <svg className="w-8 h-8 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-xs font-medium text-muted-foreground">No submitted forms yet</p>
                                </Surface>
                            ) : (
                                <DisclosureGroup className="flex flex-col gap-1.5">
                                    {submittedForms.map(req => (
                                        <Disclosure
                                            key={req.id}
                                            id={String(req.id)}
                                            className="rounded-lg border border-border overflow-hidden"
                                        >
                                            <Disclosure.Heading>
                                                <Button
                                                    slot="trigger"
                                                    variant="ghost"
                                                    className="w-full justify-start gap-2 px-3 py-2.5 data-hover:bg-accent rounded-none"
                                                >
                                                    <span className="flex-1 text-sm font-medium text-foreground truncate text-left">{req.form_title}</span>
                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                        {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString() : ''}
                                                    </span>
                                                    <Disclosure.Indicator className="shrink-0" />
                                                </Button>
                                            </Disclosure.Heading>
                                            <Disclosure.Content>
                                                <Disclosure.Body className="px-3 pb-3 flex flex-col gap-2 border-t border-border pt-0">
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
                                                </Disclosure.Body>
                                            </Disclosure.Content>
                                        </Disclosure>
                                    ))}
                                </DisclosureGroup>
                            )}
                </ScrollShadow>
                )}
            </div>

            </DisclosureGroup>
        </Surface>
    );
}
