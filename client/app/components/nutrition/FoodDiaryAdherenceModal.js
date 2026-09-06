"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BookOpen } from "lucide-react";
import { Tabs } from "@heroui/react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import Modal from "@/app/components/Modal";
import AreaChart from "@/app/components/charts/AreaChart";
import { adherenceChipColor } from "@/utils/adherence";
import { localizedFoodName } from "@/utils/foodLocalization";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { toStartOfDay, toEndOfDay, filterByRange, rangeForDays, PRESETS } from "@/utils/chartDateRange";

function ItemRow({ item, isRTL, t }) {
    return (
        <div className="flex items-center justify-between gap-2 py-1.5">
            <span dir="auto" translate="no" className="text-sm text-foreground truncate">
                {localizedFoodName(item.name_en, item.name_ar, isRTL)}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground">({t('timesLogged', { count: item.occurrences })})</span>
                <Chip size="sm" color={adherenceChipColor(item.avg_pct)} variant="soft">{item.avg_pct}%</Chip>
            </div>
        </div>
    );
}

function ItemsList({ items, isRTL, t }) {
    if (items.length === 0) return null;
    return (
        <div className="flex flex-col divide-y divide-border">
            {items.map((item) => (
                <ItemRow key={item.food_item_id ?? item.name_en} item={item} isRTL={isRTL} t={t} />
            ))}
        </div>
    );
}

/**
 * Timeframe filter (Tabs, one row above the chart) + AreaChart in its own
 * Card-header mode -- same PRESETS/chartDateRange pattern and the same
 * component the transformation page's metric cards use, so "the metric" is
 * a real reusable building block, not a hand-rolled number. The headline
 * figure stays AreaChart's neutral styling on purpose: color-coded status
 * belongs to the lists around it (plan cards, item rows), not the one
 * number already labeled by its surrounding heading.
 */
function TrendCard({ series, locale, title }) {
    const [dateRange, setDateRange] = useState(rangeForDays(90));
    const [activePreset, setActivePreset] = useState("90d");

    const startDate = dateRange ? toStartOfDay(dateRange.start) : null;
    const endDate = dateRange ? toEndOfDay(dateRange.end) : null;

    const history = series.filter((p) => p.adherence !== null).map((p) => ({ date: p.date, value: p.adherence }));
    const filtered = filterByRange(history, startDate, endDate);
    const avg = filtered.length > 0 ? Math.round(filtered.reduce((sum, p) => sum + p.value, 0) / filtered.length) : null;
    const chartData = filtered.map((p) => ({
        label: new Date(p.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: p.value,
    }));

    function applyPreset(preset) {
        setActivePreset(preset.label);
        setDateRange(preset.days === null ? null : rangeForDays(preset.days));
    }

    return (
        <div className="flex flex-col gap-2">
            <Tabs selectedKey={activePreset} onSelectionChange={(key) => applyPreset(PRESETS.find((p) => p.label === key))}>
                <Tabs.ListContainer className="justify-end">
                    <Tabs.List
                        aria-label="Timeframe"
                        className="w-fit *:h-6 *:w-fit *:px-3 *:text-sm *:font-normal *:data-[selected=true]:text-accent-foreground"
                    >
                        {PRESETS.map((p) => (
                            <Tabs.Tab key={p.label} id={p.label}>
                                {p.label}
                                <Tabs.Indicator className="bg-accent" />
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>
                </Tabs.ListContainer>
            </Tabs>
            <AreaChart
                data={chartData}
                height={180}
                formatValue={(v) => `${Math.round(v)}%`}
                label={title}
                title={title}
                currentValue={avg}
                readingsCount={filtered.length}
            />
        </div>
    );
}

// Selectable card in a list -- same Card + selected/unselected surface
// tokens as LoadPlanModal's plan list, so "pick one from a list of cards"
// looks identical everywhere it happens in this app.
function PlanListCard({ plan, isSelected, onClick, t, formatDate }) {
    return (
        <button type="button" onClick={onClick} className="w-full text-start cursor-pointer">
            <Card
                variant="transparent"
                className={`p-3! transition-colors duration-100 ${
                    isSelected
                        ? "bg-app-surface-selected border border-primary/40"
                        : "bg-app-surface-card border border-transparent hover:bg-app-surface-hover"
                }`}
            >
                <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                        {plan.planName || t('untitledPlan')}
                    </p>
                    <Chip size="sm" color={adherenceChipColor(plan.avgAdherence)} variant="soft">
                        {plan.avgAdherence !== null ? `${plan.avgAdherence}%` : t('noGoalSet')}
                    </Chip>
                </div>
                <p className="text-xs text-muted-foreground mt-1" dir="ltr">
                    {formatDate(plan.firstDate)} – {formatDate(plan.lastDate)} · {t('daysLogged', { count: plan.entryCount })}
                </p>
            </Card>
        </button>
    );
}

/**
 * Two areas: an overall-adherence trend across every plan, then a
 * master/detail split -- a card per plan on the left (its score), the
 * selected plan's own trend + weakest items on the right (its details).
 * `planId` only sets which plan starts selected (the nutrition builder's
 * per-plan badge opens this pre-selected to itself); the "Food Diary"
 * header button opens it with no preference, defaulting to the most
 * recently active plan. `data` is fetched once by the page
 * (clients/[id]/nutrition/page.js) and handed down here and to
 * MiddlePanel's badge — no separate fetch per modal.
 */
export default function FoodDiaryAdherenceModal({ open, onClose, data, planId }) {
    const t = useTranslations('nutrition');
    const locale = useLocale();
    const isRTL = locale === 'ar';
    const { formatDate } = useDateFormatter();

    const plans = data?.plans ?? [];
    const [selectedPlanId, setSelectedPlanId] = useState(planId ?? plans[0]?.planId ?? null);
    const effectiveId = selectedPlanId ?? planId ?? plans[0]?.planId ?? null;
    const selectedPlan = plans.find((p) => p.planId === effectiveId) ?? null;

    const overallSeries = data?.dailySeries ?? [];
    const planSeries = selectedPlan ? overallSeries.filter((p) => p.planId === selectedPlan.planId) : [];

    return (
        <Modal open={open} onClose={onClose} title={t('foodDiaryOverviewTitle')} size="cover" dialogClassName="max-w-5xl">
            {plans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <BookOpen className="w-10 h-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">{t('noFoodDiaryEntries')}</p>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    <TrendCard series={overallSeries} locale={locale} title={t('overallAdherence')} />

                    <div>
                        <h3 className="text-sm font-semibold text-foreground mb-2">{t('byPlan')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
                            <div className="flex flex-col gap-2">
                                {plans.map((plan) => (
                                    <PlanListCard
                                        key={plan.planId}
                                        plan={plan}
                                        isSelected={plan.planId === effectiveId}
                                        onClick={() => setSelectedPlanId(plan.planId)}
                                        t={t}
                                        formatDate={formatDate}
                                    />
                                ))}
                            </div>
                            <Card>
                                <Card.Content className="flex flex-col gap-4">
                                    {selectedPlan && (
                                        <>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-foreground truncate">{selectedPlan.planName || t('untitledPlan')}</p>
                                                    <p className="text-xs text-muted-foreground" dir="ltr">
                                                        {formatDate(selectedPlan.firstDate)} – {formatDate(selectedPlan.lastDate)} · {t('daysLogged', { count: selectedPlan.entryCount })}
                                                    </p>
                                                </div>
                                                <Chip color={adherenceChipColor(selectedPlan.avgAdherence)} variant="soft" className="shrink-0">
                                                    {selectedPlan.avgAdherence !== null ? `${selectedPlan.avgAdherence}%` : t('noGoalSet')}
                                                </Chip>
                                            </div>
                                            <TrendCard series={planSeries} locale={locale} title={selectedPlan.planName || t('untitledPlan')} />
                                            {selectedPlan.leastAdherentItems.length > 0 && (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-foreground mb-1.5">{t('needsAttention')}</h4>
                                                    <ItemsList items={selectedPlan.leastAdherentItems} isRTL={isRTL} t={t} />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </Card.Content>
                            </Card>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
