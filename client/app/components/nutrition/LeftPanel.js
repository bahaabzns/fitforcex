import { useState, useEffect, useMemo } from "react";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { useDateFormatter } from "@/utils/useDateFormatter";
import CycleCalculator from "./CycleCalculator";
import LoadPlanModal from "@/app/components/LoadPlanModal";
import CardActionsMenu, { DuplicateIcon, TrashIcon } from "@/app/components/CardActionsMenu";
import RelatedObservationsPanel from "@/app/components/RelatedObservationsPanel";
import ObservationModal from "@/app/components/ObservationModal";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Chip } from "@heroui/react/chip";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import { ProgressBar } from "@heroui/react/progress-bar";

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

const PlanIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>
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
    const { formatDate } = useDateFormatter();
    const [expandedKeys, setExpandedKeys] = useState(new Set(["plans"]));
    const [loadModalOpen, setLoadModalOpen] = useState(false);

    const [formRequests, setFormRequests] = useState([]);
    const [formsLoading, setFormsLoading] = useState(true);

    // Observations linked to any of this client's form submissions — fetched
    // once (relatedType=checkIn also returns assessments, see the API) and
    // grouped client-side by submission id, matching the same
    // fetch-once/bucket-client-side approach used for the count chips on
    // exercise/food-item rows.
    const [allFormObservations, setAllFormObservations] = useState([]);
    const [observationModalOpen, setObservationModalOpen] = useState(false);
    const [editingObservation, setEditingObservation] = useState(null);
    const [modalTargetRequest, setModalTargetRequest] = useState(null);
    const [me, setMe] = useState(null);

    useEffect(() => {
        if (!clientId) return;
        api.get(`/api/forms/requests/client/${clientId}`)
            .then(res => setFormRequests(res.data ?? []))
            .catch(() => {})
            .finally(() => setFormsLoading(false));

        api.get(`/api/clients/${clientId}/observations?relatedType=checkIn`)
            .then(res => setAllFormObservations(Array.isArray(res.data) ? res.data : []))
            .catch(() => setAllFormObservations([]));
    }, [clientId]);

    useEffect(() => {
        api.get('/api/auth/me').then(res => setMe(res.data)).catch(() => {});
    }, []);

    const observationsByRequestId = useMemo(() => {
        const map = {};
        for (const o of allFormObservations) {
            for (const ri of o.relatedItems ?? []) (map[ri.id] ??= []).push(o);
        }
        return map;
    }, [allFormObservations]);

    const currentCycle = selectedPlan?.cycles?.[selectedCycleIndex] ?? null;
    const dirtyPlanCount = dirtyPlanIds?.length ?? 0;
    const showSaveAll = dirtyPlanCount > 1 || hasDeletedPlans;
    const submittedForms = formRequests.filter(r => r.status !== 'pending' && r.status !== 'scheduled');

    return (
        <>
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-3 rounded-2xl">
            <DisclosureGroup allowsMultipleExpanded expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} className="flex flex-col flex-1 min-h-0">

            {/* ── Plans Section ── */}
            <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: expandedKeys.has("plans") ? "1 1 0" : "0 0 auto" }}>
                <Disclosure id="plans">
                    <Disclosure.Heading>
                        <div className="flex flex-wrap items-center gap-2 w-full mb-2">
                            <Button
                                slot="trigger"
                                variant="ghost"
                                className="flex-1 justify-start gap-2 px-3 data-hover:bg-transparent"
                            >
                                <Disclosure.Indicator />
                                <h2 className="text-base font-semibold text-foreground">
                                    {t('plans')}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">{plans.length}</span>
                                </h2>
                            </Button>
                            {expandedKeys.has("plans") && (
                                <div className="flex items-center gap-2 shrink-0">
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
                            <div className="flex gap-2 mb-3 shrink-0">
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
                                    <Surface variant="default" className="rounded-lg p-6 flex flex-col items-center justify-center gap-3 text-center mx-2 my-2">
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
                                    <div className="flex flex-col gap-2 px-1 py-1">
                                        {plans.map((plan) => {
                                            const isActive = selectedPlan?.id === plan.id;
                                            const isPlanDirty = dirtyPlanIds?.includes(String(plan.id));
                                            const isPlanActive = plan.status === 'active';
                                            // Package Lifecycle: the active plan's card is the single source of
                                            // truth for its cycle status -- omitted entirely when cycle_days/
                                            // cycle_end_at are null (activation predating this feature), never a
                                            // misleading placeholder (§12.4).
                                            const hasCycleProgress = isPlanActive && !!plan.cycle_days && !!plan.cycle_end_at;
                                            let currentDay = null, progressPercent = null;
                                            if (hasCycleProgress) {
                                                const daysRemaining = Math.ceil((new Date(plan.cycle_end_at).getTime() - Date.now()) / 86400000);
                                                currentDay = Math.min(plan.cycle_days, Math.max(1, plan.cycle_days - daysRemaining + 1));
                                                progressPercent = Math.min(100, Math.max(0, (currentDay / plan.cycle_days) * 100));
                                            }
                                            return (
                                                <div
                                                    key={plan.id}
                                                    onClick={() => handleSelectedPlan(plan)}
                                                    className={`group flex flex-col gap-2 px-3 py-2.5 cursor-pointer rounded-xl shadow-surface transition-all duration-150 ${
                                                        isActive
                                                            ? "bg-primary/5 dark:bg-primary/15 ring-1 ring-primary/40"
                                                            : "bg-card dark:bg-(--color-surface-secondary) hover:bg-default dark:hover:bg-(--color-surface-tertiary)"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`relative shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                                            isActive ? "bg-primary/25 text-primary" : "bg-foreground/10 text-muted-foreground group-hover:text-foreground"
                                                        }`}>
                                                            <PlanIcon />
                                                            {isPlanDirty && (
                                                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-card dark:ring-(--color-surface-secondary)" title={t('unsaved')} />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                                                                {plan.name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {plan.cycle_count} {t('cycles')}
                                                                {" · "}
                                                                {t('edited')} {formatRelativeTime(plan.updated_at, tCommon)}
                                                                {plan.last_edited_by_name && ` · ${t('editedBy', { name: plan.last_edited_by_name })}`}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {isPlanActive && (
                                                                <Chip size="sm" color="success" variant="soft" className="shrink-0">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                                                    <Chip.Label>{t('active')}</Chip.Label>
                                                                </Chip>
                                                            )}
                                                            <CardActionsMenu
                                                                isActive={isActive}
                                                                ariaLabel={t('planOptions')}
                                                                items={[
                                                                    { key: "duplicate", label: t('duplicatePlan'), icon: <DuplicateIcon />, onSelect: () => handleDuplicatePlan(plan.id) },
                                                                    { key: "delete", label: t('deletePlan'), icon: <TrashIcon />, danger: true, onSelect: () => handleDeletePlan(plan.id) },
                                                                ]}
                                                            />
                                                        </div>
                                                    </div>
                                                    {hasCycleProgress && (
                                                        <div className="pl-12 flex flex-col gap-1">
                                                            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                                                                <span>{t('planDayProgress', { current: currentDay, total: plan.cycle_days })}</span>
                                                                <span>{Math.round(progressPercent)}%</span>
                                                            </div>
                                                            <ProgressBar
                                                                value={progressPercent}
                                                                size="sm"
                                                                aria-label={t('planDayProgress', { current: currentDay, total: plan.cycle_days })}
                                                            >
                                                                <ProgressBar.Track>
                                                                    <ProgressBar.Fill />
                                                                </ProgressBar.Track>
                                                            </ProgressBar>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {t('planActivatedOn')} {formatDate(plan.activated_at)} • {t('planEndsOn')} {formatDate(plan.cycle_end_at)}
                                                            </p>
                                                        </div>
                                                    )}
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
                                <Surface variant="default" className="rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-center mx-2 my-1">
                                    <svg className="w-8 h-8 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-xs font-medium text-muted-foreground">{t('noSubmittedForms')}</p>
                                </Surface>
                            ) : (
                                <DisclosureGroup allowsMultipleExpanded className="flex flex-col gap-1.5">
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
                                                        {formatDate(req.submitted_at)}
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
                                                    <div className="pt-2 mt-1 border-t border-border">
                                                        <RelatedObservationsPanel
                                                            title={t('relatedObservations')}
                                                            addLabel={t('addObservation')}
                                                            emptyLabel={t('noRelatedObservations')}
                                                            observations={observationsByRequestId[req.id] ?? []}
                                                            clientId={clientId}
                                                            currentUserId={me?.userId}
                                                            isOwner={me?.currentWorkspace?.role === 'owner'}
                                                            onAddClick={() => { setEditingObservation(null); setModalTargetRequest(req); setObservationModalOpen(true); }}
                                                            onEdit={(obs) => { setEditingObservation(obs); setModalTargetRequest(req); setObservationModalOpen(true); }}
                                                            onDeleted={(deletedId) => setAllFormObservations(prev => prev.filter(x => x.id !== deletedId))}
                                                        />
                                                    </div>
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

            <ObservationModal
                open={observationModalOpen}
                onClose={() => setObservationModalOpen(false)}
                clientId={clientId}
                observation={editingObservation}
                initialRelatedItem={modalTargetRequest ? {
                    type: modalTargetRequest.form_type === 'assessment' ? 'assessment' : 'checkIn',
                    id: modalTargetRequest.id,
                    label: getLocalizedField(modalTargetRequest, 'form_title', locale),
                } : null}
                onCreated={(obs) => setAllFormObservations(prev => [obs, ...prev])}
                onUpdated={(updated) => setAllFormObservations(prev => prev.map(x => x.id === updated.id ? updated : x))}
            />
        </Surface>
        </>
    );
}
