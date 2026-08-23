import 'package:fitforce_x/shared/models/food_swap.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FoodSwapAlternative.fromJson', () {
    test('parses a calorie-matched alternative', () {
      final alt = FoodSwapAlternative.fromJson(const {
        'foodItemId': 'food-2',
        'name': 'Chicken Breast',
        'nameAr': 'صدر دجاج',
        'servingUnit': 'g',
        'foodCategory': 'Protein',
        'foodCategoryAr': 'بروتين',
        'calculatedAmount': 120.5,
        'isCalorieMatched': true,
        'calories': 200,
        'protein': 40,
        'carbs': 0,
        'fat': 5,
      });
      expect(alt.foodItemId, 'food-2');
      expect(alt.name, 'Chicken Breast');
      expect(alt.calculatedAmount, 120.5);
      expect(alt.isCalorieMatched, isTrue);
      expect(alt.foodCategoryAr, 'بروتين');
    });

    test('defaults isCalorieMatched to true when absent', () {
      final alt = FoodSwapAlternative.fromJson(const {
        'foodItemId': 'food-3',
        'name': 'Water',
      });
      expect(alt.isCalorieMatched, isTrue);
      expect(alt.calculatedAmount, 0);
    });
  });
}
