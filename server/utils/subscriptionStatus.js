/**
 * Compute a client's subscription status from raw DB rows.
 *
 * @param {object[]} allTransactions - raw rows from the transactions table (snake_case)
 * @param {object[]} freezes         - raw rows from subscription_freezes (snake_case)
 * @param {Date|string|null} firstPlanActivationDate - earliest activated_at across training+nutrition plans
 * @returns {'Pre-start'|'Active'|'Expired'|'Frozen'|'Refunded'}
 */
function computeSubscriptionStatus(allTransactions, freezes, firstPlanActivationDate) {
    if (allTransactions.length === 0) return 'No Subscriptions';
    // Refunded transactions are excluded from period calculation — kept for history only.

    const completed = allTransactions
        .filter(t => t.status === 'completed' && t.duration && Number(t.duration) > 0)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (completed.length === 0) return 'Pre-start';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let prevEnd = null;
    const periods = [];

    for (const tx of completed) {
        let start;
        const mode = tx.start_mode || 'on_first_plan';

        if (mode === 'custom' && tx.subscription_start_date) {
            start = new Date(tx.subscription_start_date);
        } else if (prevEnd !== null) {
            // Queued (or 'on_first_plan' for a subsequent subscription): starts after previous ends
            start = new Date(prevEnd);
        } else if (firstPlanActivationDate) {
            // First subscription, 'on_first_plan': use plan activation date
            start = new Date(firstPlanActivationDate);
        } else {
            // First subscription, no plan activated yet
            return 'Pre-start';
        }

        start.setHours(0, 0, 0, 0);

        let endMs = start.getTime() + Number(tx.duration) * 24 * 60 * 60 * 1000;

        for (const freeze of freezes) {
            const fs = new Date(freeze.freeze_start_date);
            fs.setHours(0, 0, 0, 0);
            if (fs >= start && fs.getTime() < endMs) {
                endMs += Number(freeze.freeze_duration_days) * 24 * 60 * 60 * 1000;
            }
        }

        periods.push({ start, end: new Date(endMs) });
        prevEnd = new Date(endMs);
    }

    if (periods.length === 0) return 'Pre-start';

    for (const { start, end } of periods) {
        if (today < start) return 'Pre-start';
        if (today >= start && today < end) {
            for (const freeze of freezes) {
                const fs = new Date(freeze.freeze_start_date);
                fs.setHours(0, 0, 0, 0);
                const fe = new Date(fs.getTime() + Number(freeze.freeze_duration_days) * 24 * 60 * 60 * 1000);
                if (today >= fs && today < fe) return 'Frozen';
            }
            return 'Active';
        }
    }

    return 'Expired';
}

module.exports = { computeSubscriptionStatus };
