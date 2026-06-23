import 'package:fitforce_x/shared/models/nutrition_plan.dart';
import 'package:fitforce_x/shared/utils/nutrition_calc.dart';
import 'package:flutter_test/flutter_test.dart';

NutritionMealItem _item({
  double amount = 100,
  double servingSize = 100,
  double cal = 200,
  double protein = 20,
  double carbs = 10,
  double fats = 5,
}) {
  return NutritionMealItem(
    id: 'i',
    amount: amount,
    servingSize: servingSize,
    caloriesPerServing: cal,
    proteinPerServing: protein,
    carbsPerServing: carbs,
    fatsPerServing: fats,
  );
}

void main() {
  group('calcItem', () {
    test('scales by amount / serving_size', () {
      final m = calcItem(_item(amount: 150, servingSize: 100));
      expect(m.calories, 300); // 200 * 1.5
      expect(m.protein, 30);
      expect(m.carbs, 15);
      expect(m.fats, 7.5);
    });

    test('rounds to 2 decimals', () {
      final m = calcItem(_item(amount: 33, servingSize: 100, cal: 100));
      expect(m.calories, 33); // 100 * 0.33
    });

    test('guards against zero serving size', () {
      final m = calcItem(_item(amount: 100, servingSize: 0));
      expect(m.calories, 0);
    });
  });

  group('calcMeal / calcCycle', () {
    test('sums items then meals', () {
      final meal = NutritionMeal(
        id: 'm',
        items: [
          _item(cal: 100, protein: 10, carbs: 5, fats: 2),
          _item(cal: 50, protein: 5, carbs: 2, fats: 1)
        ],
      );
      final mealTotals = calcMeal(meal);
      expect(mealTotals.calories, 150);
      expect(mealTotals.protein, 15);

      final cycle = NutritionCycle(id: 'c', meals: [meal, meal]);
      final cycleTotals = calcCycle(cycle);
      expect(cycleTotals.calories, 300);
      expect(cycleTotals.protein, 30);
    });

    test('empty meal yields zero', () {
      expect(calcMeal(const NutritionMeal(id: 'm')).calories, 0);
      expect(calcCycle(const NutritionCycle(id: 'c')).macroCalories, 0);
    });
  });

  group('Macros.macroCalories', () {
    test('uses 4/4/9', () {
      const m = Macros(calories: 0, protein: 10, carbs: 10, fats: 10);
      expect(m.macroCalories, 10 * 4 + 10 * 4 + 10 * 9);
    });
  });
}
