import 'package:fitforce_x/shared/models/food_diary.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FoodDiaryEntry.fromJson', () {
    test('parses snake_case fields, items, and adherence', () {
      final entry = FoodDiaryEntry.fromJson({
        'id': 'entry-1',
        'date': '2026-08-20',
        'plan_id': 'plan-1',
        'cycle_id': 'cycle-1',
        'items': [
          {
            'meal_item_id': 'item-1',
            'food_item_id': 'food-1',
            'meal_name': 'Breakfast',
            'name_en': 'Oatmeal',
            'name_ar': 'شوفان',
            'prescribed_amount': 100,
            'amount_eaten': 50,
            'serving_unit': 'g',
            'serving_size': 100,
          },
        ],
        'total_calories': 200,
        'total_protein': 10,
        'total_carbs': 30,
        'total_fats': 5,
        'goal_calories': 2000,
        'goal_protein': 150,
        'goal_carbs': 250,
        'goal_fats': 70,
        'adherence': 78,
      });

      expect(entry.id, 'entry-1');
      expect(entry.date, '2026-08-20');
      expect(entry.items, hasLength(1));
      expect(entry.items.single.mealItemId, 'item-1');
      expect(entry.items.single.nameEn, 'Oatmeal');
      expect(entry.items.single.amountEaten, 50);
      expect(entry.totalCalories, 200);
      expect(entry.goalCalories, 2000);
      expect(entry.adherence, 78);
    });

    test('defaults items to empty and totals to 0 when absent', () {
      final entry = FoodDiaryEntry.fromJson({'id': 'entry-2', 'date': '2026-08-20'});

      expect(entry.items, isEmpty);
      expect(entry.totalCalories, 0);
      expect(entry.goalCalories, isNull);
      expect(entry.adherence, isNull);
    });
  });
}
