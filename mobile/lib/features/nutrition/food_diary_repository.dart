import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/food_diary.dart';

/// Talks to `/client-portal/food-diary/*` — today's checklist snapshot and
/// its history. Totals/adherence are always recomputed server-side from the
/// snapshot; the client only ever sends `amount_eaten` for one item.
class FoodDiaryRepository {
  FoodDiaryRepository(this._dio);

  final Dio _dio;

  /// `null` when the client has no active nutrition plan yet.
  Future<FoodDiaryEntry?> fetchToday({String? cycleId}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>?>(
        '/api/client-portal/food-diary/today',
        queryParameters: {if (cycleId != null) 'cycle_id': cycleId},
      );
      final data = res.data;
      return data == null ? null : FoodDiaryEntry.fromJson(data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<FoodDiaryEntry> updateItem({
    required String mealItemId,
    required double amountEaten,
    String? cycleId,
  }) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>(
        '/api/client-portal/food-diary/today',
        data: {
          'meal_item_id': mealItemId,
          'amount_eaten': amountEaten,
          if (cycleId != null) 'cycle_id': cycleId,
        },
      );
      return FoodDiaryEntry.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<FoodDiaryEntry>> fetchHistory() async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/api/client-portal/food-diary/history',
      );
      return (res.data ?? [])
          .map((e) => FoodDiaryEntry.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final foodDiaryRepositoryProvider = Provider<FoodDiaryRepository>(
  (ref) => FoodDiaryRepository(ref.watch(dioProvider)),
);

final foodDiaryHistoryProvider =
    FutureProvider.autoDispose<List<FoodDiaryEntry>>((ref) {
  return ref.watch(foodDiaryRepositoryProvider).fetchHistory();
});
