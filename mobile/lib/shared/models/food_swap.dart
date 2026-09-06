import 'package:freezed_annotation/freezed_annotation.dart';

import 'json_converters.dart';

part 'food_swap.freezed.dart';
part 'food_swap.g.dart';

/// One same-category candidate for a food swap
/// (`GET /client-portal/meal-items/:mealItemId/swap-search`). Grams and
/// macros are already computed server-side for the equivalent swap — never
/// recalculated client-side.
@freezed
abstract class FoodSwapAlternative with _$FoodSwapAlternative {
  const factory FoodSwapAlternative({
    @JsonKey(name: 'foodItemId') required String foodItemId,
    @Default('') String name,
    String? nameAr,
    @JsonKey(name: 'servingUnit') @Default('') String servingUnit,
    @JsonKey(name: 'foodCategory') String? foodCategory,
    @JsonKey(name: 'foodCategoryAr') String? foodCategoryAr,
    @JsonKey(name: 'calculatedAmount') @NumToDouble() @Default(0) double calculatedAmount,
    @JsonKey(name: 'isCalorieMatched') @Default(true) bool isCalorieMatched,
    @NumToDouble() @Default(0) double calories,
    @NumToDouble() @Default(0) double protein,
    @NumToDouble() @Default(0) double carbs,
    @NumToDouble() @Default(0) double fat,
  }) = _FoodSwapAlternative;

  factory FoodSwapAlternative.fromJson(Map<String, dynamic> json) =>
      _$FoodSwapAlternativeFromJson(json);
}
