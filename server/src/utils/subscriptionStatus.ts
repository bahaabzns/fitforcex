type TxRow = {
    status:                  string;
    duration?:               number | string | null;
    start_mode?:             string | null;
    subscription_start_date?: string | Date | null;
    created_at:              string | Date;
};

type FreezeRow = {
    freeze_start_date:    string | Date;
    freeze_duration_days: number | string;
    client_id?:           string;
};

export type SubscriptionStatus = 'No Subscriptions' | 'Pre-start' | 'Active' | 'Expired' | 'Frozen';

export function computeSubscriptionStatus(
    allTransactions:        TxRow[],
    freezes:                FreezeRow[],
    firstPlanActivationDate: Date | string | null
): SubscriptionStatus {
    if (allTransactions.length === 0) return 'No Subscriptions';

    const completed = allTransactions
        .filter(t => t.status === 'completed' && t.duration && Number(t.duration) > 0)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (completed.length === 0) return 'Pre-start';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let prevEnd: Date | null = null;
    const periods: Array<{ start: Date; end: Date }> = [];

    for (const tx of completed) {
        let start: Date;
        const mode = tx.start_mode || 'on_first_plan';

        if (mode === 'custom' && tx.subscription_start_date) {
            start = new Date(tx.subscription_start_date);
        } else if (prevEnd !== null) {
            start = new Date(prevEnd);
        } else if (firstPlanActivationDate) {
            start = new Date(firstPlanActivationDate);
        } else {
            return 'Pre-start';
        }

        start.setHours(0, 0, 0, 0);

        let endMs = start.getTime() + Number(tx.duration) * 86400000;

        for (const freeze of freezes) {
            const fs = new Date(freeze.freeze_start_date);
            fs.setHours(0, 0, 0, 0);
            if (fs >= start && fs.getTime() < endMs) {
                endMs += Number(freeze.freeze_duration_days) * 86400000;
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
                const fe = new Date(fs.getTime() + Number(freeze.freeze_duration_days) * 86400000);
                if (today >= fs && today < fe) return 'Frozen';
            }
            return 'Active';
        }
    }

    return 'Expired';
}
