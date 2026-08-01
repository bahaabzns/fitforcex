import { prisma } from './prisma';

/**
 * Founder decision 10: when the admin-controlled trial expires, the workspace reverts to
 * Free automatically unless the coach already upgraded (an upgrade replaces plan_id/status
 * via the normal checkout path, so this sweep simply finds nothing left to revert for them).
 * Exported separately from its cron registration (see middleware/scheduler.ts) so it can be
 * exercised directly, matching the existing tick pattern in this codebase.
 */
export async function runTrialExpirySweep(): Promise<number> {
    const expiredTrials = await prisma.workspace_subscriptions.findMany({
        where:  { status: 'trialing', expires_at: { lt: new Date() } },
        select: { id: true, workspace_id: true },
    });
    if (!expiredTrials.length) return 0;

    const freePlan = await prisma.plans.findFirst({
        where:  { name: 'free', is_active: true },
        select: { id: true, plan_variations: { where: { is_default: true }, select: { id: true, price_monthly: true, currency: true } } },
    });
    if (!freePlan) {
        console.error('[TrialSweep] No active "free" plan found — cannot revert expired trials');
        return 0;
    }
    const variation = freePlan.plan_variations[0];

    let reverted = 0;
    for (const sub of expiredTrials) {
        try {
            await prisma.workspace_subscriptions.update({
                where: { id: sub.id },
                data: {
                    plan_id:              freePlan.id,
                    variation_id:         variation?.id ?? null,
                    locked_price_monthly: variation?.price_monthly ?? null,
                    locked_currency:      variation?.currency ?? null,
                    status:               'active',
                    expires_at:           null,
                },
            });
            reverted++;
        } catch (err) {
            console.error('[TrialSweep] Failed to revert trial for workspace', sub.workspace_id, err);
        }
    }
    return reverted;
}
