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
import { Tabs } from "@heroui/react/tabs";
import api from "@/lib/axios";
import { DEFAULT_DISPLAY_CURRENCY, DISPLAY_CURRENCIES } from "@/lib/currency";
import { buildFinanceStats, rangeEndingToday } from "@/lib/financeStats";
import { StatCard } from "@/app/components/operations/KpiTrendCards";
import ChartCard from "@/app/components/charts/ChartCard";
import TrendChart from "@/app/components/charts/TrendChart";
import BarList from "@/app/components/charts/BarList";

const RANGES = [
    { key: "7d", days: 7 },
    { key: "30d", days: 30 },
    { key: "90d", days: 90 },
    { key: "12m", days: 365 },
];
const DEFAULT_RANGE_KEY = "30d";
const MAX_TRANSACTIONS = 10000;

const COLOR_SALES = "#22c55e";
const COLOR_PAYMENTS = "#3b82f6";
const COLOR_AVERAGE = "#a855f7";
const COLOR_REFUNDS = "#ef4444";
const COLOR_BAR = "var(--viz-s1)";
const COLOR_PREVIOUS = "var(--viz-gray)";

const money = (value) => Math.round(value).toLocaleString("en-US");

function ControlsRow({ title, subtitle, rangeKey, onRangeChange, currency, onCurrencyChange, t }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Tabs selectedKey={rangeKey} onSelectionChange={(key) => onRangeChange(String(key))}>
                    <Tabs.ListContainer>
                        <Tabs.List
                            aria-label={t("rangeLabel")}
                            className="w-fit *:h-6 *:w-fit *:px-3 *:text-sm *:font-normal *:data-[selected=true]:text-accent-foreground"
                        >
                            {RANGES.map(({ key }) => (
                                <Tabs.Tab key={key} id={key}>
                                    {key}
                                    <Tabs.Indicator className="bg-accent" />
                                </Tabs.Tab>
                            ))}
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>
                <Select
                    variant="secondary"
                    aria-label={t("currencyLabel")}
                    value={currency}
                    onChange={(key) => onCurrencyChange(String(key))}
                    className="w-28"
                >
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
            </div>
        </div>
    );
}

function BreakdownCard({ title, rows, formatValue, emptyText }) {
    return (
        <ChartCard title={title}>
            <BarList
                rows={rows.map((row) => ({
                    key: row.key,
                    label: row.label,
                    note: row.note,
                    parts: [{ key: "sales", label: title, value: row.value, color: COLOR_BAR }],
                }))}
                formatValue={formatValue}
                emptyText={emptyText}
            />
        </ChartCard>
    );
}

// The workspace's money at a glance: headline figures with their change against the period before,
// sales over time against that period, and where the sales come from. Figures are computed in the
// browser from the same transactions list the Transactions page uses, in one display currency.
export default function FinanceDashboard() {
    const t = useTranslations("financeDashboard");
    const locale = useLocale();
    const { workspaceSlug } = useParams();

    const [transactions, setTransactions] = useState(null); // null = loading
    const [loadFailed, setLoadFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [rangeKey, setRangeKey] = useState(DEFAULT_RANGE_KEY);
    const [currency, setCurrency] = useState(DEFAULT_DISPLAY_CURRENCY);

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

    const days = RANGES.find((range) => range.key === rangeKey)?.days ?? 30;
    const stats = useMemo(
        () => (transactions ? buildFinanceStats(transactions, { ...rangeEndingToday(days), currency }) : null),
        [transactions, days, currency],
    );

    const dayLabel = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });
    const withUnit = (value) => `${money(value)} ${currency}`;

    const controls = (
        <ControlsRow
            title={t("title")} subtitle={t("subtitle")}
            rangeKey={rangeKey} onRangeChange={setRangeKey}
            currency={currency} onCurrencyChange={setCurrency}
            t={t}
        />
    );

    if (loadFailed) {
        return (
            <section className="flex flex-col gap-4">
                {controls}
                <Card className="rounded-xl">
                    <Card.Content className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
                        <Button variant="secondary" size="sm" onClick={retry}>{t("retry")}</Button>
                    </Card.Content>
                </Card>
            </section>
        );
    }

    if (!stats) {
        return (
            <section className="flex flex-col gap-4" aria-busy="true">
                {controls}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
                </div>
                <Skeleton className="h-72 rounded-xl" />
            </section>
        );
    }

    if (stats.isEmpty) {
        return (
            <section className="flex flex-col gap-4">
                {controls}
                <Card className="rounded-xl">
                    <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
                        <p className="text-sm font-semibold text-foreground">{t("emptyTitle")}</p>
                        <p className="max-w-md text-sm text-muted-foreground">{t("emptyBody")}</p>
                        <Link href={`/${workspaceSlug}/finance/transactions`} className="mt-1 text-sm font-medium text-primary hover:underline">
                            {t("viewTransactions")} →
                        </Link>
                    </Card.Content>
                </Card>
            </section>
        );
    }

    const { totals, deltas, series, breakdown, originalByCurrency } = stats;
    const withLabels = (values) => values.map((value, i) => ({ label: dayLabel(series.labels[i]), value: Math.round(value) }));
    const vsPrevious = t("vsPrevious");

    const breakdownRows = (rows, noteOf) => rows.map((row) => ({
        key: row.key,
        label: row.other ? t("other") : row.key,
        value: row.value,
        note: noteOf(row),
    }));
    const paymentsNote = (row) => t("paymentsCount", { count: row.count });

    return (
        <section className="flex flex-col gap-4">
            {controls}

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

            <ChartCard
                title={t("salesOverTime")}
                subtitle={t("salesOverTimeSub", { currency })}
                legend={[{ label: t("thisPeriod"), color: COLOR_SALES }, { label: t("previousPeriod"), color: COLOR_PREVIOUS }]}
            >
                <TrendChart
                    unit="day"
                    labels={series.labels}
                    formatLabel={dayLabel}
                    emptyText={t("noData")}
                    series={[
                        { key: "previous", label: t("previousPeriod"), color: COLOR_PREVIOUS, values: series.sales.previous.map(Math.round) },
                        { key: "current", label: t("thisPeriod"), color: COLOR_SALES, values: series.sales.current.map(Math.round) },
                    ]}
                />
            </ChartCard>

            <div className="grid gap-4 lg:grid-cols-3">
                <BreakdownCard title={t("byMethod")} rows={breakdownRows(breakdown.method, paymentsNote)} formatValue={withUnit} emptyText={t("noData")} />
                <BreakdownCard title={t("byPackage")} rows={breakdownRows(breakdown.package, paymentsNote)} formatValue={withUnit} emptyText={t("noData")} />
                <BreakdownCard
                    title={t("byCurrency")}
                    rows={breakdownRows(breakdown.currency, (row) => (originalByCurrency[row.key] != null ? `${money(originalByCurrency[row.key])} ${row.key}` : undefined))}
                    formatValue={withUnit}
                    emptyText={t("noData")}
                />
            </div>

            <Link href={`/${workspaceSlug}/finance/transactions`} className="self-start text-sm font-medium text-primary hover:underline">
                {t("viewTransactions")} →
            </Link>
        </section>
    );
}
