export function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * The coach portal's food-equivalence formula (ported from
 * client/hooks/useNutritionPlan.js), now the single source of truth so the
 * client-portal food swap can reuse it server-side instead of trusting a
 * client-supplied amount. Matches calories only, by design — same as the
 * coach-side "add alternative" flow.
 */
export function calculateEquivalentAmount(
    source: { amount: number; servingSize: number; caloriesPerServing: number },
    target: { servingSize: number; caloriesPerServing: number }
): number | null {
    if (!source.servingSize || !source.caloriesPerServing) return null;
    if (!target.servingSize || !target.caloriesPerServing) return null;

    const targetCalories = (source.amount / source.servingSize) * source.caloriesPerServing;
    return Math.round((targetCalories / target.caloriesPerServing) * target.servingSize * 10) / 10;
}
