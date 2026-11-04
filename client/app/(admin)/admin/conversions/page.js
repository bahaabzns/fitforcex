'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/axios';
import { useDateFormatter } from '@/utils/useDateFormatter';
import { Skeleton } from '@heroui/react/skeleton';
import { Search, Lightbulb, Clock, Repeat, UserPlus, BadgeCheck } from 'lucide-react';
import ChartCard from '@/app/components/charts/ChartCard';
import StatTile from '@/app/components/charts/StatTile';
import FunnelChart from '@/app/components/charts/FunnelChart';
import TrendChart from '@/app/components/charts/TrendChart';
import BarList from '@/app/components/charts/BarList';
import ColumnChart from '@/app/components/charts/ColumnChart';
import SegmentedBar from '@/app/components/charts/SegmentedBar';

const COLOR_SIGNED_UP = 'var(--viz-s1)';
const COLOR_SUBSCRIBED = 'var(--viz-s3)';
const MAX_SOURCES_SHOWN = 7;
const MIN_SIGNUPS_TO_RANK_A_SOURCE = 5;
const MIN_COACHES_FOR_AN_INSIGHT = 3;

const STATUS_STYLES = {
    subscribed: 'bg-green-500/15 text-green-700 border-green-300',
    expired:    'bg-orange-500/15 text-orange-700 border-orange-300',
};
const STATUS_LABELS = { subscribed: 'Subscribed', expired: 'Expired' };

// "admin" = a payment you typed in yourself; "manual" = a transfer the coach made that you confirmed.
const PAID_VIA = {
    card:   { label: 'Card',               color: 'var(--viz-s1)' },
    wallet: { label: 'Wallet',             color: 'var(--viz-s2)' },
    manual: { label: 'Manual transfer',    color: 'var(--viz-s3)' },
    admin:  { label: 'Recorded by admin',  color: 'var(--viz-s4)', onFill: '#0b0b0b' },
    fawry:  { label: 'Fawry',              color: 'var(--viz-s5)' },
};

const TABLE_COLUMNS = 'grid-cols-[minmax(180px,1.4fr)_100px_105px_105px_105px_130px_70px_90px_90px_minmax(130px,1fr)]';

const percentOf = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '—');
const formatWeek = (isoDate) => new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// "Unknown" = we should have this number but the coach joined before visit tracking existed.
function Unknown() {
    return <span className="text-xs italic text-muted-foreground">Unknown</span>;
}

function trackedCell(value, unit = '') {
    if (value === null || value === undefined) return <Unknown />;
    return <span className="text-sm text-foreground">{value}{unit}</span>;
}

function buildInsights(report) {
    const { summary, bySource } = report;
    const insights = [];

    if (summary.trackedSubscribers >= MIN_COACHES_FOR_AN_INSIGHT && summary.medianDaysToSubscribe !== null) {
        insights.push(`Half of your subscribers pay within ${summary.medianDaysToSubscribe} days of their first visit — that's your follow-up window.`);
    }
    if (summary.avgDaysOnFreeBeforePaying.basedOn >= MIN_COACHES_FOR_AN_INSIGHT && summary.avgDaysOnFreeBeforePaying.value !== null) {
        insights.push(`Coaches use the free plan for about ${summary.avgDaysOnFreeBeforePaying.value} days before they upgrade.`);
    }

    const rankable = bySource.filter(row => row.signups >= MIN_SIGNUPS_TO_RANK_A_SOURCE && row.subscribers > 0);
    const best = [...rankable].sort((a, b) => b.subscribers / b.signups - a.subscribers / a.signups)[0];
    if (best) {
        insights.push(`${best.source} turns sign-ups into subscribers best: ${best.subscribers} of ${best.signups} (${percentOf(best.subscribers, best.signups)}).`);
    }

    if (summary.trackedSubscribers < MIN_COACHES_FOR_AN_INSIGHT) {
        insights.push('Visit tracking is new, so most subscribers show as Unknown for now. These insights fill in as more coaches come through.');
    }
    return insights;
}

function foldSmallSources(bySource) {
    if (bySource.length <= MAX_SOURCES_SHOWN) return bySource;
    const shown = bySource.slice(0, MAX_SOURCES_SHOWN - 1);
    const rest = bySource.slice(MAX_SOURCES_SHOWN - 1);
    const sum = key => rest.reduce((total, row) => total + row[key], 0);
    return [...shown, { source: 'Other', visitors: sum('visitors'), signups: sum('signups'), subscribers: sum('subscribers') }];
}

function ConversionCharts({ report }) {
    const { funnel, weekly, bySource, timeToSubscribe, paidVia } = report;

    const sourceRows = foldSmallSources(bySource).map(row => ({
        key: row.source,
        label: row.source,
        note: row.signups > 0 ? `${percentOf(row.subscribers, row.signups)} of sign-ups subscribe` : `${row.visitors} visitors, none signed up`,
        parts: [
            { key: 'signups', label: 'Signed up (free)', value: row.signups, color: COLOR_SIGNED_UP },
            { key: 'subscribers', label: 'Subscribed', value: row.subscribers, color: COLOR_SUBSCRIBED },
        ],
    }));

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
                title="From visitor to subscriber"
                subtitle="Everyone we've tracked since visit tracking began, followed to the end"
                table={{
                    columns: ['Step', 'Coaches'],
                    rows: [['Visited', funnel.visitors], ['Signed up (free)', funnel.signedUp], ['Subscribed', funnel.subscribed]],
                }}
            >
                <FunnelChart
                    stages={[
                        { key: 'visitors', label: 'Visited the site', value: funnel.visitors },
                        { key: 'signedUp', label: 'Signed up (free)', value: funnel.signedUp, stepNote: 'of visitors created a free account' },
                        { key: 'subscribed', label: 'Subscribed', value: funnel.subscribed, stepNote: 'of sign-ups went on to pay' },
                    ]}
                />
            </ChartCard>

            <ChartCard
                title="New sign-ups and subscribers, week by week"
                subtitle="Last 12 weeks, all coaches"
                legend={[{ label: 'Signed up (free)', color: COLOR_SIGNED_UP }, { label: 'Subscribed', color: COLOR_SUBSCRIBED }]}
                table={{
                    columns: ['Week starting', 'Signed up', 'Subscribed'],
                    rows: weekly.map(week => [formatWeek(week.weekStart), week.signups, week.subscriptions]),
                }}
            >
                <TrendChart
                    labels={weekly.map(week => week.weekStart)}
                    formatLabel={formatWeek}
                    series={[
                        { key: 'signups', label: 'Signed up', color: COLOR_SIGNED_UP, values: weekly.map(week => week.signups) },
                        { key: 'subscriptions', label: 'Subscribed', color: COLOR_SUBSCRIBED, values: weekly.map(week => week.subscriptions) },
                    ]}
                />
            </ChartCard>

            <ChartCard
                title="Which sources bring paying coaches"
                subtitle="Where each visitor first came from, and how far they got"
                legend={[{ label: 'Signed up (free)', color: COLOR_SIGNED_UP }, { label: 'Subscribed', color: COLOR_SUBSCRIBED }]}
                table={{
                    columns: ['Source', 'Visitors', 'Signed up', 'Subscribed'],
                    rows: bySource.map(row => [row.source, row.visitors, row.signups, row.subscribers]),
                }}
            >
                <BarList rows={sourceRows} emptyText="Sources appear once visitors start coming through." />
            </ChartCard>

            <ChartCard
                title="How long it takes to subscribe"
                subtitle="Days from a coach's first visit to their first payment"
                table={{ columns: ['Time to subscribe', 'Coaches'], rows: timeToSubscribe.map(bucket => [bucket.label, bucket.count]) }}
            >
                <ColumnChart
                    categories={timeToSubscribe.map(bucket => ({ key: bucket.label, label: bucket.label, values: { count: bucket.count } }))}
                    series={[{ key: 'count', label: 'Coaches', color: COLOR_SIGNED_UP }]}
                    emptyText="Appears once coaches who were tracked from their first visit subscribe."
                />
            </ChartCard>

            <ChartCard
                className="xl:col-span-2"
                title="How subscribers paid"
                subtitle="Includes transfers you confirmed and payments you recorded by hand — all of them count as subscriptions"
                table={{ columns: ['Paid via', 'Coaches'], rows: paidVia.map(row => [PAID_VIA[row.method]?.label ?? row.method, row.count]) }}
            >
                <SegmentedBar
                    parts={paidVia.map(row => ({ key: row.method, label: PAID_VIA[row.method]?.label ?? row.method, value: row.count, color: PAID_VIA[row.method]?.color ?? 'var(--viz-gray)', onFill: PAID_VIA[row.method]?.onFill }))}
                    emptyText="Appears once coaches subscribe."
                />
            </ChartCard>
        </div>
    );
}

function SubscriberTable({ coaches }) {
    const { formatDate } = useDateFormatter();
    const [statusFilter, setStatusFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [search, setSearch] = useState('');

    const sources = useMemo(() => [...new Set(coaches.map(coach => coach.firstSource).filter(Boolean))].sort(), [coaches]);

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return coaches.filter(coach => {
            if (statusFilter && coach.status !== statusFilter) return false;
            if (sourceFilter === '__unknown') { if (coach.firstSource) return false; }
            else if (sourceFilter && coach.firstSource !== sourceFilter) return false;
            if (!needle) return true;
            return [coach.workspaceName, coach.ownerName, coach.ownerEmail].some(text => text?.toLowerCase().includes(needle));
        });
    }, [coaches, statusFilter, sourceFilter, search]);

    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold text-foreground">Every coach who has subscribed</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">&ldquo;Unknown&rdquo; means they joined before visit tracking existed, so we never saw their first visit.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/40"
                        placeholder="Search workspace, owner, or email…"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                    />
                </div>
                <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">All statuses</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none">
                    <option value="">All sources</option>
                    {sources.map(source => <option key={source} value={source}>{source}</option>)}
                    <option value="__unknown">Unknown</option>
                </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
                <div className="min-w-[1240px]">
                    <div className={`grid ${TABLE_COLUMNS} gap-4 bg-secondary/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
                        <span>Coach</span>
                        <span>Status</span>
                        <span>First visit</span>
                        <span>Signed up</span>
                        <span>Subscribed</span>
                        <span>Paid via</span>
                        <span>Visits</span>
                        <span>Days to pay</span>
                        <span>Days on free</span>
                        <span>First source</span>
                    </div>
                    {visible.length === 0 ? (
                        <div className="border-t border-border py-14 text-center text-sm text-muted-foreground">No coaches found.</div>
                    ) : visible.map((coach, index) => (
                        <div key={coach.workspaceId} className={`grid ${TABLE_COLUMNS} items-center gap-4 px-4 py-3 ${index > 0 ? 'border-t border-border' : ''}`}>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{coach.workspaceName}</p>
                                <p className="truncate text-xs text-muted-foreground">{coach.ownerName} · {coach.ownerEmail}</p>
                            </div>
                            <span className={`justify-self-start whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[coach.status]}`}>{STATUS_LABELS[coach.status]}</span>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">{coach.firstVisitAt ? formatDate(coach.firstVisitAt) : <Unknown />}</span>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(coach.signedUpAt)}</span>
                            <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(coach.paidAt)}</span>
                            <div className="min-w-0">
                                <p className="truncate text-sm text-foreground">{PAID_VIA[coach.paidVia]?.label ?? coach.paidVia}</p>
                                <p className="truncate text-xs text-muted-foreground">{coach.paidAmount.toLocaleString()} {coach.paidCurrency}</p>
                            </div>
                            {trackedCell(coach.visitsBeforeSubscribing)}
                            {trackedCell(coach.daysToSubscribe)}
                            <span className="text-sm text-foreground">{coach.daysOnFreeBeforePaying}</span>
                            <div className="min-w-0">
                                {coach.firstSource ? (
                                    <>
                                        <p className="truncate text-sm text-foreground">{coach.firstSource}</p>
                                        {coach.firstCampaign && <p className="truncate text-xs text-muted-foreground">{coach.firstCampaign}</p>}
                                    </>
                                ) : <Unknown />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function AdminConversionsPage() {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/api/admin/conversions')
            .then(res => setReport(res.data))
            .catch(() => setError('Failed to load conversions'))
            .finally(() => setLoading(false));
    }, []);

    const insights = useMemo(() => (report ? buildInsights(report) : []), [report]);

    return (
        <div className="flex flex-col gap-6 p-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Conversions</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    How visitors become free sign-ups, and how free sign-ups become paying coaches.
                </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {loading && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
                </div>
            )}

            {report && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatTile
                            icon={Clock}
                            label="Average days to subscribe"
                            value={report.summary.avgDaysToSubscribe.value ?? '—'}
                            note={report.summary.avgDaysToSubscribe.basedOn > 0
                                ? `From first visit to first payment · ${report.summary.avgDaysToSubscribe.basedOn} tracked ${report.summary.avgDaysToSubscribe.basedOn === 1 ? 'coach' : 'coaches'}`
                                : 'Needs a subscriber we tracked from their first visit'}
                        />
                        <StatTile
                            icon={Repeat}
                            label="Average visits before subscribing"
                            value={report.summary.avgVisitsBeforeSubscribing.value ?? '—'}
                            note={report.summary.avgVisitsBeforeSubscribing.basedOn > 0
                                ? `Separate visits, not page views · ${report.summary.avgVisitsBeforeSubscribing.basedOn} tracked ${report.summary.avgVisitsBeforeSubscribing.basedOn === 1 ? 'coach' : 'coaches'}`
                                : 'Needs a subscriber we tracked from their first visit'}
                        />
                        <StatTile
                            icon={UserPlus}
                            label="Visitors who sign up"
                            value={percentOf(report.funnel.signedUp, report.funnel.visitors)}
                            note={`${report.funnel.signedUp} of ${report.funnel.visitors} tracked visitors`}
                        />
                        <StatTile
                            icon={BadgeCheck}
                            label="Sign-ups who subscribe"
                            value={percentOf(report.summary.totalSubscribers, report.summary.totalSignups)}
                            note={`${report.summary.totalSubscribers} of ${report.summary.totalSignups} coaches, ever`}
                        />
                    </div>

                    {insights.length > 0 && (
                        <section className="flex gap-3 rounded-xl border border-border bg-card p-4">
                            <Lightbulb size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                            <div className="flex flex-col gap-1">
                                <h2 className="text-sm font-semibold text-foreground">What this tells you</h2>
                                <ul className="flex flex-col gap-1">
                                    {insights.map(sentence => <li key={sentence} className="text-sm text-muted-foreground">{sentence}</li>)}
                                </ul>
                            </div>
                        </section>
                    )}

                    <ConversionCharts report={report} />
                    <SubscriberTable coaches={report.coaches} />
                </>
            )}
        </div>
    );
}
