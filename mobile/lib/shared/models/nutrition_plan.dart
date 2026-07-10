import 'package:freezed_annotation/freezed_annotation.dart';

import 'json_converters.dart';

part 'nutrition_plan.freezed.dart';
part 'nutrition_plan.g.dart';

/// The client's active nutrition plan (`GET /client-portal/active-plan`).
///
/// Shapes mirror `buildNutritionPlanHierarchy` on the server: a plan holds
/// ordered cycles → meals → items → alternatives.
@freezed
abstract class NutritionPlan with _$NutritionPlan {
  const factory NutritionPlan({
    required String id,
    @Default('') String name,
    // Present on the wire (the endpoint spreads the full plan row) but not
    // rendered anywhere in the UI — used only to detect "a new plan was
    // activated since the client last opened this tab" for the bottom-nav
    // unread dot. Changes on activation/restart, not on ordinary edits.
    @JsonKey(name: 'activated_at') String? activatedAt,
    @Default(<NutritionCycle>[]) List<NutritionCycle> cycles,
  }) = _NutritionPlan;

  factory NutritionPlan.fromJson(Map<String, dynamic> json) =>
      _$NutritionPlanFromJson(json);
}

@freezed
abstract class NutritionCycle with _$NutritionCycle {
  const factory NutritionCycle({
    required String id,
    @Default('') String name,
    @JsonKey(name: 'cycle_order') @Default(0) int cycleOrder,
    String? note,
    @JsonKey(name: 'goal_calories') @NumToDoubleOrNull() double? goalCalories,
    @JsonKey(name: 'goal_protein') @NumToDoubleOrNull() double? goalProtein,
    @JsonKey(name: 'goal_carbs') @NumToDoubleOrNull() double? goalCarbs,
    @JsonKey(name: 'goal_fats') @NumToDoubleOrNull() double? goalFats,
    @Default(<NutritionMeal>[]) List<NutritionMeal> meals,
  }) = _NutritionCycle;

  factory NutritionCycle.fromJson(Map<String, dynamic> json) =>
      _$NutritionCycleFromJson(json);
}

@freezed
abstract class NutritionMeal with _$NutritionMeal {
  const factory NutritionMeal({
    required String id,
    @Default('') String name,
    @JsonKey(name: 'meal_order') @Default(0) int mealOrder,
    String? note,
    @Default(<NutritionMealItem>[]) List<NutritionMealItem> items,
  }) = _NutritionMeal;

  factory NutritionMeal.fromJson(Map<String, dynamic> json) =>
      _$NutritionMealFromJson(json);
}

@freezed
abstract class NutritionMealItem with _$NutritionMealItem {
  const factory NutritionMealItem({
    required String id,
    @Default('') String name,
    @JsonKey(name: 'name_ar') String? nameAr,
    @NumToDouble() @Default(0) double amount,
    @JsonKey(name: 'serving_unit') @Default('') String servingUnit,
    @JsonKey(name: 'serving_size')
    @NumToDouble()
    @Default(1)
    double servingSize,
    @JsonKey(name: 'calories_per_serving')
    @NumToDouble()
    @Default(0)
    double caloriesPerServing,
    @JsonKey(name: 'protein_per_serving')
    @NumToDouble()
    @Default(0)
    double proteinPerServing,
    @JsonKey(name: 'carbs_per_serving')
    @NumToDouble()
    @Default(0)
    double carbsPerServing,
    @JsonKey(name: 'fats_per_serving')
    @NumToDouble()
    @Default(0)
    double fatsPerServing,
    @Default(<NutritionAlternative>[]) List<NutritionAlternative> alternatives,
  }) = _NutritionMealItem;

  factory NutritionMealItem.fromJson(Map<String, dynamic> json) =>
      _$NutritionMealItemFromJson(json);
}

@freezed
abstract class NutritionAlternative with _$NutritionAlternative {
  const factory NutritionAlternative({
    required String id,
    @Default('') String name,
    @JsonKey(name: 'name_ar') String? nameAr,
    @NumToDouble() @Default(0) double amount,
    @JsonKey(name: 'serving_unit') @Default('') String servingUnit,
  }) = _NutritionAlternative;

  factory NutritionAlternative.fromJson(Map<String, dynamic> json) =>
      _$NutritionAlternativeFromJson(json);
}
