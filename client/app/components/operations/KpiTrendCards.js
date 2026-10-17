"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, CheckCircle2, ClipboardList, Gauge, Minus, Users } from "lucide-react";
import { Card } from "@heroui/react/card";
import api from "@/lib/axios";
import InfoTooltip from "@/app/components/InfoTooltip";
import NumberWithUnit from "@/app/components/NumberWithUnit";
import MiniAreaChart from "@/app/components/charts/MiniAreaChart";
import { CAPACITY_COLOR, DEMAND_COLOR } from "@/app/components/operations/DemandTrendChart";
import { capacityDelta, deltaTone, finishedDelta, fullnessDelta, waitingDelta } from "@/app/components/operations/kpiDeltas";

// Same hues as the status chips, as real colours because they are used inside the SVG.
const STATUS_COLOR = { healthy: "#22c55e", tight: "#f59e0b", overloaded: "#ef4444" };

const TONE_CLASS = { good: "text-green-500", bad: "text-red-500", neutral: "text-muted-foreground" };

function DeltaLine({ delta, goodDirection }) {
    const t = useTranslations("operations");
    if (!delta) return <p className="text-xs text-muted-foreground">{t("kpiNoHistory")}</p>;
    const Arrow = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus;
    const rounded = Math.abs(Math.round(delta.value));
    const amount = delta.unit === "points" ? t("kpiPoints", { count: rounded }) : `${rounded}%`;
    return (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={`flex items-center gap-0.5 font-semibold ${TONE_CLASS[deltaTone(delta, goodDirection)]}`}>
                <Arrow size={12} aria-hidden="true" />
                {delta.direction === "flat" ? t("kpiNoChange") : amount}
            </span>
            {t("kpiVsLastWeek")}
        </p>
    );
}

// One stat card: icon and label, a big value, an optional "vs last week" change, and an optional mini chart.
// `series` undefined shows a loading placeholder, `noChart` leaves the chart out entirely, and `hideDelta`
// drops the change line (for numbers with no history to compare against).
export function StatCard({ icon: Icon, label, hint, value, caption, delta, goodDirection, series, color, formatValue, hideDelta = false, noChart = false, bar = null }) {
    return (
        <Card className="rounded-xl">
            <Card.Content className="p-3 sm:p-5 flex flex-col gap-2 sm:gap-3">
                <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <Icon size={16} className="shrink-0" aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-medium leading-tight sm:truncate">{label}</span>
                    {hint && <InfoTooltip text={hint} />}
                </div>
                <div className="flex flex-col gap-1.5">
                    <p className="text-xl sm:text-3xl font-bold text-foreground tabular-nums leading-none tracking-tight"><NumberWithUnit value={value} /></p>
                    {!hideDelta && <DeltaLine delta={delta} goodDirection={goodDirection} />}
                    {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
                </div>
                {/* Under the numbers, full width: the cards sit two across, so there is no room beside them. */}
                {/* `bar` ({ value: 0-100, color, label }) is a progress bar for numbers with no daily history; the
                    visual always sits at the bottom of the card so a row of cards lines up. */}
                {bar ? (
                    <div className="mt-auto h-14 flex flex-col justify-end gap-1.5">
                        <div className="h-2 rounded-full bg-default/60 overflow-hidden" role="presentation">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, bar.value))}%`, backgroundColor: bar.color }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{bar.label}</p>
                    </div>
                ) : noChart ? null : series ? (
                    <div className="mt-auto">
                        <MiniAreaChart data={series} color={color} height={56} formatValue={formatValue} ariaLabel={label} />
                    </div>
                ) : (
                    <div className="mt-auto h-14 rounded-lg bg-default/40 animate-pulse" aria-hidden="true" />
                )}
            </Card.Content>
        </Card>
    );
}

// The three headline numbers as cards: value, change since last week, and a two-week mini chart with
// a hover tooltip. The big numbers come from the live summary; the history loads separately, so
// the cards appear immediately and the charts fill in.
export default function KpiTrendCards({ summary, refreshToken = 0 }) {
    const t = useTranslations("operations");
    const [trend, setTrend] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const params = { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        api.get("/api/operations/kpi-trend", { params })
            .then((res) => { if (!cancelled) setTrend(res.data); })
            .catch(() => { if (!cancelled) setTrend(null); });
        return () => { cancelled = true; };
    }, [refreshToken]);

    const points = trend?.points ?? null;
    const labelFor = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const seriesOf = (field) => points?.map((p) => ({ label: labelFor(p.date), value: p[field] }));

    const { demand, capacity, utilization } = summary;

    return (
        <div className="grid grid-cols-2 *:min-w-0 gap-2.5 sm:gap-4 xl:grid-cols-4">
            <StatCard
                icon={ClipboardList}
                label={t("kpiDemand")} hint={t("kpiDemandHint")}
                value={demand.total}
                caption={t("kpiDemandCaption", { unassigned: demand.unassigned })}
                delta={points ? waitingDelta(points) : null} goodDirection="down"
                series={seriesOf("waiting")} color={DEMAND_COLOR}
                formatValue={(value) => `${value} ${t("unitPlans")}`}
            />
            <StatCard
                icon={Users}
                label={t("kpiCapacity")} hint={t("kpiCapacityHint")}
                value={t("capacityPerDay", { count: capacity.total })}
                caption={capacity.today !== capacity.total
                    ? t("kpiCapacityToday", { count: capacity.today })
                    : t("kpiCapacityCaption", { count: capacity.countedTrainers })}
                delta={points ? capacityDelta(points) : null} goodDirection="up"
                series={seriesOf("capacity")} color={CAPACITY_COLOR}
                formatValue={(value) => t("capacityPerDay", { count: value })}
            />
            <StatCard
                icon={Gauge}
                label={t("kpiUtilization")} hint={t("kpiUtilizationHint", { days: utilization.targetDays })}
                value={utilization.pct === null ? "—" : `${utilization.pct}%`}
                caption={utilization.pct === null ? t("noCapacityShort") : undefined}
                delta={points ? fullnessDelta(points) : null} goodDirection="down"
                series={points?.some((p) => p.fullPct !== null) ? seriesOf("fullPct") : null}
                color={STATUS_COLOR[utilization.status] ?? "var(--color-primary)"}
                formatValue={(value) => `${value}%`}
            />
            <StatCard
                icon={CheckCircle2}
                label={t("kpiFinished")} hint={t("kpiFinishedHint")}
                value={points ? points.slice(-7).reduce((sum, p) => sum + p.finished, 0) : "—"}
                caption={points ? t("kpiFinishedCaption", { count: points.at(-1).finished }) : undefined}
                delta={points ? finishedDelta(points) : null} goodDirection="up"
                series={seriesOf("finished")} color="#22c55e"
                formatValue={(value) => `${value} ${t("unitPlans")}`}
            />
        </div>
    );
}
