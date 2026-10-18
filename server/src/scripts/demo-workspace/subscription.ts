// Subscription timeline per client: back-to-back paid periods, an optional active freeze, and
// the transaction rows that produce them. Every period is written with an explicit start date
// ("custom" start mode), and the stored status is computed with the app's own status function,
// so the clients page, dashboard and finance pages all agree with each other.

import { Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { computeSubscriptionStatus } from '../../utils/subscriptionStatus';
import { addDays, chance, clampToNow, dateOnly, daysAgo, NOW, pick, randInt, withDaytime } from './random';
import type { BuildContext, Period, Profile, Subscription } from './types';
import type { VariationRef } from './setup';

const MAX_HISTORY_DAYS = 430;
const EXTRA_SESSION_NOTES = ['Extra form-check session', 'Body composition analysis', 'One-off posing practice', 'Mobility assessment'];
const PAYMENT_NOTES = ['Paid in full', 'Renewal, same package', 'Referred by a current client', 'Discount applied for early renewal'];

function periodAt(startAgo: number, variation: VariationRef, extensionDays = 0): Period {
    return { start: dateOnly(startAgo), end: dateOnly(startAgo - variation.duration - extensionDays), variation, freeze: null };
}

/** Periods that came before `firstStartAgo`, oldest first, laid end to end. */
function priorPeriods(count: number, firstStartAgo: number, pickVariation: () => VariationRef): Period[] {
    const periods: Period[] = [];
    let nextStartAgo = firstStartAgo;
    for (let i = 0; i < count; i++) {
        const variation = pickVariation();
        const startAgo = nextStartAgo + variation.duration;
        if (startAgo > MAX_HISTORY_DAYS) break;
        periods.unshift(periodAt(startAgo, variation));
        nextStartAgo = startAgo;
    }
    return periods;
}

function buildPeriods(profile: Profile, variations: VariationRef[]): Period[] {
    const pickVariation = () => pick(variations);
    const current = pickVariation();
    const history = (startAgo: number, max: number) => priorPeriods(randInt(0, max), startAgo, pickVariation);

    switch (profile.scenario) {
        case 'none':
            return [];
        case 'preStart':
            return [periodAt(-randInt(2, 25), current)];
        case 'newClient': {
            const startAgo = randInt(0, 6);
            return [periodAt(startAgo, current)];
        }
        case 'expiringSoon': {
            const startAgo = Math.max(0, current.duration - randInt(1, 6));
            return [...history(startAgo, 3), periodAt(startAgo, current)];
        }
        case 'expired': {
            const startAgo = randInt(2, 150) + current.duration;
            return [...history(startAgo, 2), periodAt(startAgo, current)];
        }
        case 'archived': {
            const startAgo = randInt(20, 220) + current.duration;
            return [...history(startAgo, 2), periodAt(startAgo, current)];
        }
        case 'frozen': {
            const startAgo = randInt(9, Math.max(9, current.duration - 2));
            const freezeStartAgo = randInt(1, 6);
            const freezeDays = freezeStartAgo + randInt(3, 14);
            const frozen = periodAt(startAgo, current, freezeDays);
            frozen.freeze = { start: dateOnly(freezeStartAgo), days: freezeDays };
            return [...history(startAgo, 2), frozen];
        }
        default: {
            const startAgo = randInt(1, Math.max(1, current.duration - 7));
            return [...history(startAgo, 3), periodAt(startAgo, current)];
        }
    }
}

function transactionFor(ctx: BuildContext, profile: Profile, period: Period, refunded: boolean): Prisma.transactionsCreateManyInput {
    const paidAt = clampToNow(withDaytime(addDays(period.start, -randInt(0, 3)), 9, 21));
    const discounted = chance(0.12);
    return {
        id: createId(), transaction_code: 0, workspace_id: ctx.workspaceId, client_id: profile.id,
        client_name: `${profile.fname} ${profile.lname}`, package_variation: period.variation.label, package_variation_id: period.variation.id,
        payment_method: pick(ctx.paymentMethods), amount: Math.round(period.variation.price * (discounted ? 0.9 : 1)), currency: period.variation.currency,
        type: 'subscription', status: refunded ? 'refunded' : 'completed', duration: period.variation.duration,
        notes: chance(0.2) ? pick(PAYMENT_NOTES) : null, transaction_date: paidAt, created_at: paidAt,
        subscription_start_date: period.start, start_mode: 'custom',
    };
}

function sessionTransaction(ctx: BuildContext, profile: Profile, currency: string): Prisma.transactionsCreateManyInput {
    const paidAt = daysAgo(randInt(2, 90));
    return {
        id: createId(), transaction_code: 0, workspace_id: ctx.workspaceId, client_id: profile.id,
        client_name: `${profile.fname} ${profile.lname}`, package_variation: null, payment_method: pick(ctx.paymentMethods),
        amount: pick([300, 450, 600]), currency, type: pick(['session', 'one-time']), status: 'completed', duration: null,
        notes: pick(EXTRA_SESSION_NOTES), transaction_date: paidAt, created_at: paidAt, subscription_start_date: null, start_mode: 'on_first_plan',
    };
}

export function buildSubscription(ctx: BuildContext, profile: Profile): Subscription {
    const periods = buildPeriods(profile, ctx.variations);
    if (periods.length === 0) {
        return { periods, createdAt: daysAgo(randInt(1, 40)), status: 'No Subscriptions', hasStarted: false };
    }

    const refundIndex = periods.length >= 3 && chance(0.05) ? 0 : -1;
    const rows = periods.map((period, index) => transactionFor(ctx, profile, period, index === refundIndex));
    if (chance(0.06)) rows.push(sessionTransaction(ctx, profile, periods[0].variation.currency));
    ctx.buffers.transactions.push(...rows);

    const freezes = periods.flatMap((period) => period.freeze
        ? [{ freeze_start_date: period.freeze.start, freeze_duration_days: period.freeze.days }]
        : []);
    for (const freeze of freezes) {
        ctx.buffers.freezes.push({
            id: createId(), client_id: profile.id, freeze_start_date: freeze.freeze_start_date, freeze_duration_days: freeze.freeze_duration_days,
            notes: pick(['Travelling for work', 'Medical leave', 'Family event', 'Exam period']), created_at: daysAgo(randInt(0, 6)),
        });
    }

    // Stored status is the subscription status only (never 'Archived'): the nightly sync recomputes it
    // the same way, so any other value would be "corrected" with a notification per client.
    const status = computeSubscriptionStatus(rows as Parameters<typeof computeSubscriptionStatus>[0], freezes, null);
    const firstStart = periods[0].start;
    const createdAt = profile.scenario === 'preStart'
        ? daysAgo(randInt(1, 12))
        : withDaytime(addDays(firstStart, -randInt(0, 5)), 8, 22);

    return { periods, createdAt: createdAt.getTime() > NOW.getTime() ? daysAgo(1) : createdAt, status, hasStarted: periods[0].start.getTime() <= NOW.getTime() };
}

export const latestPeriod = (subscription: Subscription): Period => subscription.periods[subscription.periods.length - 1];
