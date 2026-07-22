import { calculateEquivalentAmount, toNumberOrNull } from '../../src/modules/nutrition/nutrition.service';

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
