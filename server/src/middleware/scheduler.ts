import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { computeClientStatus, logSubscriptionAudit } from '../modules/subscriptionPolicies/subscriptionPolicies.service';

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
