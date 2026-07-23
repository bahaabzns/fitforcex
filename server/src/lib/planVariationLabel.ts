/** Plan variations don't carry a free-text marketing name (decision: auto-generated display
 *  text based on limits, e.g. "Up to 50 clients" / "Unlimited clients") — this is the single
 *  place that generates it, so admin previews and the public API never drift apart. */
export function formatPlanVariationLabel(variation: { max_clients: number | null }): string {
    return variation.max_clients == null
        ? 'Unlimited clients'
        : `Up to ${variation.max_clients} clients`;
}
