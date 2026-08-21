/** Plan variations don't carry a free-text marketing name (decision: auto-generated display
 *  text based on limits, e.g. "Up to 50 clients" / "Unlimited clients") — this is the single
 *  place that generates it, so admin previews and the public API never drift apart. Team
 *  seats are appended only when the variation actually carries one (TeamForce) — Free/
 *  OneForce variations leave it null and inherit the plan's flat seat count instead, so
 *  showing it here would be redundant with what's already on the plan card.
 *
 *  Locale-aware (English default, Arabic on request) — callers facing the public pricing
 *  section return both (see plans.controller.ts's label_en/label_ar) rather than branching on
 *  a request-side locale signal, matching how every other bilingual field in this app works
 *  (server always returns both languages, the client picks — see migration 012's precedent). */
export function formatPlanVariationLabel(
    variation: { max_clients: number | null; max_team_seats?: number | null },
    locale: 'en' | 'ar' = 'en'
): string {
    if (locale === 'ar') {
        const clients = variation.max_clients == null ? 'عملاء غير محدودين' : `حتى ${variation.max_clients} عميل`;
        if (variation.max_team_seats == null) return clients;
        const seats = variation.max_team_seats === 0
            ? null
            : variation.max_team_seats === 1
                ? 'مقعد فريق واحد'
                : `${variation.max_team_seats} مقاعد فريق`;
        return seats ? `${clients} · ${seats}` : clients;
    }

    const clients = variation.max_clients == null ? 'Unlimited clients' : `Up to ${variation.max_clients} clients`;
    if (variation.max_team_seats == null) return clients;
    const seats = variation.max_team_seats === 0
        ? null
        : `${variation.max_team_seats} team seat${variation.max_team_seats === 1 ? '' : 's'}`;
    return seats ? `${clients} · ${seats}` : clients;
}
