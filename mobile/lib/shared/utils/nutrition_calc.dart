import '../models/nutrition_plan.dart';

/// Aggregated macros for an item / meal / cycle.
class Macros {
  const Macros({
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fats,
  });

  final double calories;
  final double protein;
  final double carbs;
  final double fats;

  static const zero = Macros(calories: 0, protein: 0, carbs: 0, fats: 0);

  /// Energy from macros only (4/4/9), used to decide whether the donut is empty.
  double get macroCalories => carbs * 4 + protein * 4 + fats * 9;
}

/// Round to 2 decimals — the `r2` helper from `lib/nutritionCalc.js`.
double _r2(double n) => (n * 100).round() / 100;

/// Scales an item's per-serving macros by amount / serving_size.
/// Port of `calcItem`.
Macros calcItem(NutritionMealItem item) {
  final factor = item.servingSize == 0 ? 0.0 : item.amount / item.servingSize;
  return Macros(
    calories: _r2(item.caloriesPerServing * factor),
    protein: _r2(item.proteinPerServing * factor),
    carbs: _r2(item.carbsPerServing * factor),
    fats: _r2(item.fatsPerServing * factor),
  );
}

/// Sums the items in a meal. Port of `calcMeal`.
Macros calcMeal(NutritionMeal meal) {
  var calories = 0.0, protein = 0.0, carbs = 0.0, fats = 0.0;
  for (final item in meal.items) {
    final m = calcItem(item);
    calories += m.calories;
    protein += m.protein;
    carbs += m.carbs;
    fats += m.fats;
  }
  return Macros(
    calories: _r2(calories),
    protein: _r2(protein),
    carbs: _r2(carbs),
    fats: _r2(fats),
  );
}

/// Sums the meals in a cycle. Port of `calcCycle`.
Macros calcCycle(NutritionCycle cycle) {
  var calories = 0.0, protein = 0.0, carbs = 0.0, fats = 0.0;
  for (final meal in cycle.meals) {
    final m = calcMeal(meal);
    calories += m.calories;
    protein += m.protein;
    carbs += m.carbs;
    fats += m.fats;
  }
  return Macros(
    calories: _r2(calories),
    protein: _r2(protein),
    carbs: _r2(carbs),
    fats: _r2(fats),
  );
}
