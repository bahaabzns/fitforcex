/**
 * Shared by the transactions module (coach) and the client-portal module —
 * one implementation of "what does this transaction's row look like" and
 * "what's its freeze-adjusted subscription status", not two.
 */

export type TxDbRow = Record<string, unknown>;

export function mapRow(row: TxDbRow) {
    return {
        id:                    row.id,
        code:                  row.transaction_code,
        clientId:              row.client_id,
        clientName:            row.client_name,
        packageVariation:      row.package_variation,
        packageVariationId:    row.package_variation_id ?? null,
        paymentMethod:         row.payment_method,
        amount:                Number(row.amount),
        currency:              row.currency,
        duration:              row.duration,
        type:                  row.type,
        status:                row.status,
        notes:                 row.notes,
        proofImage:            row.proof_image,
        date:                  row.transaction_date,
        createdAt:             row.created_at,
        subscriptionStartDate: row.subscription_start_date ?? null,
        startMode:             row.start_mode || 'on_first_plan',
    };
}

export function computePerTxStatuses(
    txByClient: Record<string, TxDbRow[]>,
    freezesByClient: Record<string, TxDbRow[]>,
    planActivationByClient: Record<string, string | null>
): Record<string, string> {
    const result: Record<string, string> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [clientId, allTxs] of Object.entries(txByClient)) {
        const freezes         = freezesByClient[clientId] || [];
        const firstActivation = planActivationByClient[clientId] ?? null;

        for (const tx of allTxs) {
            if (tx.status === 'refunded') { result[tx.id as string] = 'Refunded'; }
        }

        const completed = allTxs
            .filter(tx => tx.status === 'completed' && tx.duration && Number(tx.duration) > 0)
            .sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime());

        let prevEnd: Date | null = null;
        for (const tx of completed) {
            let start: Date;
            const mode = (tx.start_mode as string) || 'on_first_plan';

            if (mode === 'custom' && tx.subscription_start_date) {
                start = new Date(tx.subscription_start_date as string);
            } else if (prevEnd !== null) {
                start = new Date(prevEnd);
            } else if (firstActivation) {
                start = new Date(firstActivation);
            } else {
                result[tx.id as string] = 'Pre-start';
                continue;
            }
            start.setHours(0, 0, 0, 0);

            let endMs = start.getTime() + Number(tx.duration) * 86400000;
            for (const freeze of freezes) {
                const fs = new Date(freeze.freeze_start_date as string);
                fs.setHours(0, 0, 0, 0);
                if (fs >= start && fs.getTime() < endMs) {
                    endMs += Number(freeze.freeze_duration_days) * 86400000;
                }
            }
            prevEnd = new Date(endMs);

            if (today < start) {
                result[tx.id as string] = 'Pre-start';
            } else if (today >= prevEnd) {
                result[tx.id as string] = 'Expired';
            } else {
                let frozen = false;
                for (const freeze of freezes) {
                    const fs = new Date(freeze.freeze_start_date as string);
                    fs.setHours(0, 0, 0, 0);
                    const fe = new Date(fs.getTime() + Number(freeze.freeze_duration_days) * 86400000);
                    if (today >= fs && today < fe) { frozen = true; break; }
                }
                result[tx.id as string] = frozen ? 'Frozen' : 'Active';
            }
        }
    }
    return result;
}
