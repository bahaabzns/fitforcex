'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useDateFormatter } from '@/utils/useDateFormatter';
import { Skeleton } from '@heroui/react/skeleton';
import { Users, Zap, Clock } from 'lucide-react';
import StatTile from '@/app/components/charts/StatTile';

const formatPercent = (value) => (value === null || value === undefined ? '—' : `${value}%`);
const formatDays = (value) => (value === null || value === undefined ? '—' : `${value} days`);

function CohortTiles({ title, cohort, windowDays }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile
                    icon={Users}
                    label="Sign-up → first real client"
                    value={formatPercent(cohort.rate)}
                    note={`${cohort.withRealClient} of ${cohort.signups} coaches, ever`}
                />
                <StatTile
                    icon={Zap}
                    label={`Added one within ${windowDays} days`}
                    value={formatPercent(cohort.rateWithinWindow)}
                    note={`${cohort.realClientWithinWindow} of ${cohort.matureSignups} coaches who signed up ${windowDays}+ days ago`}
                />
                <StatTile
                    icon={Clock}
                    label="Median days to first real client"
                    value={formatDays(cohort.medianDaysToFirstRealClient)}
                    note="From sign-up, coaches who added one"
                />
            </div>
        </section>
    );
}

function SimpleTable({ columns, rows }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>{columns.map(column => <th key={column} className="px-4 py-2.5 text-left font-semibold">{column}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((cells, index) => (
                        <tr key={index} className="border-t border-border">
                            {cells.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-2.5 text-foreground">{cell}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function AdminDemoClientPage() {
    const { formatDate } = useDateFormatter();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/api/admin/demo-client-report')
            .then(res => setReport(res.data))
            .catch(() => setError('Failed to load the demo client report'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-6 p-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Demo client</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Does the sample client help coaches add their first real client? Compares sign-ups before and after it launched.
                </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {loading && <Skeleton className="h-40 rounded-xl" />}

            {report && (
                <>
                    <p className="text-xs text-muted-foreground">
                        {report.launchedAt ? `Launched ${formatDate(report.launchedAt)}. "After" = coaches who signed up on or after that day.` : 'No demo client has been created yet, so everything is "before".'}
                    </p>
                    <CohortTiles title="Before the demo client" cohort={report.cohorts.before} windowDays={report.quickWindowDays} />
                    <CohortTiles title="After the demo client" cohort={report.cohorts.after} windowDays={report.quickWindowDays} />

                    <section className="flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-foreground">What coaches do with the demo</h2>
                        <p className="text-xs text-muted-foreground">
                            {report.withDemo.coaches} coaches got one. {report.withDemo.addedRealClientAfter} added a real client afterwards
                            {report.withDemo.medianDaysToFirstRealClient !== null && ` (median ${report.withDemo.medianDaysToFirstRealClient} days after the demo appeared)`}.
                        </p>
                        <SimpleTable
                            columns={['Step', 'Coaches', '% of coaches with a demo']}
                            rows={report.funnel.map(step => [step.label, step.coaches, formatPercent(report.withDemo.coaches > 0 ? Math.round((step.coaches / report.withDemo.coaches) * 1000) / 10 : null)])}
                        />
                    </section>

                    <section className="flex flex-col gap-3">
                        <h2 className="text-sm font-semibold text-foreground">Does using the demo lead to a real client?</h2>
                        <SimpleTable
                            columns={['Step', 'Did it: added a client', 'Did not: added a client']}
                            rows={report.engagement.map(step => [
                                step.label,
                                `${formatPercent(step.did.rate)} (${step.did.addedRealClient} of ${step.did.coaches})`,
                                `${formatPercent(step.didNot.rate)} (${step.didNot.addedRealClient} of ${step.didNot.coaches})`,
                            ])}
                        />
                    </section>
                </>
            )}
        </div>
    );
}
