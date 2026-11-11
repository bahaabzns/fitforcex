// Picks which plan to pre-select in the upgrade modal. Pure functions so the rule is easy to read
// and to check on its own.

/** Flattens the public /api/plans response into one row per purchasable variation. */
export function flattenVariations(plans) {
    return (plans ?? []).flatMap(plan =>
        (plan.variations ?? []).map(variation => ({
            planId:       plan.id,
            planName:     plan.display_name,
            planNameAr:   plan.display_name_ar,
            isPopular:    Boolean(plan.is_popular),
            variationId:  variation.id,
            maxClients:   variation.max_clients,
            price:        Number(variation.price_monthly) || 0,
            currency:     variation.currency,
            labelEn:      variation.label_en,
            labelAr:      variation.label_ar,
        })),
    );
}

const capacityOf = (option) => (option.maxClients == null ? Infinity : option.maxClients);

/**
 * The smallest paid option that still has room for one more client than the coach has now
 * (so a coach sitting exactly at their limit is never pre-selected onto the same size).
 * Falls back to the biggest option when nothing has room. Free options and the plan the coach
 * is already on are never offered.
 */
export function pickBestFit(options, { clientCount, currentVariationId }) {
    const upgrades = options.filter(option => option.price > 0 && option.variationId !== currentVariationId);
    if (upgrades.length === 0) return null;

    const bySizeThenPrice = [...upgrades].sort((a, b) => capacityOf(a) - capacityOf(b) || a.price - b.price);
    const hasRoom = bySizeThenPrice.find(option => capacityOf(option) > clientCount);
    return hasRoom ?? bySizeThenPrice[bySizeThenPrice.length - 1];
}

/** Options to list in the modal: every paid variation except the current one, smallest first. */
export function listUpgradeOptions(options, currentVariationId) {
    return options
        .filter(option => option.price > 0 && option.variationId !== currentVariationId)
        .sort((a, b) => capacityOf(a) - capacityOf(b) || a.price - b.price);
}
