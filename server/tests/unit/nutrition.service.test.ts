import { calculateEquivalentAmount, resolveSwapAmount, toNumberOrNull } from '../../src/modules/nutrition/nutrition.service';

describe('calculateEquivalentAmount', () => {
    it('matches the coach portal\'s calorie-equivalence formula (client/hooks/useNutritionPlan.js)', () => {
        // 200g chicken (165 kcal/100g) = 330 target kcal.
        // Turkey (135 kcal/100g): (330/135)*100 = 244.4...
        const amount = calculateEquivalentAmount(
            { amount: 200, servingSize: 100, caloriesPerServing: 165 },
            { servingSize: 100, caloriesPerServing: 135 }
        );
        expect(amount).toBeCloseTo(244.4, 1);
    });

    it('rounds to one decimal place', () => {
        const amount = calculateEquivalentAmount(
            { amount: 150, servingSize: 100, caloriesPerServing: 200 },
            { servingSize: 100, caloriesPerServing: 233 }
        );
        // targetCalories = 300; 300/233*100 = 128.75... -> rounds to 128.8
        expect(amount).toBe(128.8);
    });

    it('returns null when the source has no serving size', () => {
        const amount = calculateEquivalentAmount(
            { amount: 200, servingSize: 0, caloriesPerServing: 165 },
            { servingSize: 100, caloriesPerServing: 135 }
        );
        expect(amount).toBeNull();
    });

    it('returns null when the target has no calories per serving', () => {
        const amount = calculateEquivalentAmount(
            { amount: 200, servingSize: 100, caloriesPerServing: 165 },
            { servingSize: 100, caloriesPerServing: 0 }
        );
        expect(amount).toBeNull();
    });

    it('handles a huge amount without overflow or precision loss', () => {
        const amount = calculateEquivalentAmount(
            { amount: 1_000_000, servingSize: 100, caloriesPerServing: 165 },
            { servingSize: 100, caloriesPerServing: 165 }
        );
        expect(amount).toBe(1_000_000);
    });
});

describe('resolveSwapAmount', () => {
    it('returns the calorie-equivalent amount when it can be computed, flagged as matched', () => {
        const resolved = resolveSwapAmount(
            { amount: 200, servingSize: 100, caloriesPerServing: 165 },
            { servingSize: 100, caloriesPerServing: 135 }
        );
        expect(resolved).toEqual({ amount: 244.4, isCalorieMatched: true });
    });

    it('falls back to the target\'s own serving size when the target has 0 calories/serving', () => {
        // e.g. black coffee, water, spices — calorie-matching is undefined,
        // but the food is still a legitimate same-category swap option.
        const resolved = resolveSwapAmount(
            { amount: 200, servingSize: 100, caloriesPerServing: 165 },
            { servingSize: 250, caloriesPerServing: 0 }
        );
        expect(resolved).toEqual({ amount: 250, isCalorieMatched: false });
    });

    it('falls back to the target\'s own serving size when the source has no usable calorie data', () => {
        const resolved = resolveSwapAmount(
            { amount: 200, servingSize: 100, caloriesPerServing: 0 },
            { servingSize: 100, caloriesPerServing: 135 }
        );
        expect(resolved).toEqual({ amount: 100, isCalorieMatched: false });
    });

    it('returns null when the target has no serving size at all', () => {
        const resolved = resolveSwapAmount(
            { amount: 200, servingSize: 100, caloriesPerServing: 165 },
            { servingSize: 0, caloriesPerServing: 0 }
        );
        expect(resolved).toBeNull();
    });
});

describe('toNumberOrNull', () => {
    it('parses a numeric string', () => {
        expect(toNumberOrNull('42')).toBe(42);
    });

    it('returns null for empty string, null, and undefined', () => {
        expect(toNumberOrNull('')).toBeNull();
        expect(toNumberOrNull(null)).toBeNull();
        expect(toNumberOrNull(undefined)).toBeNull();
    });

    it('returns null for a non-numeric string', () => {
        expect(toNumberOrNull('not-a-number')).toBeNull();
    });
});
