"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { ListBox } from "@heroui/react/list-box";
import { Select } from "@heroui/react/select";
import { Skeleton } from "@heroui/react/skeleton";
import api from "@/lib/axios";
import AreaChart from "@/app/components/charts/AreaChart";
import InfoTooltip from "@/app/components/InfoTooltip";
import NumberWithUnit from "@/app/components/NumberWithUnit";
import MobileFilters from "@/app/components/operations/MobileFilters";
import PillToggleGroup from "@/app/components/operations/PillToggleGroup";
import { MAX_RANGE_DAYS } from "@/app/components/operations/useTrendRange";

// Demand is yellow and capacity is blue on every chart, so the two always read the same way.
// (Tailwind yellow-500 / blue-500: readable on both the light and dark themes.)
export const DEMAND_COLOR = "#eab308";

const NO_PACKAGE = "__none__"; // mirrors the server's NO_PACKAGE_FILTER
export const CAPACITY_COLOR = "#3b82f6";

// New plan requests per day over the date range chosen in the shared range controls, with its own
// package / plan type / kind filters (they narrow this chart only). `wrapTitle` lets the page wrap
// the title (for the first-visit tour) without this component knowing about it.
export default function DemandTrendChart({ range, refreshToken = 0, wrapTitle = (node) => node }) {
    const t = useTranslations("operations");
    const locale = useLocale();
    const [trend, setTrend] = useState(null);
    const [error, setError] = useState(false);
    // Which reference series are drawn on the chart.
    const [showCapacity, setShowCapacity] = useState(true);
    const [showAverage, setShowAverage] = useState(true);

    // The chart's own filters (they narrow this chart only). null = no filter.
    // Packages are a multi-choice: an empty list means every package.
    const [packageNames, setPackageNames] = useState([]);
    const [action, setAction] = useState(null);
    const [type, setType] = useState(null);
    // The package choices come back with the data; keep the last list so the picker never empties while reloading.
    const [packageOptions, setPackageOptions] = useState({ packages: [], hasNoPackage: false });
    const packageDisplayName = (name) => (name === NO_PACKAGE ? t("noPackage") : name);
    const hasFilters = !!(packageNames.length || action || type);
    const { params: rangeParams, tooLong } = range;

    useEffect(() => {
        if (tooLong) return undefined;
        let cancelled = false;
        const params = { ...rangeParams, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        if (packageNames.length) params.package = packageNames;
        if (action) params.action = action;
        if (type) params.type = type;
        api.get("/api/operations/demand-trend", { params })
            .then((res) => {
                if (cancelled) return;
                setTrend(res.data);
                if (res.data.filterOptions) setPackageOptions(res.data.filterOptions);
                setError(false);
            })
            .catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, [rangeParams, tooLong, packageNames, action, type, refreshToken]);

    const chartData = useMemo(() => (trend?.points ?? []).map((point) => ({
        // Noon keeps the label on the right day when the browser zone differs from the bucket zone.
        label: new Date(`${point.date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: point.count,
    })), [trend, locale]);

    return (
        <section className="flex flex-col gap-3 min-w-0">
            <div>
                <div className="flex items-center gap-1">
                    {wrapTitle(<h3 className="text-sm font-semibold text-foreground">{t("trendTitle")}</h3>)}
                    <InfoTooltip text={t("trendInfo")} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t("trendSubtitle")}</p>
            </div>

            {/* Filters, in the same pill style as the period buttons: package, plan type, kind of request.
                Pressing a selected pill again clears it. */}
            <div className="hidden sm:flex flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] -mx-1 px-1 py-1 -my-1">
                {/* One row; on a narrow screen it scrolls sideways instead of wrapping into several rows. */}
                <Select
                    aria-label={t("filterPackage")}
                    size="sm"
                    selectionMode="multiple"
                    placeholder={t("filterAllPackages")}
                    value={packageNames}
                    onChange={(keys) => setPackageNames(Array.isArray(keys) ? keys.map(String) : [])}
                >
                    <Select.Trigger className="border-0! bg-default/60! shadow-none! rounded-full! min-h-8! px-3! sm:px-4! gap-2 min-w-28 sm:min-w-36 text-xs sm:text-sm shrink-0">
                        {/* One line however many packages are picked: the first name, then how many more. */}
                        <Select.Value className="block max-w-48 truncate whitespace-nowrap text-start">
                            {({ isPlaceholder }) => (isPlaceholder || packageNames.length === 0
                                ? t("filterAllPackages")
                                : packageNames.length === 1
                                    ? packageDisplayName(packageNames[0])
                                    : `${packageDisplayName(packageNames[0])} +${packageNames.length - 1}`)}
                        </Select.Value>
                        <ChevronsUpDown size={13} className="shrink-0 text-muted-foreground" />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {packageOptions.packages.map((name) => (
                                <ListBox.Item key={name} id={name} textValue={name}>
                                    {name}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                            {packageOptions.hasNoPackage && (
                                <ListBox.Item id={NO_PACKAGE} textValue={t("noPackage")}>
                                    {t("noPackage")}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            )}
                        </ListBox>
                    </Select.Popover>
                </Select>
                <PillToggleGroup
                    ariaLabel={t("filterAction")} allowDeselect value={action} onChange={setAction}
                    options={[{ id: "nutrition", label: t("nutrition") }, { id: "workout", label: t("workout") }]}
                />
                <PillToggleGroup
                    ariaLabel={t("filterType")} allowDeselect value={type} onChange={setType}
                    options={[{ id: "assessment", label: t("assessment") }, { id: "check-in", label: t("checkIn") }]}
                />
                {hasFilters && (
                    <Button className="shrink-0" variant="ghost" size="sm" onClick={() => { setPackageNames([]); setAction(null); setType(null); }}>
                        {t("clearFilters")}
                    </Button>
                )}
            </div>
            {/* On a phone the three filters are three buttons that open a bottom sheet to choose from. */}
            <div className="sm:hidden">
                <MobileFilters
                    doneLabel={t("filterDone")}
                    filters={[
                        {
                            key: "package", label: t("filterBtnPackage"), title: t("filterPackage"), anyLabel: t("filterAllPackages"),
                            multiple: true, value: packageNames, onChange: setPackageNames,
                            options: [
                                ...packageOptions.packages.map((name) => ({ id: name, label: name })),
                                ...(packageOptions.hasNoPackage ? [{ id: NO_PACKAGE, label: t("noPackage") }] : []),
                            ],
                        },
                        {
                            key: "action", label: t("filterBtnPlan"), title: t("filterAction"), anyLabel: t("filterAny"),
                            value: action, onChange: setAction,
                            options: [{ id: "nutrition", label: t("nutrition") }, { id: "workout", label: t("workout") }],
                        },
                        {
                            key: "type", label: t("filterBtnKind"), title: t("filterType"), anyLabel: t("filterAny"),
                            value: type, onChange: setType,
                            options: [{ id: "assessment", label: t("assessment") }, { id: "check-in", label: t("checkIn") }],
                        },
                    ]}
                />
            </div>
            {tooLong ? (
                <p className="text-sm text-destructive rounded-xl border border-dashed border-destructive/40 py-8 text-center">{t("trendRangeTooLong", { max: MAX_RANGE_DAYS })}</p>
            ) : error && !trend ? (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border py-8 text-center">{t("trendLoadFailed")}</p>
            ) : !trend ? (
                <Skeleton className="h-64 rounded-xl" />
            ) : trend.days === 1 ? (
                <Card className="rounded-xl">
                    <Card.Content className="p-5 flex flex-wrap gap-x-10 gap-y-4">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("trendTotalOneDay")}</p>
                            <p className="text-2xl font-bold text-foreground tabular-nums leading-none"><NumberWithUnit value={`${trend.total} ${t("unitPlans")}`} /></p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">{t("trendCurrentCapacityStat")}</p>
                            <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                                <NumberWithUnit value={trend.points[0].capacity > 0 ? t("trendPerDay", { count: trend.points[0].capacity }) : "—"} />
                            </p>
                        </div>
                    </Card.Content>
                </Card>
            ) : (
                <>
                    <AreaChart
                        data={chartData}
                        height={220}
                        formatValue={(value) => Math.round(value).toString()}
                        label={t("trendSeriesLabel")}
                        color={DEMAND_COLOR}
                        // The header number is the TOTAL for the range (not an average), so say so.
                        title={t("trendTotalLabel", { days: trend.days })}
                        currentValue={trend.total}
                        unit={t("unitPlans")}
                        headerStats={[
                            { label: t("trendAverageStat"), value: t("trendPerDay", { count: trend.averagePerDay }), dashed: true,
                                toggle: { isSelected: showAverage, onChange: setShowAverage, ariaLabel: t("trendShowAverage") },
                            },
                            {
                                label: t("trendCurrentCapacityStat"),
                                color: CAPACITY_COLOR,
                                toggle: { isSelected: showCapacity, onChange: setShowCapacity, ariaLabel: t("trendShowCapacity") },
                                value: trend.currentDailyCapacity > 0 ? t("trendPerDay", { count: trend.currentDailyCapacity }) : "—",
                            },
                        ]}
                        referenceLine={showAverage ? { value: trend.averagePerDay, label: t("trendAverageLine", { count: trend.averagePerDay }) } : null}
                        overlay={showCapacity ? { values: trend.points.map((point) => point.capacity), label: t("trendCapacityLabel"), color: CAPACITY_COLOR } : null}
                    />
                    <p className="text-xs text-muted-foreground">{t("trendCaption")}</p>
                </>
            )}
        </section>
    );
}
