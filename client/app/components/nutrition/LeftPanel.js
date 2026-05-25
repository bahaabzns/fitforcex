import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import CycleCalculator from "./CycleCalculator";
import LoadPlanModal from "@/app/components/LoadPlanModal";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Chip } from "@heroui/react/chip";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";

function formatRelativeTime(dateStr, t) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays === 1) return t('yesterday');
    if (diffDays < 7) return t('daysAgo', { count: diffDays });
    if (diffDays < 30) return t('weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('monthsAgo', { count: Math.floor(diffDays / 30) });
    return t('yearsAgo', { count: Math.floor(diffDays / 365) });
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

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);

export default function LeftPanel({
    plans,
    selectedPlan,
    handleCreatePlan,
    handleLoadPlan,
    handleSelectedPlan,
    handleDeletePlan, handleDuplicatePlan,
    sortOrder, setSortOrder,
    selectedCycleIndex,
    handleUpdateCycleGoals,
    handleSaveAllDrafts,
    dirtyPlanIds,
    hasDeletedPlans,
    isDirty,
    isSaving,
    saveStatus,
    clientId,
}) {
    const locale = useLocale();
    const t = useTranslations('nutrition');
    const tCommon = useTranslations('common');
    const [expandedKeys, setExpandedKeys] = useState(new Set(["plans"]));
    const [loadModalOpen, setLoadModalOpen] = useState(false);

    const [formRequests, setFormRequests] = useState([]);
    const [formsLoading, setFormsLoading] = useState(true);

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
    const submittedForms = formRequests.filter(r => r.status !== 'pending' && r.status !== 'scheduled');

    return (
        <>
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
                                    {t('plans')}
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
                                            {isSaving || saveStatus === "saving" ? t('saving') : saveStatus === "saved" ? t('saved') : t('saveAll')}
                                        </Button>
                                    )}
                                    <Button variant="outline" onClick={() => setLoadModalOpen(true)}>
                                        {t('loadPlan')}
                                    </Button>
                                    <Button variant="primary" onClick={handleCreatePlan}>
                                        {t('newPlan')}
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
                                    { value: "created_desc", label: t('newest') },
                                    { value: "created_asc",  label: t('oldest') },
                                    { value: "updated_desc", label: t('lastEdited') },
                                ].map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => setSortOrder(value)}
                                        className={`cursor-pointer text-xs px-3 py-1 rounded-full border transition-colors ${
                                            sortOrder === value
                                                ? "bg-primary border-primary text-white"
                                                : "border-border text-muted-foreground hover:border-border hover:bg-default"
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
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">{t('noPlanYet')}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{t('createFirstPlan')}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => setLoadModalOpen(true)}>
                                                {t('loadPlan')}
                                            </Button>
                                            <Button variant="primary" onClick={handleCreatePlan}>
                                                {t('newPlan')}
                                            </Button>
                                        </div>
                                    </Surface>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {plans.map((plan) => {
                                            const isActive = selectedPlan?.id === plan.id;
                                            const isPlanDirty = dirtyPlanIds?.includes(String(plan.id));
                                            return (
                                                <div
                                                    key={plan.id}
                                                    onClick={() => handleSelectedPlan(plan)}
                                                    className={`group flex items-center gap-3 px-3 py-3 cursor-pointer rounded-lg transition-all duration-150 ${
                                                        isActive
                                                            ? "bg-primary/10 border border-primary/30"
                                                            : "hover:bg-default border border-transparent"
                                                    }`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-primary" : "bg-border group-hover:bg-muted-foreground"}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                                                                {plan.name}
                                                            </p>
                                                            {plan.status === 'active' && (
                                                                <Chip size="sm" className="bg-green-500/15 text-green-600 shrink-0">
                                                                    <span className="flex items-center gap-0.5"><CheckIcon /> {t('active')}</span>
                                                                </Chip>
                                                            )}
                                                            {isPlanDirty && (
                                                                <Chip size="sm" className="bg-amber-500/15 text-amber-600 border border-amber-500/20 shrink-0">
                                                                    {t('unsaved')}
                                                                </Chip>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {plan.cycle_count} {t('cycles')}
                                                            {" · "}
                                                            {t('edited')} {formatRelativeTime(plan.updated_at, tCommon)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            title={t('duplicatePlan')}
                                                            className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-default transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); handleDuplicatePlan(plan.id); }}
                                                        >
                                                            <DuplicateIcon />
                                                        </button>
                                                        <button
                                                            title={t('deletePlan')}
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
                                {t('formSubmissions')}
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
                                    {[1,2].map(i => (
                                        <Skeleton key={i} className="h-14 rounded-lg" />
                                    ))}
                                </div>
                            ) : submittedForms.length === 0 ? (
                                <Surface variant="default" className="rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center mx-2 my-1">
                                    <svg className="w-8 h-8 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-xs font-medium text-muted-foreground">{t('noSubmittedForms')}</p>
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
                                                    className="w-full justify-start gap-2 px-3 py-2.5 data-hover:bg-default rounded-none"
                                                >
                                                    <span className="flex-1 text-sm font-medium text-foreground truncate text-left">{getLocalizedField(req, 'form_title', locale)}</span>
                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                        {req.submitted_at ? new Date(req.submitted_at).toLocaleDateString() : ''}
                                                    </span>
                                                    <Disclosure.Indicator className="shrink-0" />
                                                </Button>
                                            </Disclosure.Heading>
                                            <Disclosure.Content>
                                                <Disclosure.Body className="px-3 pb-3 flex flex-col gap-2 border-t border-border pt-0">
                                                    {!req.responses?.length ? (
                                                        <p className="text-xs text-muted-foreground pt-2">{t('noResponses')}</p>
                                                    ) : (
                                                        req.responses?.map((r, i) => (
                                                            <div key={i} className="pt-2">
                                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                                                    {getLocalizedField(r, 'label', locale)}
                                                                </p>
                                                                <p className="text-xs text-foreground bg-secondary rounded-lg px-3 py-2 whitespace-pre-wrap">
                                                                    {r.answer || <span className="italic text-muted-foreground/40">—</span>}
                                                                </p>
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

            <Separator className="my-2" />

            {/* ── Calorie Calculator Section ── */}
            <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: expandedKeys.has("calc") ? "1 1 0" : "0 0 auto" }}>
                <Disclosure id="calc">
                    <Disclosure.Heading>
                        <Button
                            slot="trigger"
                            variant="ghost"
                            className="w-full justify-start gap-2 px-3 mb-2 data-hover:bg-transparent"
                        >
                            <Disclosure.Indicator />
                            <h2 className="text-base font-semibold text-foreground flex-1 text-left">{t('calorieCalculator')}</h2>
                        </Button>
                    </Disclosure.Heading>
                </Disclosure>
                {expandedKeys.has("calc") && (
                <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                            {currentCycle ? (
                                <CycleCalculator
                                    cycle={currentCycle}
                                    onApply={(goals) => handleUpdateCycleGoals(currentCycle.id, goals)}
                                />
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-6">
                                    {t('selectPlanAndCycle')}
                                </p>
                            )}
                </ScrollShadow>
                )}
            </div>

            </DisclosureGroup>

            <LoadPlanModal
                open={loadModalOpen}
                onClose={() => setLoadModalOpen(false)}
                type="nutrition"
                onLoad={handleLoadPlan}
            />
        </Surface>
        </>
    );
}
