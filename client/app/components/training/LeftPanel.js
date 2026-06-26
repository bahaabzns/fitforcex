import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Chip } from "@heroui/react/chip";
import { Disclosure, DisclosureGroup, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import LoadPlanModal from "@/app/components/LoadPlanModal";
import CardActionsMenu, { DuplicateIcon, TrashIcon } from "@/app/components/CardActionsMenu";

const StatusDot = () => (
    <svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true">
        <circle cx="3" cy="3" r="3" fill="currentColor" />
    </svg>
);
const PlanIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>
    </svg>
);
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

export default function LeftPanel({
    plans,
    selectedPlan,
    handleSelectedPlan,
    handleCreatePlan,
    handleLoadPlan,
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
    const locale = useLocale();
    const t = useTranslations('training');
    const tCommon = useTranslations('common');
    const { formatDate } = useDateFormatter();
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

    const dirtyPlanCount = dirtyPlanIds?.length ?? 0;
    const showSaveAll = dirtyPlanCount > 1 || hasDeletedPlans;
    const submittedForms = formRequests.filter(r => r.status !== 'pending' && r.status !== 'scheduled');

    return (
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
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
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
                                            const isActive = String(selectedPlan?.id) === String(plan.id);
                                            const isPlanDirty = dirtyPlanIds?.includes(String(plan.id));
                                            return (
                                                <div
                                                    key={plan.id}
                                                    onClick={() => handleSelectedPlan(plan)}
                                                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer select-none shadow-surface transition-all duration-150 ${
                                                        isActive ? "bg-primary/5 dark:bg-primary/15 ring-1 ring-primary/40" : "bg-card dark:bg-(--color-surface-secondary) hover:bg-default dark:hover:bg-(--color-surface-tertiary)"
                                                    }`}
                                                >
                                                    <div className={`relative shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                                        isActive ? "bg-primary/25 text-primary" : "bg-foreground/10 text-muted group-hover:text-foreground"
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
                                                        <p className="text-xs leading-5 text-muted truncate">
                                                            {t('daysCount', { count: plan.day_count ?? plan.days?.length ?? 0 })}
                                                            {" · "}{t('edited')} {formatRelativeTime(plan.updated_at, tCommon)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {plan.status === "active" && (
                                                            <Chip size="sm" color="success" variant="soft" className="shrink-0">
                                                                <StatusDot />
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
                                    {[1, 2].map(i => (
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
                                                        req.responses.map((r, i) => (
                                                            <div key={i} className="pt-2">
                                                                <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">{getLocalizedField(r, 'label', locale)}</p>
                                                                <p className="text-xs text-foreground whitespace-pre-wrap">{r.answer || <span className="italic text-muted-foreground">No answer</span>}</p>
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

            <LoadPlanModal
                open={loadModalOpen}
                onClose={() => setLoadModalOpen(false)}
                type="training"
                onLoad={handleLoadPlan}
            />
        </Surface>
    );
}
