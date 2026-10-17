"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Hourglass, Pencil, Target, Timer } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Drawer } from "@heroui/react/drawer";
import { Input } from "@heroui/react/input";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import api from "@/lib/axios";
import AreaChart from "@/app/components/charts/AreaChart";
import InfoTooltip from "@/app/components/InfoTooltip";
import { StatCard } from "@/app/components/operations/KpiTrendCards";
import OpsTable from "@/app/components/operations/OpsTable";
import { MAX_RANGE_DAYS } from "@/app/components/operations/useTrendRange";
import Section from "@/app/components/operations/Section";

const MIN_TARGET_DAYS = 1;
const MAX_TARGET_DAYS = 30; // mirror the server's operations.serviceLevel.ts

// Green for results, purple for time taken, red for plans that are late.
const ON_TIME_COLOR = "#22c55e";
const TURNAROUND_COLOR = "#a855f7";
const OVERDUE_COLOR = "#ef4444";

const round1 = (value) => Math.round(value * 10) / 10;

// A turnaround in the unit a person would say it in: minutes, hours, or days.
function useDuration() {
    const t = useTranslations("operations");
    return (hours) => {
        if (hours === null || hours === undefined) return "—";
        if (hours < 1) return t("durMinutes", { count: Math.round(hours * 60) });
        if (hours < 48) return t("durHours", { count: round1(hours) });
        return t("durDays", { count: round1(hours / 24) });
    };
}

// Green at 90% and above, amber from 70%, red below: shared by the table cells.
function toneClass(pct) {
    if (pct === null) return "text-muted-foreground";
    if (pct >= 90) return "text-green-500";
    if (pct >= 70) return "text-amber-500";
    return "text-red-500";
}

// The service goal, as a card in the section header: what the goal is, and a clear button to change it.
// Editing swaps the same card to a number field with Save / Cancel.
function GoalEditor({ targetDays, onSaved }) {
    const t = useTranslations("operations");
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(targetDays));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    // On a phone the goal is edited in a bottom sheet instead of inside the card.
    const [sheetOpen, setSheetOpen] = useState(false);

    function startEditing() {
        setValue(String(targetDays));
        setError("");
        if (window.matchMedia("(max-width: 639px)").matches) setSheetOpen(true);
        else setEditing(true);
    }

    function closeEditor() {
        setEditing(false);
        setSheetOpen(false);
        setError("");
    }

    async function save() {
        const days = Number(value);
        if (!Number.isInteger(days) || days < MIN_TARGET_DAYS || days > MAX_TARGET_DAYS) {
            setError(t("slGoalInvalid", { min: MIN_TARGET_DAYS, max: MAX_TARGET_DAYS }));
            return;
        }
        setSaving(true);
        setError("");
        try {
            await api.put("/api/operations/service-target", { targetDays: days });
            closeEditor();
            onSaved();
        } catch {
            setError(t("slGoalSaveFailed"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="relative w-full sm:w-auto">
            {/* Fixed height so switching to the editor does not resize the header and shift the page. */}
            <div className="flex h-16 items-center gap-3 rounded-xl border border-border bg-card px-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                    <Target size={18} />
                </span>
                {editing ? (
                    <>
                        <label htmlFor="ops-goal-days" className="text-sm text-muted-foreground whitespace-nowrap">{t("slGoalLabel")}</label>
                        <TextField variant="secondary" aria-label={t("slGoalLabel")} value={value} onChange={setValue} className="w-20">
                            <Input id="ops-goal-days" type="number" inputMode="numeric" min={MIN_TARGET_DAYS} max={MAX_TARGET_DAYS} step={1} autoFocus className="h-9" />
                        </TextField>
                        <div className="flex items-center gap-2">
                            <Button variant="primary" size="sm" onClick={save} isDisabled={saving}>{saving ? t("saving") : t("save")}</Button>
                            <Button variant="ghost" size="sm" onClick={closeEditor}>{t("cancel")}</Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{t("slGoalTitle")}</p>
                            <p className="text-sm font-semibold text-foreground">{t("slGoalValue", { days: targetDays })}</p>
                        </div>
                        <Button className="ms-auto sm:ms-0" variant="outline" size="sm" onClick={startEditing}>
                            <Pencil size={14} />
                            {t("slChangeGoal")}
                        </Button>
                    </>
                )}
            </div>
            {error && !sheetOpen && <p className="absolute end-0 top-full mt-1 text-xs text-destructive">{error}</p>}

            <Drawer isOpen={sheetOpen} onOpenChange={(isOpen) => { if (!isOpen) closeEditor(); }}>
                <Drawer.Backdrop isDismissable>
                    <Drawer.Content placement="bottom">
                        <Drawer.Dialog className="flex flex-col bg-background rounded-t-2xl">
                            <Drawer.Handle />
                            <Drawer.Header className="px-5 pt-2 pb-3">
                                <Drawer.Heading className="text-base font-semibold text-foreground">{t("slGoalTitle")}</Drawer.Heading>
                            </Drawer.Header>
                            <Drawer.Body className="flex flex-col gap-2 px-5 pb-2">
                                <label htmlFor="ops-goal-days-sheet" className="text-sm text-muted-foreground">{t("slGoalLabel")}</label>
                                <TextField variant="secondary" aria-label={t("slGoalLabel")} value={value} onChange={setValue}>
                                    <Input id="ops-goal-days-sheet" type="number" inputMode="numeric" min={MIN_TARGET_DAYS} max={MAX_TARGET_DAYS} step={1} />
                                </TextField>
                                {error && <p className="text-xs text-destructive">{error}</p>}
                            </Drawer.Body>
                            <Drawer.Footer className="flex gap-2 px-5 py-4">
                                <Button variant="ghost" className="flex-1" onClick={closeEditor}>{t("cancel")}</Button>
                                <Button variant="primary" className="flex-1" onClick={save} isDisabled={saving}>{saving ? t("saving") : t("save")}</Button>
                            </Drawer.Footer>
                        </Drawer.Dialog>
                    </Drawer.Content>
                </Drawer.Backdrop>
            </Drawer>
        </div>
    );
}

// How quickly clients get their plans, against a goal (finish within N days of the client sending answers).
export default function ServiceLevelPanel({ range, refreshToken = 0, rangeControls = null }) {
    const t = useTranslations("operations");
    const locale = useLocale();
    const duration = useDuration();
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [goalVersion, setGoalVersion] = useState(0);

    const { params: rangeParams, tooLong } = range;

    useEffect(() => {
        if (tooLong) return undefined;
        let cancelled = false;
        const params = { ...rangeParams, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        api.get("/api/operations/service-level", { params })
            .then((res) => { if (!cancelled) { setData(res.data); setError(false); } })
            .catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, [rangeParams, tooLong, refreshToken, goalVersion]);

    const chartData = useMemo(() => (data?.daily ?? []).map((day) => ({
        label: new Date(`${day.date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: day.onTimePct,
    })), [data, locale]);

    // Until there is data, keep the section header in place so the page does not jump.
    if (tooLong || (error && !data) || !data) {
        return (
            <Section title={t("slTitle")} description={t("slSubtitle")} right={rangeControls}>
                {tooLong ? (
                    <p className="text-sm text-destructive rounded-xl border border-dashed border-destructive/40 py-8 text-center">{t("trendRangeTooLong", { max: MAX_RANGE_DAYS })}</p>
                ) : error && !data ? (
                    <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border py-8 text-center">{t("slLoadFailed")}</p>
                ) : (
                    <div className="flex flex-col gap-4">
                        <Skeleton className="h-24 rounded-xl" />
                        <Skeleton className="h-64 rounded-xl" />
                    </div>
                )}
            </Section>
        );
    }

    const memberColumns = [
        {
            key: "name", label: t("colTrainer"), sortable: true, sortValue: (row) => row.name,
            render: (row) => row.unattributed
                ? <span className="italic text-muted-foreground">{t("finishedUnattributed")}</span>
                : (
                    <span className="font-medium text-foreground">
                        {row.name}
                        {row.isOwner && <span className="ms-1.5 text-[10px] text-muted-foreground">{t("ownerBadge")}</span>}
                        {row.role === "former" && <span className="ms-1.5 text-[10px] text-muted-foreground">{t("formerMember")}</span>}
                    </span>
                ),
        },
        { key: "finished", label: t("slColFinished"), sortable: true, render: (row) => <span className="tabular-nums">{row.finished}</span> },
        {
            key: "onTimePct", label: t("slColOnTime"), sortable: true,
            render: (row) => <span className={`tabular-nums font-medium ${toneClass(row.onTimePct)}`}>{row.onTimePct === null ? "—" : `${row.onTimePct}%`}</span>,
        },
        {
            key: "averageHours", label: t("slColAverage"), sortable: true,
            render: (row) => <span className="tabular-nums">{duration(row.averageHours)}</span>,
        },
    ];
    const memberRows = data.people.map((person) => ({ ...person, id: person.userId }));
    // Work with nobody recorded stays at the bottom whatever the sort.
    const memberFooter = data.unattributed.finished > 0 ? [{ ...data.unattributed, id: "__unattributed__", unattributed: true, clickable: false }] : [];

    // A chart needs at least two days of results; a single day (or nothing finished) shows the number alone.
    const dayLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
    const dailySeries = (field) => data.daily.filter((day) => day[field] !== null).map((day) => ({ label: dayLabel(day.date), value: day[field] }));
    const onTimeSeries = dailySeries("onTimePct");
    const turnaroundSeries = dailySeries("averageHours");
    const hasTrend = data.days > 1 && onTimeSeries.length > 1;
    const single = data.days === 1;

    // Bars for the numbers with no daily history: how much of the goal time was used, and how late the waiting plans are.
    const goalHours = data.targetDays * 24;
    const goalShare = (hours) => (hours === null ? 0 : (hours / goalHours) * 100);
    const overduePct = data.waiting.open > 0 ? (data.waiting.overdue / data.waiting.open) * 100 : 0;
    const goalTimes = Math.round((data.waiting.open > 0 ? data.waiting.longestHours / goalHours : 0) * 10) / 10;

    return (
        <Section
            title={(
                <span className="inline-flex items-center gap-1">
                    {t("slTitle")}
                    <InfoTooltip text={t("slInfo")} />
                </span>
            )}
            description={t("slSubtitle")}
            right={<GoalEditor targetDays={data.targetDays} onSaved={() => setGoalVersion((v) => v + 1)} />}
        >

            <div className="grid grid-cols-2 *:min-w-0 gap-2.5 sm:gap-4 xl:grid-cols-4">
                <StatCard
                    icon={CheckCircle2}
                    label={t("slOnTime")} hint={t("slOnTimeHint", { days: data.targetDays })}
                    value={data.onTimePct === null ? "—" : `${data.onTimePct}%`}
                    caption={data.finished > 0 ? t("slOnTimeCaption", { onTime: data.onTime, finished: data.finished }) : t("slEmptyShort")}
                    hideDelta
                    series={hasTrend ? onTimeSeries : undefined}
                    bar={hasTrend ? null : { value: data.onTimePct ?? 0, color: ON_TIME_COLOR, label: t("slBarOnTime") }}
                    color={ON_TIME_COLOR} formatValue={(value) => `${Math.round(value)}%`}
                />
                <StatCard
                    icon={Timer}
                    label={t("slAverage")} hint={t("slAverageHint")}
                    value={duration(data.averageHours)}
                    caption={data.medianHours === null ? undefined : t("slAverageCaption", { value: duration(data.medianHours) })}
                    hideDelta
                    series={hasTrend ? turnaroundSeries : undefined}
                    bar={hasTrend ? null : { value: goalShare(data.averageHours), color: TURNAROUND_COLOR, label: t("slBarAverage", { pct: Math.round(goalShare(data.averageHours)) }) }}
                    color={TURNAROUND_COLOR} formatValue={duration}
                />
                <StatCard
                    icon={AlertTriangle}
                    label={t("slOverdue")} hint={t("slOverdueHint", { days: data.targetDays })}
                    value={data.waiting.overdue}
                    caption={t("slOverdueCaption", { open: data.waiting.open })}
                    hideDelta
                    bar={{ value: overduePct, color: OVERDUE_COLOR, label: t("slBarOverdue", { pct: Math.round(overduePct) }) }}
                />
                <StatCard
                    icon={Hourglass}
                    label={t("slLongest")} hint={t("slLongestHint")}
                    value={duration(data.waiting.open > 0 ? data.waiting.longestHours : null)}
                    caption={t("slLongestCaption", { days: data.targetDays })}
                    hideDelta
                    bar={{ value: goalShare(data.waiting.open > 0 ? data.waiting.longestHours : 0), color: OVERDUE_COLOR, label: t("slBarLongest", { times: goalTimes }) }}
                />
            </div>

            {data.finished === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border py-8 text-center">{t("slEmpty")}</p>
            ) : (
                <div className={single ? "grid grid-cols-1 *:min-w-0 gap-6" : "grid grid-cols-1 *:min-w-0 gap-6 lg:grid-cols-2 lg:items-stretch"}>
                    {!single && (
                        <div className="flex flex-col gap-2">
                            <div className="flex h-6 items-center gap-1">
                                <h3 className="text-sm font-semibold text-foreground">{t("slChartTitle")}</h3>
                                <InfoTooltip text={t("slChartInfo", { days: data.targetDays })} />
                            </div>
                            <AreaChart
                                data={chartData}
                                height={280}
                                formatValue={(value) => `${Math.round(value)}%`}
                                label={t("slChartSeries")}
                                color="#22c55e"
                                title={t("slChartTotal", { days: data.days })}
                                currentValue={data.onTimePct}
                                referenceLine={data.onTimePct === null ? null : { value: data.onTimePct, label: t("slChartAverage", { count: data.onTimePct }) }}
                            />
                        </div>
                    )}

                    {/* Same heading row as the chart, and the card matches the chart column's height whatever the team size:
                        the table scrolls inside it instead of stretching the row. */}
                    <div className="flex flex-col gap-2">
                        <div className="flex h-6 items-center gap-1">
                            <h3 className="text-sm font-semibold text-foreground">{t("slTableTitle")}</h3>
                            <InfoTooltip text={t("slTableHint")} />
                        </div>
                        <div className={single ? "" : "relative flex-1 min-h-80 max-h-96 lg:max-h-none"}>
                            <div className={single ? "" : "absolute inset-0"}>
                                <OpsTable
                                    ariaLabel={t("slTableTitle")} columns={memberColumns} rows={memberRows} footerRows={memberFooter}
                                    defaultSort={{ key: "finished", direction: "descending" }} scroll={single ? "x" : "both"}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Section>
    );
}
