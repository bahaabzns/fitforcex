'use client';

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { useRouter, useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Users, ClipboardList, TrendingUp, AlertCircle } from 'lucide-react';
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";
import { Tabs } from "@heroui/react";
import { DateRangePicker } from "@heroui/react/date-range-picker";
import { RangeCalendar } from "@heroui/react/range-calendar";
import { DateField } from "@heroui/react/date-field";
import AreaChart from "@/app/components/charts/AreaChart";
import WelcomeOnboarding from "@/app/components/WelcomeOnboarding";
import { toStartOfDay, toEndOfDay, filterByRange, rangeForDays, PRESETS, deltaInfo } from "@/utils/chartDateRange";
import { usePageTitle } from "@/hooks/usePageTitle";

const STATUS_CHIP = {
    Active:      "bg-green-500/15 text-green-700",
    Expired:     "bg-destructive/10 text-destructive",
    Frozen:      "bg-accent/15 text-accent",
    "Pre-start": "bg-yellow-500/15 text-yellow-600",
    Cancelled:   "bg-secondary text-muted-foreground",
    Refunded:    "bg-purple-500/15 text-purple-600",
};

export default function DashboardPage() {
    const { formatDate } = useDateFormatter();
    const locale = useLocale();
    const [data, setData] = useState(null);
    const router = useRouter();
    const { workspaceSlug } = useParams();
    const t = useTranslations('dashboard');
    const tNav = useTranslations('nav');
    usePageTitle(tNav('dashboard'));
    const [showWelcome, setShowWelcome] = useState(false);
    const [dateRange, setDateRange] = useState(rangeForDays(90));
    const [activePreset, setActivePreset] = useState("90d");

    useEffect(() => {
        api.get('/api/dashboard')
            .then(res => setData(res.data))
            .catch(() => router.push('/login'));
    }, [router]);

    // Show the onboarding gate to brand-new coaches. Registration redirects here
    // with ?welcome=1 — a query param (not localStorage) because the redirect
    // crosses origins (auth domain → my. subdomain), and localStorage isn't shared
    // across them. Also show it while the Default Libraries are still cloning.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('welcome') === '1') {
            setShowWelcome(true);
            // Strip the param so a refresh doesn't re-trigger the popup.
            window.history.replaceState(null, '', `/${workspaceSlug}/dashboard`);
            return;
        }
        api.get('/api/auth/clone-status')
            .then(res => { if (res.data.status !== 'ready') setShowWelcome(true); })
            .catch(() => {});
    }, [workspaceSlug]);

    const startDate = useMemo(() => dateRange ? toStartOfDay(dateRange.start) : null, [dateRange]);
    const endDate   = useMemo(() => dateRange ? toEndOfDay(dateRange.end) : null, [dateRange]);

    function applyPreset(preset) {
        setActivePreset(preset.label);
        setDateRange(preset.days === null ? null : rangeForDays(preset.days));
    }

    function handlePickerChange(range) {
        setDateRange(range);
        setActivePreset(null);
    }

    const filteredGrowth = useMemo(
        () => filterByRange(data?.clientGrowth ?? [], startDate, endDate),
        [data, startDate, endDate]
    );
    const growthChartData = useMemo(() => filteredGrowth.map(h => ({
        label: new Date(h.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: h.value,
    })), [filteredGrowth, locale]);
    const growthInfo = deltaInfo(filteredGrowth);

    if (!data) {
        return (
            <div className="p-8">
                <Skeleton className="h-8 w-52 rounded-lg mb-8" />
                <div className="flex gap-4 flex-wrap mb-8">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-28 w-44 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-5 w-32 rounded mb-3" />
                {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 rounded-lg mb-2" />
                ))}
            </div>
        );
    }

    const { fname, stats, recentClients } = data;

    return (
        <div className="p-8 flex flex-col gap-6">
            {showWelcome && (
                <WelcomeOnboarding workspaceSlug={workspaceSlug} onDone={() => setShowWelcome(false)} />
            )}

            {/* Greeting */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">
                    {t('welcomeBack', { name: fname })}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4">
                {[
                    { icon: Users,         label: t('totalClients'),  value: stats.totalClients },
                    { icon: TrendingUp,    label: t('activeClients'), value: stats.activeClients,
                      sub: stats.totalClients > 0
                          ? t('ofTotal', { pct: Math.round((stats.activeClients / stats.totalClients) * 100) })
                          : undefined },
                    { icon: AlertCircle,   label: t('expired'),        value: stats.expiredClients },
                    { icon: ClipboardList, label: t('pendingForms'),  value: stats.pendingForms,
                      sub: stats.pendingForms > 0 ? t('awaitingResponse') : t('allCaughtUp') },
                ].map(({ icon: Icon, label, value, sub, accent }) => (
                    <Card key={label} className="min-w-40">
                        <Card.Content className="flex flex-col gap-3 p-5">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10"}`}>
                                <Icon size={17} className={accent ? "text-white" : "text-primary"} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{value}</p>
                                <p className="text-sm text-muted-foreground">{label}</p>
                                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                            </div>
                        </Card.Content>
                    </Card>
                ))}
            </div>

            {/* Metrics */}
            <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">{t('metrics')}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <DateRangePicker value={dateRange} onChange={handlePickerChange}>
                            <DateField.Group>
                                <DateField.Input slot="start">
                                    {(segment) => <DateField.Segment segment={segment} />}
                                </DateField.Input>
                                <DateRangePicker.RangeSeparator />
                                <DateField.Input slot="end">
                                    {(segment) => <DateField.Segment segment={segment} />}
                                </DateField.Input>
                                <DateField.Suffix>
                                    <DateRangePicker.Trigger>
                                        <DateRangePicker.TriggerIndicator />
                                    </DateRangePicker.Trigger>
                                </DateField.Suffix>
                            </DateField.Group>
                            <DateRangePicker.Popover>
                                <RangeCalendar aria-label="Date range">
                                    <RangeCalendar.Header>
                                        <RangeCalendar.YearPickerTrigger>
                                            <RangeCalendar.YearPickerTriggerHeading />
                                            <RangeCalendar.YearPickerTriggerIndicator />
                                        </RangeCalendar.YearPickerTrigger>
                                        <RangeCalendar.NavButton slot="previous" />
                                        <RangeCalendar.NavButton slot="next" />
                                    </RangeCalendar.Header>
                                    <RangeCalendar.Grid>
                                        <RangeCalendar.GridHeader>
                                            {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                                        </RangeCalendar.GridHeader>
                                        <RangeCalendar.GridBody>
                                            {(date) => <RangeCalendar.Cell date={date} />}
                                        </RangeCalendar.GridBody>
                                    </RangeCalendar.Grid>
                                    <RangeCalendar.YearPickerGrid>
                                        <RangeCalendar.YearPickerGridBody>
                                            {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                                        </RangeCalendar.YearPickerGridBody>
                                    </RangeCalendar.YearPickerGrid>
                                </RangeCalendar>
                            </DateRangePicker.Popover>
                        </DateRangePicker>
                        <Tabs
                            selectedKey={activePreset}
                            onSelectionChange={(key) => applyPreset(PRESETS.find(p => p.label === key))}
                        >
                            <Tabs.ListContainer>
                                <Tabs.List
                                    aria-label="Timeframe"
                                    className="w-fit *:h-6 *:w-fit *:px-3 *:text-sm *:font-normal *:data-[selected=true]:text-accent-foreground"
                                >
                                    {PRESETS.map(p => (
                                        <Tabs.Tab key={p.label} id={p.label}>
                                            {p.label}
                                            <Tabs.Indicator className="bg-accent" />
                                        </Tabs.Tab>
                                    ))}
                                </Tabs.List>
                            </Tabs.ListContainer>
                        </Tabs>
                    </div>
                </div>
                <AreaChart
                    data={growthChartData}
                    height={220}
                    formatValue={v => Math.round(v).toString()}
                    label={t('clientGrowth')}
                    title={t('clientGrowth')}
                    currentValue={filteredGrowth.length > 0 ? filteredGrowth[filteredGrowth.length - 1].value : null}
                    startValue={filteredGrowth.length > 1 ? filteredGrowth[0].value : null}
                    readingsCount={filteredGrowth.length}
                    delta={growthInfo?.delta ?? null}
                />
            </section>

            {/* Recent clients */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-foreground">{t('recentClients')}</h2>
                    <Link
                        href={`/${workspaceSlug}/clients`}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                        {t('viewAll')} →
                    </Link>
                </div>

                {recentClients.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-10 text-center">
                        <p className="text-sm text-muted-foreground">{t('noClients')}</p>
                        <Link
                            href={`/${workspaceSlug}/clients`}
                            className="mt-2 inline-block text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                            {t('addFirstClient')} →
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                        {recentClients.map((client, idx) => (
                            <Link
                                key={client.id}
                                href={`/${workspaceSlug}/clients/${client.id}`}
                                className={`flex items-center gap-3 px-4 py-3 hover:bg-default/40 transition-colors ${
                                    idx < recentClients.length - 1 ? "border-b border-border" : ""
                                }`}
                            >
                                <Avatar size="sm" color="primary" className="shrink-0">
                                    <Avatar.Fallback>
                                        {`${client.fname?.[0] ?? ""}${client.lname?.[0] ?? ""}`.toUpperCase() || "?"}
                                    </Avatar.Fallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {client.fname} {client.lname}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                                </div>
                                <Chip
                                    size="sm"
                                    className={`shrink-0 ${STATUS_CHIP[client.subscription_status] ?? "bg-secondary text-muted-foreground"}`}
                                >
                                    {client.subscription_status}
                                </Chip>
                                <span className="text-xs text-muted-foreground shrink-0">
                                    {formatDate(client.created_at)}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
