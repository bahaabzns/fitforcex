import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/models/food_diary.dart';
import 'food_diary_repository.dart';
import 'nutrition_repository.dart';

/// Today's food-diary entry, fetched once against the plan's first cycle
/// (cycle_id only matters the first time today's entry is created — see
/// the server's buildTodaySnapshot) regardless of which cycle tab the
/// client later switches to. `null` data means no active plan yet.
class FoodDiaryController extends AsyncNotifier<FoodDiaryEntry?> {
  @override
  Future<FoodDiaryEntry?> build() async {
    final plan = await ref.watch(activeNutritionPlanProvider.future);
    final cycleId = plan == null || plan.cycles.isEmpty ? null : plan.cycles.first.id;
    return ref.read(foodDiaryRepositoryProvider).fetchToday(cycleId: cycleId);
  }

  /// Optimistic — reflects the change immediately, reconciles with the
  /// server's recomputed totals/adherence once the response lands. A failed
  /// request silently keeps the optimistic value (matches web): reopening
  /// the page reconciles with the server on the next fetch.
  Future<void> setAmountEaten(
    String mealItemId,
    double amountEaten, {
    String? cycleId,
  }) async {
    final current = state.asData?.value;
    if (current == null) return;

    state = AsyncData(current.copyWith(
      items: [
        for (final item in current.items)
          if (item.mealItemId == mealItemId)
            item.copyWith(amountEaten: amountEaten)
          else
            item,
      ],
    ));

    try {
      final updated = await ref.read(foodDiaryRepositoryProvider).updateItem(
            mealItemId: mealItemId,
            amountEaten: amountEaten,
            cycleId: cycleId,
          );
      state = AsyncData(updated);
    } catch (_) {
      // Leave the optimistic value in place.
    }
  }
}

final foodDiaryControllerProvider =
    AsyncNotifierProvider<FoodDiaryController, FoodDiaryEntry?>(
        FoodDiaryController.new);
