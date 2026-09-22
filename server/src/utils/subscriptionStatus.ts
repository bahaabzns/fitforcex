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

export type SubscriptionDetails = {
    status: SubscriptionStatus;
    /**
     * End of the period matching `status` — the period containing "today" for
     * Active/Frozen, the next upcoming period for Pre-start, or the most
     * recently lapsed period for Expired (also what the expiry grace window
     * in getEffectiveAccessForClient is measured against). Null when there is
     * no started period.
     */
    currentPeriodEnd: Date | null;
    /** Start of that same period — paired with currentPeriodEnd for progress display (e.g. "12 of 30 days remaining"). Null when there is no started period. */
    currentPeriodStart: Date | null;
    /**
     * End of the LAST period in the chain — i.e. currentPeriodEnd plus the
     * duration of any renewal transactions already queued after it. Equals
     * currentPeriodEnd when there's no queued renewal on file. Used to widen
     * the progress-bar total by however many days the client has already
     * paid ahead, without changing what currentPeriodEnd itself means.
     */
    totalCoverageEnd: Date | null;
};

/**
 * Computes a client's subscription status AND the start/end of the period
 * that status refers to. The status branches are identical to the
 * long-standing computeSubscriptionStatus (which now delegates here) — only
 * the extra currentPeriodStart/currentPeriodEnd are new, so existing
 * status-only behaviour is preserved.
 */
export function computeSubscriptionDetails(
    allTransactions:        TxRow[],
    freezes:                FreezeRow[],
    firstPlanActivationDate: Date | string | null
): SubscriptionDetails {
    if (allTransactions.length === 0) return { status: 'No Subscriptions', currentPeriodEnd: null, currentPeriodStart: null, totalCoverageEnd: null };

    const completed = allTransactions
        .filter(t => t.status === 'completed' && t.duration && Number(t.duration) > 0)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (completed.length === 0) return { status: 'Pre-start', currentPeriodEnd: null, currentPeriodStart: null, totalCoverageEnd: null };

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
            return { status: 'Pre-start', currentPeriodEnd: null, currentPeriodStart: null, totalCoverageEnd: null };
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

    if (periods.length === 0) return { status: 'Pre-start', currentPeriodEnd: null, currentPeriodStart: null, totalCoverageEnd: null };

    // End of the last period in the chain — i.e. how far the client's paid
    // coverage extends once any already-queued renewals are included.
    const totalCoverageEnd = periods[periods.length - 1].end;

    // The period that matters for status/display is the one "today" actually
    // falls in (or, failing that, the next upcoming one) — NOT always the
    // last period in the chain. A client can have a queued renewal transaction
    // already on file while still mid-way through their current period; using
    // the chain's last period here previously made the client portal show
    // "days remaining" against that future queued period instead of the
    // active one (e.g. 89/89 remaining on day one of a 90-day plan, because
    // the queued second transaction's 90-day span was being measured instead).
    for (const { start, end } of periods) {
        if (today < start) return { status: 'Pre-start', currentPeriodEnd: end, currentPeriodStart: start, totalCoverageEnd };
        if (today >= start && today < end) {
            for (const freeze of freezes) {
                const fs = new Date(freeze.freeze_start_date);
                fs.setHours(0, 0, 0, 0);
                const fe = new Date(fs.getTime() + Number(freeze.freeze_duration_days) * 86400000);
                if (today >= fs && today < fe) return { status: 'Frozen', currentPeriodEnd: end, currentPeriodStart: start, totalCoverageEnd };
            }
            return { status: 'Active', currentPeriodEnd: end, currentPeriodStart: start, totalCoverageEnd };
        }
    }

    // Fell through every period → expired. The last period in the chain is,
    // by construction, the one that most recently ended — this is also what
    // the expiry grace-window calc in getEffectiveAccessForClient depends on.
    const lastPeriod = periods[periods.length - 1];
    return { status: 'Expired', currentPeriodEnd: lastPeriod.end, currentPeriodStart: lastPeriod.start, totalCoverageEnd };
}

export function computeSubscriptionStatus(
    allTransactions:        TxRow[],
    freezes:                FreezeRow[],
    firstPlanActivationDate: Date | string | null
): SubscriptionStatus {
    return computeSubscriptionDetails(allTransactions, freezes, firstPlanActivationDate).status;
}
