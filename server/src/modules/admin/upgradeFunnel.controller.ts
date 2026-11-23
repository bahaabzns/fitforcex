import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { UPGRADE_SOURCES, AUTO_OPEN_SOURCES } from '../billing/upgradeEvents.service';

const ALL_TIME_DAYS = 0;
const ALLOWED_WINDOWS_DAYS = [7, 30, 90, ALL_TIME_DAYS];
const DEFAULT_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface SourceCountsRow {
    source:             string;
    shown:              bigint;
    coaches_shown:      bigint;
    clicks:             bigint;
    coaches_clicked:    bigint;
    plans_selected:     bigint;
    checkouts_started:  bigint;
    coaches_paid:       bigint;
}

function parseWindowDays(raw: unknown): number {
    const requested = Number(raw);
    return ALLOWED_WINDOWS_DAYS.includes(requested) ? requested : DEFAULT_WINDOW_DAYS;
}

function percentOrNull(part: number, whole: number): number | null {
    return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/**
 * Per upgrade button: how often it was seen, clicked, led to a plan pick, started checkout, and
 * ended in a payment. A payment is credited to the button that opened the checkout (see
 * recordPaidUpgradeEvent), so the paid column is "sales this button brought", not "sales by
 * people who happened to click it once".
 */
export async function getUpgradeFunnel(req: Request, res: Response, next: NextFunction) {
    try {
        const windowDays = parseWindowDays(req.query.days);
        const since = windowDays === ALL_TIME_DAYS ? new Date(0) : new Date(Date.now() - windowDays * MS_PER_DAY);

        const rows = await prisma.$queryRaw<SourceCountsRow[]>(Prisma.sql`
            SELECT source,
                   COUNT(*) FILTER (WHERE event_type = 'shown')                         AS shown,
                   COUNT(DISTINCT workspace_id) FILTER (WHERE event_type = 'shown')     AS coaches_shown,
                   COUNT(*) FILTER (WHERE event_type = 'click')                         AS clicks,
                   COUNT(DISTINCT workspace_id) FILTER (WHERE event_type = 'click')     AS coaches_clicked,
                   COUNT(*) FILTER (WHERE event_type = 'plan_selected')                 AS plans_selected,
                   COUNT(*) FILTER (WHERE event_type = 'checkout_started')              AS checkouts_started,
                   COUNT(DISTINCT workspace_id) FILTER (WHERE event_type = 'paid')      AS coaches_paid
            FROM upgrade_events
            WHERE created_at >= ${since}
            GROUP BY source
        `);

        const countsBySource = new Map(rows.map(row => [row.source, row]));
        const bySource = UPGRADE_SOURCES.map(source => {
            const row = countsBySource.get(source);
            const coachesClicked = Number(row?.coaches_clicked ?? 0);
            const coachesPaid = Number(row?.coaches_paid ?? 0);
            // Buttons are measured from the click; auto-opening popups from the moment they appeared.
            const coachesReached = AUTO_OPEN_SOURCES.includes(source) ? Number(row?.coaches_shown ?? 0) : coachesClicked;
            return {
                source,
                shown:             Number(row?.shown ?? 0),
                clicks:            Number(row?.clicks ?? 0),
                coachesClicked,
                plansSelected:     Number(row?.plans_selected ?? 0),
                checkoutsStarted:  Number(row?.checkouts_started ?? 0),
                coachesPaid,
                coachesReached,
                // Share of coaches who reached this prompt and went on to pay through it.
                reachedToPaidPercent: percentOrNull(coachesPaid, coachesReached),
            };
        }).sort((a, b) => b.coachesPaid - a.coachesPaid || b.clicks - a.clicks);

        const sum = (pick: (row: (typeof bySource)[number]) => number) => bySource.reduce((total, row) => total + pick(row), 0);
        const totals = {
            clicks:           sum(row => row.clicks),
            checkoutsStarted: sum(row => row.checkoutsStarted),
            coachesPaid:      sum(row => row.coachesPaid),
        };

        res.json({
            windowDays,
            totals: { ...totals, checkoutToPaidPercent: percentOrNull(totals.coachesPaid, totals.checkoutsStarted) },
            bySource,
        });
    } catch (err) {
        next(err);
    }
}
