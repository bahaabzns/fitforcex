import cron from 'node-cron';
import { prisma } from '../lib/prisma';

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
