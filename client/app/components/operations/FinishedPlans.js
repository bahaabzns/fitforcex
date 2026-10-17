"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@heroui/react/card";
import { Skeleton } from "@heroui/react/skeleton";
import api from "@/lib/axios";
import AreaChart from "@/app/components/charts/AreaChart";
import InfoTooltip from "@/app/components/InfoTooltip";
import NumberWithUnit from "@/app/components/NumberWithUnit";
import { CAPACITY_COLOR } from "@/app/components/operations/DemandTrendChart";
import OpsTable from "@/app/components/operations/OpsTable";

// Finished plans are green, so they never share a colour with demand (yellow) or capacity (blue).
const FINISHED_COLOR = "#22c55e";
import { MAX_RANGE_DAYS } from "@/app/components/operations/useTrendRange";

const TEAM = "__team__";

// A small trend line for one table row; the scale is the row's own so quiet people still show a shape.
function Sparkline({ values }) {
    const gradientId = useId();
    const width = 96;
    const height = 24;
    const max = Math.max(1, ...values);
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    const points = values.map((value, i) => `${(i * step).toFixed(1)},${(height - 2 - (value / max) * (height - 4)).toFixed(1)}`).join(" ");
    // The same line closed down to the baseline, filled with a blue fade.
    const area = `${points} ${((values.length - 1) * step).toFixed(1)},${height} 0,${height}`;
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="presentation" dir="ltr">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#${gradientId})`} />
            <polyline points={points} fill="none" stroke="var(--color-primary)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

// Plans each team member finished per day. Owner/manager see everyone (a person picker plus a
// ranked table); a trainer sees only their own line. Credit goes to whoever finished the plan.
export default function FinishedPlans({ range, refreshToken = 0 }) {
    const t = useTranslations("operations");
    const locale = useLocale();
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [selected, setSelected] = useState(TEAM);

    const { params: rangeParams, tooLong } = range;

    useEffect(() => {
        if (tooLong) return undefined;
        let cancelled = false;
        const params = { ...rangeParams, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        api.get("/api/operations/finished-trend", { params })
            .then((res) => { if (!cancelled) { setData(res.data); setError(false); } })
            .catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, [rangeParams, tooLong, refreshToken]);

    const isSelf = data?.scope === "self";
    const person = isSelf
        ? data.me
        : (selected === TEAM ? null : data?.people.find((p) => p.userId === selected) ?? null);
    // The series on the chart: one person, or the whole team.
    const series = isSelf ? data?.me : (person ?? data?.team);

    const chartData = useMemo(() => (series?.points ?? []).map((point) => ({
        label: new Date(`${point.date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: point.count,
    })), [series, locale]);

    // One day (or a trainer's own view) has no chart to match, so the pieces simply stack.
    const stacked = isSelf || data?.days === 1;
    const personColumns = data && !isSelf ? [
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
        { key: "today", label: t("finishedToday"), sortable: true, render: (row) => (row.unattributed ? "—" : <span className="tabular-nums">{row.today}</span>) },
        { key: "total", label: t("finishedInRange", { days: data.days }), sortable: true, render: (row) => <span className="tabular-nums">{row.total}</span> },
        { key: "averagePerDay", label: t("finishedAverage"), sortable: true, render: (row) => (row.unattributed ? "—" : <span className="tabular-nums">{row.averagePerDay}</span>) },
        { key: "trend", label: t("finishedTrendCol"), render: (row) => (row.unattributed ? null : <Sparkline values={row.points.map((point) => point.count)} />) },
    ] : [];
    const personRows = data && !isSelf ? data.people.map((person) => ({ ...person, id: person.userId })) : [];
    // Finished work with nobody recorded stays at the bottom whatever the sort.
    const personFooter = data && !isSelf && data.unattributed.total > 0
        ? [{ id: "__unattributed__", unattributed: true, clickable: false, total: data.unattributed.total }]
        : [];

    const seriesCapacity = (series?.points ?? []).map((point) => point.capacity);
    const hasCapacity = seriesCapacity.some((value) => value > 0);

    if (tooLong) return null;   // the demand chart above already explains the range problem

    return (
        <section className="flex flex-col gap-3 min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <div className="flex items-center gap-1">
                        <h3 className="text-sm font-semibold text-foreground">{t("finishedTitle")}</h3>
                        <InfoTooltip text={t("finishedInfo")} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("finishedSubtitle")}</p>
                </div>
            </div>

            {error && !data ? (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border py-8 text-center">{t("finishedLoadFailed")}</p>
            ) : !data ? (
                <Skeleton className="h-64 rounded-xl" />
            ) : isSelf && !data.me ? (
                <p className="text-sm text-muted-foreground">{t("myLoadEmpty")}</p>
            ) : (
                <>
                <div className={stacked ? "flex flex-col gap-3" : "grid grid-cols-1 *:min-w-0 gap-6 lg:grid-cols-2 lg:items-stretch"}>
                    <div className="flex flex-col gap-2">
                    {data.days === 1 ? (
                        <Card className="rounded-xl">
                            <Card.Content className="p-5 flex flex-wrap gap-x-10 gap-y-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-2">{t("finishedTotalOneDay")}</p>
                                    <p className="text-2xl font-bold text-foreground tabular-nums leading-none"><NumberWithUnit value={`${series.total} ${t("unitPlans")}`} /></p>
                                </div>
                                {hasCapacity && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">{t("finishedLimitLabel")}</p>
                                        <p className="text-2xl font-bold text-foreground tabular-nums leading-none"><NumberWithUnit value={t("trendPerDay", { count: seriesCapacity[0] })} /></p>
                                    </div>
                                )}
                            </Card.Content>
                        </Card>
                    ) : (
                    <AreaChart
                        data={chartData}
                        height={280}
                        formatValue={(value) => Math.round(value).toString()}
                        label={t("finishedSeriesLabel")}
                        color={FINISHED_COLOR}
                        title={t("finishedTotalLabel", { days: data.days })}
                        currentValue={series.total}
                        unit={t("unitPlans")}
                        headerStats={[
                            { label: t("finishedAverage"), value: t("trendPerDay", { count: series.averagePerDay }) },
                            ...(person || isSelf ? [{ label: t("finishedToday"), value: String(series.today ?? 0) }] : []),
                        ]}
                        overlay={hasCapacity ? { values: seriesCapacity, label: t("finishedLimitLabel"), color: CAPACITY_COLOR } : null}
                    />
                    )}
                    </div>

                    {!isSelf && (
                        // Side by side, the table takes the chart column's height whatever the team size and scrolls
                        // inside it; stacked (one day), it just takes the room it needs.
                        <div className={stacked ? "" : "relative min-h-80 max-h-96 lg:max-h-none"}>
                            <div className={stacked ? "" : "absolute inset-0"}>
                                <OpsTable
                                    ariaLabel={t("finishedTitle")} columns={personColumns} rows={personRows} footerRows={personFooter}
                                    defaultSort={{ key: "total", direction: "descending" }} scroll={stacked ? "x" : "both"}
                                    onRowClick={(row) => setSelected((current) => (current === row.id ? TEAM : row.id))} isSelected={(row) => row.id === selected}
                                />
                            </div>
                        </div>
                    )}
                </div>
                {data.days !== 1 && <p className="text-xs text-muted-foreground">{t("finishedCaption")}</p>}
                </>
            )}
        </section>
    );
}
