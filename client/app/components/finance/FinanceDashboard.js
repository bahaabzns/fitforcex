"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Calculator, Receipt, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Card } from "@heroui/react/card";
import { ListBox } from "@heroui/react/list-box";
import { Select } from "@heroui/react/select";
import { Skeleton } from "@heroui/react/skeleton";
import api from "@/lib/axios";
import { DEFAULT_DISPLAY_CURRENCY, DISPLAY_CURRENCIES } from "@/lib/currency";
import { buildFinanceStats } from "@/lib/financeStats";
import AreaChart from "@/app/components/charts/AreaChart";
import InfoTooltip from "@/app/components/InfoTooltip";
import NumberWithUnit from "@/app/components/NumberWithUnit";
import { StatCard } from "@/app/components/operations/KpiTrendCards";
import Section from "@/app/components/operations/Section";
import TrendRangeControls from "@/app/components/operations/TrendRangeControls";
import { MAX_RANGE_DAYS, useTrendRange } from "@/app/components/operations/useTrendRange";

// The Finance section is built from the same parts as Team workload — Section headings, the pill period
// control, StatCard tiles, and the area-chart card — so the two read as one dashboard.

const MAX_TRANSACTIONS = 10000;

const COLOR_SALES = "#22c55e";
const COLOR_PAYMENTS = "#3b82f6";
const COLOR_AVERAGE = "#a855f7";
const COLOR_REFUNDS = "#ef4444";
const COLOR_PREVIOUS = "#94a3b8";
const COLOR_METHOD = "#3b82f6";
const COLOR_PACKAGE = "#a855f7";
const COLOR_CURRENCY = "#f59e0b";

const money = (value) => Math.round(value).toLocaleString("en-US");
const dateFromKey = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
};

function CurrencySelect({ value, onChange, label }) {
    return (
        <Select variant="secondary" aria-label={label} value={value} onChange={(key) => onChange(String(key))} className="w-28">
            <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            {/* sheet-popover: a dropdown on desktop, a bottom sheet on phones (see globals.css). */}
            <Select.Popover className="sheet-popover">
                <ListBox>
                    {DISPLAY_CURRENCIES.map((code) => (
                        <ListBox.Item key={code} id={code} textValue={code}>
                            {code}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

// One ranked list in the same card as the stat tiles: label and figure on a line, a thin bar for the share.
function BreakdownCard({ title, hint, rows, total, currency, color, emptyText, t }) {
    return (
        <Card className="rounded-xl">
            <Card.Content className="p-3 sm:p-5 flex flex-col gap-3 sm:gap-4">
                <div className="flex items-center gap-1 text-muted-foreground min-w-0">
                    <span className="text-xs sm:text-sm font-medium leading-tight">{title}</span>
                    {hint && <InfoTooltip text={hint} />}
                </div>
                {rows.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
                ) : (
                    <ul className="flex flex-col gap-3.5">
                        {rows.map((row) => {
                            const share = total > 0 ? (row.value / total) * 100 : 0;
                            return (
                                <li key={row.key}>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-foreground">{row.label}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {[row.note, t("shareOfSales", { percent: Math.round(share) })].filter(Boolean).join(" · ")}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                                            <NumberWithUnit value={`${money(row.value)} ${currency}`} />
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-default/60" role="presentation">
                                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, share)}%`, backgroundColor: color }} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card.Content>
        </Card>
    );
}

// The workspace's money at a glance: headline figures with their change against the period before,
// sales over time against that period, and where the sales come from. Figures are computed in the
// browser from the same transactions list the Transactions page uses, in one display currency.
export default function FinanceDashboard() {
    const t = useTranslations("financeDashboard");
    const locale = useLocale();
    const { workspaceSlug } = useParams();

    const range = useTrendRange(30);
    const [currency, setCurrency] = useState(DEFAULT_DISPLAY_CURRENCY);
    const [showPrevious, setShowPrevious] = useState(true);

    const [transactions, setTransactions] = useState(null); // null = loading
    const [loadFailed, setLoadFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        api.get(`/api/transactions?limit=${MAX_TRANSACTIONS}`)
            .then((res) => { if (!cancelled) setTransactions(res.data?.data ?? []); })
            .catch(() => { if (!cancelled) setLoadFailed(true); });
        return () => { cancelled = true; };
    }, [attempt]);

    function retry() {
        setLoadFailed(false);
        setTransactions(null);
        setAttempt((count) => count + 1);
    }

    const fromKey = range.shownRange.start.toString();
    const toKey = range.shownRange.end.toString();
    const stats = useMemo(
        () => (transactions && !range.tooLong
            ? buildFinanceStats(transactions, { from: dateFromKey(fromKey), to: dateFromKey(toKey), currency })
            : null),
        [transactions, fromKey, toKey, currency, range.tooLong],
    );

    const dayLabel = (key) => dateFromKey(key).toLocaleDateString(locale, { day: "numeric", month: "short" });
    const withUnit = (value) => `${money(value)} ${currency}`;

    // The period lives in the pinned bar above; only the currency stays with the section.
    const controls = <CurrencySelect value={currency} onChange={setCurrency} label={t("currencyLabel")} />;

    function renderBody() {
        if (range.tooLong) {
            return <p className="rounded-xl border border-dashed border-destructive/40 py-8 text-center text-sm text-destructive">{t("rangeTooLong", { max: MAX_RANGE_DAYS })}</p>;
        }
        if (loadFailed) {
            return (
                <Card className="rounded-xl">
                    <Card.Content className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
                        <Button variant="secondary" size="sm" onClick={retry}>{t("retry")}</Button>
                    </Card.Content>
                </Card>
            );
        }
        if (!stats) {
            return (
                <div className="flex flex-col gap-6" aria-busy="true">
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
                    </div>
                    <Skeleton className="h-72 rounded-xl" />
                </div>
            );
        }
        if (stats.isEmpty) {
            return (
                <Card className="rounded-xl">
                    <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
                        <p className="text-sm font-semibold text-foreground">{t("emptyTitle")}</p>
                        <p className="max-w-md text-sm text-muted-foreground">{t("emptyBody")}</p>
                        <Link href={`/${workspaceSlug}/finance/transactions`} className="mt-1 text-sm font-medium text-primary hover:underline">
                            {t("viewTransactions")} →
                        </Link>
                    </Card.Content>
                </Card>
            );
        }

        const { totals, deltas, series } = stats;
        const withLabels = (values) => values.map((value, i) => ({ label: dayLabel(series.labels[i]), value: Math.round(value) }));
        const vsPrevious = t("vsPrevious");
        const previousSales = totals.previous.sales;

        return (
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 *:min-w-0 gap-2.5 sm:gap-4 xl:grid-cols-4">
                    <StatCard
                        icon={Wallet} label={t("kpiSales")} hint={t("kpiSalesHint")}
                        value={withUnit(totals.current.sales)} caption={t("paymentsCount", { count: totals.current.payments })}
                        delta={deltas.sales} deltaLabel={vsPrevious} goodDirection="up"
                        series={withLabels(series.sales.current)} color={COLOR_SALES} formatValue={withUnit}
                    />
                    <StatCard
                        icon={Receipt} label={t("kpiPayments")} hint={t("kpiPaymentsHint")}
                        value={String(totals.current.payments)}
                        delta={deltas.payments} deltaLabel={vsPrevious} goodDirection="up"
                        series={withLabels(series.payments)} color={COLOR_PAYMENTS} formatValue={(value) => String(value)}
                    />
                    <StatCard
                        icon={Calculator} label={t("kpiAverage")} hint={t("kpiAverageHint")}
                        value={withUnit(totals.current.average)}
                        delta={deltas.average} deltaLabel={vsPrevious} goodDirection="up"
                        series={withLabels(series.average)} color={COLOR_AVERAGE} formatValue={withUnit}
                    />
                    <StatCard
                        icon={RotateCcw} label={t("kpiRefunds")} hint={t("kpiRefundsHint")}
                        value={withUnit(totals.current.refunds)} caption={t("refundsCount", { count: totals.current.refundCount })}
                        delta={deltas.refunds} deltaLabel={vsPrevious} goodDirection="down"
                        series={withLabels(series.refunds)} color={COLOR_REFUNDS} formatValue={withUnit}
                    />
                </div>

                <section className="flex min-w-0 flex-col gap-3">
                    <div>
                        <div className="flex items-center gap-1">
                            <h3 className="text-sm font-semibold text-foreground">{t("salesOverTime")}</h3>
                            <InfoTooltip text={t("salesOverTimeInfo")} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t("salesOverTimeSub", { currency })}</p>
                    </div>
                    {stats.days === 1 ? (
                        <Card className="rounded-xl">
                            <Card.Content className="flex flex-wrap gap-x-10 gap-y-4 p-5">
                                <div>
                                    <p className="mb-2 text-sm font-medium text-muted-foreground">{t("thisPeriod")}</p>
                                    <p className="text-2xl font-bold leading-none tabular-nums text-foreground"><NumberWithUnit value={withUnit(totals.current.sales)} /></p>
                                </div>
                                <div>
                                    <p className="mb-2 text-sm font-medium text-muted-foreground">{t("previousPeriod")}</p>
                                    <p className="text-2xl font-bold leading-none tabular-nums text-foreground"><NumberWithUnit value={withUnit(previousSales)} /></p>
                                </div>
                            </Card.Content>
                        </Card>
                    ) : (
                        <AreaChart
                            data={withLabels(series.sales.current)}
                            height={220}
                            formatValue={(value) => `${money(value)}`}
                            label={t("thisPeriod")}
                            color={COLOR_SALES}
                            title={t("salesTotalLabel", { days: stats.days })}
                            currentValue={Math.round(totals.current.sales)}
                            unit={currency}
                            headerStats={[{
                                label: t("previousPeriod"),
                                value: withUnit(previousSales),
                                color: COLOR_PREVIOUS,
                                toggle: { isSelected: showPrevious, onChange: setShowPrevious, ariaLabel: t("showPrevious") },
                            }]}
                            overlay={showPrevious ? { values: series.sales.previous.map(Math.round), label: t("previousPeriod"), color: COLOR_PREVIOUS } : null}
                        />
                    )}
                </section>
            </div>
        );
    }

    const breakdown = stats?.breakdown;
    const salesTotal = stats?.totals.current.sales ?? 0;
    const paymentsNote = (row) => t("paymentsCount", { count: row.count });
    const rowsOf = (rows, noteOf) => rows.map((row) => ({
        key: row.key,
        label: row.other ? t("other") : row.key,
        value: row.value,
        note: noteOf(row),
    }));

    return (
        <div className="flex flex-col gap-6 min-w-0 max-w-full">
            {/* The period picker stays pinned to the top while the page scrolls — the same bar as Team workload's.
                It is solid at the top and fades out downward, so content dissolves under it; the fade ignores the
                pointer and only the controls take clicks. The page padding is cancelled so it spans edge to edge,
                and the negative bottom margin gives back the room the fade adds. It stays pinned while the Finance
                section scrolls past, then Team workload's own bar takes over. */}
            <div className="sticky top-[var(--dash-sticky-offset,0px)] z-40 -mx-4 sm:-mx-8 -mb-4 sm:-mb-6 px-4 sm:px-8 pt-1 sm:pt-3 pb-5 sm:pb-8 bg-linear-to-b from-background from-65% to-transparent pointer-events-none">
                <div className="flex items-center justify-between gap-3 pointer-events-auto">
                    <span className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-foreground">
                        {t("periodLabel")}
                        <InfoTooltip text={t("periodNote")} />
                    </span>
                    <TrendRangeControls range={range} />
                </div>
            </div>

            <Section first title={t("title")} description={t("subtitle")} right={controls}>
                {renderBody()}
            </Section>

            {stats && !stats.isEmpty && breakdown && (
                <Section title={t("secSources")} description={t("secSourcesDesc")}>
                    <div className="grid grid-cols-1 *:min-w-0 gap-2.5 sm:gap-4 lg:grid-cols-3">
                        <BreakdownCard
                            title={t("byMethod")} rows={rowsOf(breakdown.method, paymentsNote)} total={salesTotal}
                            currency={currency} color={COLOR_METHOD} emptyText={t("noData")} t={t}
                        />
                        <BreakdownCard
                            title={t("byPackage")} rows={rowsOf(breakdown.package, paymentsNote)} total={salesTotal}
                            currency={currency} color={COLOR_PACKAGE} emptyText={t("noData")} t={t}
                        />
                        <BreakdownCard
                            title={t("byCurrency")} hint={t("byCurrencyHint")} total={salesTotal}
                            rows={rowsOf(breakdown.currency, (row) => (stats.originalByCurrency[row.key] != null ? `${money(stats.originalByCurrency[row.key])} ${row.key}` : undefined))}
                            currency={currency} color={COLOR_CURRENCY} emptyText={t("noData")} t={t}
                        />
                    </div>
                    <Link href={`/${workspaceSlug}/finance/transactions`} className="self-start text-sm font-medium text-primary hover:underline">
                        {t("viewTransactions")} →
                    </Link>
                </Section>
            )}
        </div>
    );
}
