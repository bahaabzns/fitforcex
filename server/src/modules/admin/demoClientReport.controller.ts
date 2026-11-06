import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { DEMO_EVENT } from '../demoClient/demoClient.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// "Fast" adoption window used to compare cohorts fairly: older coaches have simply had more time to add a client.
const QUICK_WINDOW_DAYS = 7;

interface CoachRow {
    created_at: Date;
    demo_client_created_at: Date | null;
    first_real_client_at: Date | null;
    events: string[] | null;
}

interface CohortStats {
    signups: number;
    withRealClient: number;
    rate: number | null;
    matureSignups: number;
    realClientWithinWindow: number;
    rateWithinWindow: number | null;
    medianDaysToFirstRealClient: number | null;
}

const percent = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
const daysBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / MS_PER_DAY;
const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return roundOneDecimal(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

function cohortStats(coaches: CoachRow[], now: Date): CohortStats {
    const withRealClient = coaches.filter((coach) => coach.first_real_client_at);
    // Only coaches who signed up at least a full window ago can fairly be asked "did they add a client within the window".
    const mature = coaches.filter((coach) => daysBetween(coach.created_at, now) >= QUICK_WINDOW_DAYS);
    const quick = mature.filter((coach) => coach.first_real_client_at && daysBetween(coach.created_at, coach.first_real_client_at) <= QUICK_WINDOW_DAYS);
    return {
        signups: coaches.length,
        withRealClient: withRealClient.length,
        rate: percent(withRealClient.length, coaches.length),
        matureSignups: mature.length,
        realClientWithinWindow: quick.length,
        rateWithinWindow: percent(quick.length, mature.length),
        medianDaysToFirstRealClient: median(withRealClient.map((coach) => Math.max(0, daysBetween(coach.created_at, coach.first_real_client_at!)))),
    };
}

const FUNNEL_STEPS: Array<{ key: string; label: string }> = [
    { key: DEMO_EVENT.CREATED, label: 'Got a demo client' },
    { key: DEMO_EVENT.WELCOME_SEEN, label: 'Saw the welcome screen' },
    { key: DEMO_EVENT.OPENED, label: 'Opened the demo client' },
    { key: DEMO_EVENT.EDITED, label: 'Edited the demo diet or training' },
    { key: DEMO_EVENT.VIEWED_APP, label: 'Viewed it in the client app' },
    { key: DEMO_EVENT.DELETED, label: 'Deleted the demo client' },
];

/** Signup → first real client, before vs. after the demo client launched, plus how far coaches got with the demo. */
export async function getDemoClientReport(_req: Request, res: Response, next: NextFunction) {
    try {
        const now = new Date();
        const coaches = await prisma.$queryRaw<CoachRow[]>`
            SELECT w.created_at, w.demo_client_created_at,
                   (SELECT MIN(c.created_at) FROM clients c WHERE c.workspace_id = w.id AND c.is_demo = FALSE) AS first_real_client_at,
                   (SELECT ARRAY_AGG(e.event_type) FROM demo_client_events e WHERE e.workspace_id = w.id) AS events
            FROM workspaces w
            WHERE w.archived_at IS NULL
        `;

        const launchedAt = coaches.reduce<Date | null>(
            (earliest, coach) => (coach.demo_client_created_at && (!earliest || coach.demo_client_created_at < earliest) ? coach.demo_client_created_at : earliest), null,
        );
        const before = coaches.filter((coach) => !launchedAt || coach.created_at < launchedAt);
        const after = coaches.filter((coach) => launchedAt && coach.created_at >= launchedAt);

        const withDemo = coaches.filter((coach) => coach.demo_client_created_at);
        const hasEvent = (coach: CoachRow, key: string) => (coach.events ?? []).includes(key);
        const addedRealAfterDemo = (coach: CoachRow) => !!coach.first_real_client_at && !!coach.demo_client_created_at && coach.first_real_client_at > coach.demo_client_created_at;

        const funnel = FUNNEL_STEPS.map((step) => ({ ...step, coaches: withDemo.filter((coach) => hasEvent(coach, step.key)).length }));
        const engagement = FUNNEL_STEPS.filter((step) => [DEMO_EVENT.OPENED, DEMO_EVENT.EDITED, DEMO_EVENT.VIEWED_APP].includes(step.key as never)).map((step) => {
            const did = withDemo.filter((coach) => hasEvent(coach, step.key));
            const didNot = withDemo.filter((coach) => !hasEvent(coach, step.key));
            return {
                ...step,
                did: { coaches: did.length, addedRealClient: did.filter(addedRealAfterDemo).length, rate: percent(did.filter(addedRealAfterDemo).length, did.length) },
                didNot: { coaches: didNot.length, addedRealClient: didNot.filter(addedRealAfterDemo).length, rate: percent(didNot.filter(addedRealAfterDemo).length, didNot.length) },
            };
        });

        const daysAfterDemo = withDemo.filter(addedRealAfterDemo).map((coach) => Math.max(0, daysBetween(coach.demo_client_created_at!, coach.first_real_client_at!)));

        res.json({
            launchedAt,
            quickWindowDays: QUICK_WINDOW_DAYS,
            cohorts: { before: cohortStats(before, now), after: cohortStats(after, now) },
            withDemo: { coaches: withDemo.length, addedRealClientAfter: withDemo.filter(addedRealAfterDemo).length, medianDaysToFirstRealClient: median(daysAfterDemo) },
            funnel,
            engagement,
        });
    } catch (err) {
        next(err);
    }
}
