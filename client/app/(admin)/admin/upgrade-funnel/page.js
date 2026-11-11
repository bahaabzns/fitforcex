'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/axios';
import { Skeleton } from '@heroui/react/skeleton';
import { MousePointerClick, ShoppingCart, BadgeCheck, Trophy, Lightbulb } from 'lucide-react';
import StatTile from '@/app/components/charts/StatTile';

const WINDOWS = [
    { days: 7, label: 'Last 7 days' },
    { days: 30, label: 'Last 30 days' },
    { days: 90, label: 'Last 90 days' },
    { days: 0, label: 'All time' },
];
const DEFAULT_WINDOW_DAYS = 30;
const MIN_CLICKS_TO_RANK_A_BUTTON = 5;

const SOURCE_LABELS = {
    topbar:            'Top bar button',
    sidebar_meter:     'Sidebar client meter',
    limit_popup:       'Limit popup (hit a limit)',
    lock_branding:     'Lock icon · Custom branding',
    expiry_banner:     'Plan-ending banner',
    subscription_page: 'Subscription page (direct)',
};

const TABLE_COLUMNS = 'grid-cols-[minmax(200px,1.6fr)_repeat(6,minmax(90px,1fr))_110px]';

const formatPercent = (value) => (value === null || value === undefined ? '—' : `${value}%`);

function buildInsights(report) {
    const rankable = report.bySource.filter(row => row.coachesReached >= MIN_CLICKS_TO_RANK_A_BUTTON && row.reachedToPaidPercent !== null);
    const insights = [];

    const best = [...rankable].sort((a, b) => b.reachedToPaidPercent - a.reachedToPaidPercent)[0];
    if (best && best.coachesPaid > 0) {
        insights.push(`${SOURCE_LABELS[best.source]} converts best: ${best.coachesPaid} of ${best.coachesReached} coaches who reached it paid (${best.reachedToPaidPercent}%).`);
    }

    const leaky = [...rankable]
        .filter(row => row.checkoutsStarted >= MIN_CLICKS_TO_RANK_A_BUTTON && row.coachesPaid === 0)
        .sort((a, b) => b.checkoutsStarted - a.checkoutsStarted)[0];
    if (leaky) {
        insights.push(`${SOURCE_LABELS[leaky.source]} gets coaches to checkout (${leaky.checkoutsStarted}) but none have paid yet — check the price or payment step.`);
    }

    if (report.totals.clicks < MIN_CLICKS_TO_RANK_A_BUTTON) {
        insights.push('Not enough clicks yet to compare buttons. This fills in as coaches use them.');
    }
    return insights;
}

export default function AdminUpgradeFunnelPage() {
    const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        api.get('/api/admin/upgrade-funnel', { params: { days: windowDays } })
            .then(res => { if (!cancelled) setReport(res.data); })
            .catch(() => { if (!cancelled) setError('Failed to load the upgrade report'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [windowDays]);

    const insights = useMemo(() => (report ? buildInsights(report) : []), [report]);
    const bestSource = report?.bySource.find(row => row.coachesPaid > 0);

    return (
        <div className="flex flex-col gap-6 p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Upgrade buttons</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Which upgrade prompts coaches click, and which ones end in a payment.
                    </p>
                </div>
                <select
                    value={windowDays}
                    onChange={event => { setLoading(true); setError(''); setWindowDays(Number(event.target.value)); }}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                    aria-label="Time window"
                >
                    {WINDOWS.map(({ days, label }) => <option key={days} value={days}>{label}</option>)}
                </select>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {loading && !report && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
                </div>
            )}

            {report && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatTile icon={MousePointerClick} label="Upgrade clicks" value={report.totals.clicks} note="Across every button" />
                        <StatTile icon={ShoppingCart} label="Checkouts started" value={report.totals.checkoutsStarted} note="Coaches who reached the payment step" />
                        <StatTile icon={BadgeCheck} label="Coaches who paid" value={report.totals.coachesPaid} note={`${formatPercent(report.totals.checkoutToPaidPercent)} of checkouts ended in a payment`} />
                        <StatTile icon={Trophy} label="Best button" value={bestSource ? SOURCE_LABELS[bestSource.source] : '—'} note={bestSource ? `${bestSource.coachesPaid} ${bestSource.coachesPaid === 1 ? 'payment' : 'payments'} brought in` : 'No payments from a button yet'} />
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

                    <section className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Button by button</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                A payment counts for the button that opened checkout, even if the coach paid later. Reached = coaches who clicked the button, or who saw the limit popup (it opens by itself). Reached → paid = coaches who paid ÷ coaches reached.
                            </p>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-border">
                            <div className="min-w-225">
                                <div className={`grid ${TABLE_COLUMNS} gap-4 bg-secondary/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
                                    <span>Button</span>
                                    <span>Shown</span>
                                    <span>Clicks</span>
                                    <span>Coaches reached</span>
                                    <span>Plan picked</span>
                                    <span>Checkout</span>
                                    <span>Paid</span>
                                    <span>Reached → paid</span>
                                </div>
                                {report.bySource.map((row, index) => (
                                    <div key={row.source} className={`grid ${TABLE_COLUMNS} items-center gap-4 px-4 py-3 ${index > 0 ? 'border-t border-border' : ''}`}>
                                        <span className="text-sm font-medium text-foreground">{SOURCE_LABELS[row.source] ?? row.source}</span>
                                        <span className="text-sm text-foreground">{row.shown}</span>
                                        <span className="text-sm text-foreground">{row.clicks}</span>
                                        <span className="text-sm text-foreground">{row.coachesReached}</span>
                                        <span className="text-sm text-foreground">{row.plansSelected}</span>
                                        <span className="text-sm text-foreground">{row.checkoutsStarted}</span>
                                        <span className="text-sm font-semibold text-foreground">{row.coachesPaid}</span>
                                        <span className="text-sm font-semibold text-foreground">{formatPercent(row.reachedToPaidPercent)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
