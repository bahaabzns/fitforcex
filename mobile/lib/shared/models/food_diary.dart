import 'package:freezed_annotation/freezed_annotation.dart';

import 'json_converters.dart';

part 'food_diary.freezed.dart';
part 'food_diary.g.dart';

/// One day's food-diary snapshot (`GET/PATCH /client-portal/food-diary/today`,
/// `GET /client-portal/food-diary/history`) — a frozen-at-creation copy of
/// that day's plan items plus how much of each the client marked eaten.
/// Mirrors `serializeDiaryEntry` (server/src/utils/foodDiaryStats.ts).
@freezed
abstract class FoodDiaryEntry with _$FoodDiaryEntry {
  const factory FoodDiaryEntry({
    required String id,
    required String date,
    @JsonKey(name: 'plan_id') String? planId,
    @JsonKey(name: 'cycle_id') String? cycleId,
    @Default(<FoodDiaryItem>[]) List<FoodDiaryItem> items,
    @JsonKey(name: 'total_calories') @NumToDouble() @Default(0) double totalCalories,
    @JsonKey(name: 'total_protein') @NumToDouble() @Default(0) double totalProtein,
    @JsonKey(name: 'total_carbs') @NumToDouble() @Default(0) double totalCarbs,
    @JsonKey(name: 'total_fats') @NumToDouble() @Default(0) double totalFats,
    @JsonKey(name: 'goal_calories') @NumToDoubleOrNull() double? goalCalories,
    @JsonKey(name: 'goal_protein') @NumToDoubleOrNull() double? goalProtein,
    @JsonKey(name: 'goal_carbs') @NumToDoubleOrNull() double? goalCarbs,
    @JsonKey(name: 'goal_fats') @NumToDoubleOrNull() double? goalFats,
    int? adherence,
  }) = _FoodDiaryEntry;

  factory FoodDiaryEntry.fromJson(Map<String, dynamic> json) =>
      _$FoodDiaryEntryFromJson(json);
}

@freezed
abstract class FoodDiaryItem with _$FoodDiaryItem {
  const factory FoodDiaryItem({
    @JsonKey(name: 'meal_item_id') required String mealItemId,
    @JsonKey(name: 'food_item_id') String? foodItemId,
    @JsonKey(name: 'meal_name') @Default('') String mealName,
    @JsonKey(name: 'name_en') String? nameEn,
    @JsonKey(name: 'name_ar') String? nameAr,
    @JsonKey(name: 'prescribed_amount') @NumToDouble() @Default(0) double prescribedAmount,
    @JsonKey(name: 'amount_eaten') @NumToDouble() @Default(0) double amountEaten,
    @JsonKey(name: 'serving_unit') String? servingUnit,
    @JsonKey(name: 'serving_size') @NumToDoubleOrNull() double? servingSize,
  }) = _FoodDiaryItem;

  factory FoodDiaryItem.fromJson(Map<String, dynamic> json) =>
      _$FoodDiaryItemFromJson(json);
}
