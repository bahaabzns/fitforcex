import cron from 'node-cron';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../lib/prisma';
import { computeClientStatus, logSubscriptionAudit, getEffectiveAccessForClient } from '../modules/subscriptionPolicies/subscriptionPolicies.service';
import { recordEvent, ownerRecipients } from '../lib/events';

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

// The frontend derives its own label per type per audience (see NotificationBell.js /
// the client-portal notifications page) — this title is only the stored fallback.
const STATUS_NOTIFICATION: Record<string, { type: string; title: string } | undefined> = {
    Expired: { type: 'subscription.expired',     title: 'A client’s subscription expired' },
    Frozen:  { type: 'subscription.frozen',      title: 'A client’s subscription was paused' },
    Active:  { type: 'subscription.reactivated', title: 'A client’s subscription reactivated' },
};

export function scheduleFormDispatcher(): void {
    cron.schedule('0 * * * *', async () => {
        try {
            const pending = await prisma.form_requests.findMany({
                where: {
                    scheduled_at:    { lte: new Date() },
                    action_taken_at: null,
                    status:          'pending',
                },
            });
            for (const form of pending) {
                await prisma.form_requests.update({
                    where: { id: form.id },
                    data:  { action_taken_at: new Date(), status: 'sent' },
                });
            }
            if (pending.length > 0) {
                console.info(`[Scheduler] Dispatched ${pending.length} form(s)`);
            }
        } catch (err) {
            console.error('[Scheduler] Form dispatcher error:', err);
        }
    });
}

export function scheduleSubscriptionExpiry(): void {
    cron.schedule('0 0 * * *', async () => {
        try {
            const { count } = await prisma.workspace_subscriptions.updateMany({
                where: { status: 'active', expires_at: { lt: new Date() } },
                data:  { status: 'expired' },
            });
            if (count > 0) {
                console.info(`[Scheduler] Expired ${count} subscription(s)`);
            }
        } catch (err) {
            console.error('[Scheduler] Subscription expiry error:', err);
        }
    });
}

/**
 * Recomputes every client's subscription status daily, persists the change to the
 * clients.subscription_status snapshot, and writes a 'status.change' audit row so
 * automatic Active→Expired / →Frozen transitions are logged. The read path stays
 * computed; this snapshot exists only for change detection. Cadence: 00:30 daily.
 */
export function scheduleClientStatusSync(): void {
    cron.schedule('30 0 * * *', async () => {
        try {
            const clients = await prisma.clients.findMany({
                where:  { workspace_id: { not: null } },
                select: { id: true, workspace_id: true, subscription_status: true },
            });

            let changed = 0;
            for (const client of clients) {
                if (!client.workspace_id) continue;
                try {
                    const { status } = await computeClientStatus(client.id, client.workspace_id);
                    if (status === client.subscription_status) continue;

                    await prisma.clients.update({
                        where: { id: client.id },
                        data:  { subscription_status: status },
                    });
                    await logSubscriptionAudit({
                        workspaceId: client.workspace_id,
                        clientId:    client.id,
                        actorType:   'system',
                        eventType:   'status.change',
                        fromStatus:  client.subscription_status,
                        toStatus:    status,
                    });

                    // Durable notification alongside the live-computed portal banner —
                    // so the coach has a paper trail and the client sees it even after
                    // the moment the banner would've caught their attention has passed.
                    const notice = STATUS_NOTIFICATION[status];
                    if (notice) {
                        await recordEvent({
                            workspaceId: client.workspace_id,
                            type:        notice.type,
                            importance:  status === 'Active' ? 'info' : 'alert',
                            title:       notice.title,
                            recipients:  [
                                { type: 'client', id: client.id },
                                ...await ownerRecipients(client.workspace_id),
                            ],
                            actor:  { type: 'system' },
                            entity: { type: 'client', id: client.id },
                        });
                    }

                    changed++;
                } catch (err) {
                    console.error('[Scheduler] Status sync failed for client', client.id, err);
                }
            }
            if (changed > 0) {
                console.info(`[Scheduler] Synced ${changed} client status change(s)`);
            }
        } catch (err) {
            console.error('[Scheduler] Client status sync error:', err);
        }

        // Isolated in its own try/catch so a failure here can't block the
        // status-sync loop above, or vice versa.
        try {
            await runReviewDueCheckTick();
        } catch (err) {
            console.error('[Scheduler] Review-due check error:', err);
        }
    });
}

/**
 * Package Lifecycle Phase 4 — review-due notifications. One batched query
 * across both plan tables, not an extra query nested inside
 * scheduleClientStatusSync's per-client loop (§14.2 of the Package Lifecycle
 * plan: that loop already iterates every client once per tick; adding a
 * second per-client query would turn an O(clients) job into O(clients × 2)
 * for no benefit, since the date condition is expressible in SQL). Exported
 * separately from its cron registration so it can be exercised directly.
 */
export async function runReviewDueCheckTick(): Promise<number> {
    const dueForReview = await prisma.$queryRaw<
        { id: string; workspace_id: string; client_id: string; plan_type: 'nutrition' | 'training' }[]
    >`
        SELECT id, workspace_id, client_id, 'nutrition' AS plan_type FROM nutrition_plans
        WHERE status = 'active' AND cycle_end_at IS NOT NULL AND review_notified_at IS NULL
          AND review_offset_days IS NOT NULL
          AND cycle_end_at - (review_offset_days || ' days')::interval <= NOW()
        UNION ALL
        SELECT id, workspace_id, client_id, 'training' AS plan_type FROM training_plans
        WHERE status = 'active' AND cycle_end_at IS NOT NULL AND review_notified_at IS NULL
          AND review_offset_days IS NOT NULL
          AND cycle_end_at - (review_offset_days || ' days')::interval <= NOW()
    `;

    let notified = 0;
    for (const row of dueForReview) {
        try {
            if (row.plan_type === 'nutrition') {
                await prisma.nutrition_plans.update({ where: { id: row.id }, data: { review_notified_at: new Date() } });
            } else {
                await prisma.training_plans.update({ where: { id: row.id }, data: { review_notified_at: new Date() } });
            }
            await recordEvent({
                workspaceId: row.workspace_id,
                type:        'plan.review_due',
                importance:  'actionable',
                title:       `A client's ${row.plan_type} plan is approaching its end date`,
                recipients:  await ownerRecipients(row.workspace_id),
                actor:       { type: 'system' },
                entity:      { type: row.plan_type === 'nutrition' ? 'nutrition_plan' : 'training_plan', id: row.id },
                metadata:    { clientId: row.client_id },
            });
            notified++;
        } catch (err) {
            console.error('[Scheduler] Review-due notify failed for plan', row.id, err);
        }
    }
    if (notified > 0) {
        console.info(`[Scheduler] Sent ${notified} review-due notification(s)`);
    }
    return notified;
}

/**
 * Package Lifecycle Phase 4 — dispatches due check_in_schedules rows into
 * form_requests, one-off. Hourly, same cadence as scheduleFormDispatcher.
 * Batched (take 500) with bounded concurrency (chunks of 50) so a large
 * backlog can't balloon a single tick — see §14.2-14.3 of the plan. The tick
 * body is exported separately from its cron registration so it can be
 * exercised directly (e.g. for verification) without waiting for the clock.
 */
export async function runCheckInDispatchTick(): Promise<number> {
    const due = await prisma.check_in_schedules.findMany({
        where: { next_due_at: { lte: new Date() }, paused_at: null },
        take: 500,
    });

    let dispatched = 0;
    for (const batch of chunk(due, 50)) {
        await Promise.all(batch.map(async (row) => {
            try {
                // An expired-and-outside-grace client can't act on a
                // check-in anyway (allow_submit_checkins is already
                // denied by the portal policy engine) — skip without
                // advancing next_due_at, so dispatch resumes exactly
                // where it left off once the client is Active again
                // (§12.7 of the plan), not from a reset point.
                const effective = await getEffectiveAccessForClient(row.client_id, row.workspace_id);
                if (effective.status !== 'Active' && !effective.withinGrace) return;

                await prisma.$transaction([
                    prisma.form_requests.create({
                        data: {
                            id:              createId(),
                            form_id:         row.form_id,
                            client_id:       row.client_id,
                            workspace_id:    row.workspace_id,
                            status:          'sent',
                            requested_at:    new Date(),
                            scheduled_at:    new Date(),
                            action_taken_at: new Date(),
                        },
                    }),
                    // Check-in forms are one-shot -- fired exactly once, at
                    // the plan's end date -- so the schedule row is deleted
                    // rather than advanced to a next occurrence.
                    prisma.check_in_schedules.delete({ where: { id: row.id } }),
                ]);

                await recordEvent({
                    workspaceId: row.workspace_id,
                    type:        'checkin.requested',
                    importance:  'actionable',
                    title:       'A new check-in is ready for you',
                    recipients:  [{ type: 'client', id: row.client_id }],
                    actor:       { type: 'system' },
                    entity:      { type: 'form_request', id: row.form_id },
                });
                dispatched++;
            } catch (err) {
                console.error('[Scheduler] Check-in dispatch failed for schedule', row.id, err);
            }
        }));
    }
    if (dispatched > 0) {
        console.info(`[Scheduler] Dispatched ${dispatched} check-in(s)`);
    }
    return dispatched;
}

export function scheduleCheckInDispatch(): void {
    cron.schedule('0 * * * *', async () => {
        try {
            await runCheckInDispatchTick();
        } catch (err) {
            console.error('[Scheduler] Check-in dispatch error:', err);
        }
    });
}

export function scheduleSessionCleanup(): void {
    cron.schedule('0 2 * * *', async () => {
        try {
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const { count } = await prisma.user_sessions.deleteMany({
                where: {
                    OR: [
                        { revoked_at: { lt: cutoff } },
                        { expires_at: { lt: cutoff } },
                    ],
                },
            });
            if (count > 0) {
                console.info(`[Scheduler] Cleaned up ${count} expired session(s)`);
            }
        } catch (err) {
            console.error('[Scheduler] Session cleanup error:', err);
        }
    });
}
