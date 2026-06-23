import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/nutrition_plan.dart';

/// Reads the client's active nutrition plan (`GET /client-portal/active-plan`).
class NutritionRepository {
  NutritionRepository(this._dio);

  final Dio _dio;

  /// Returns the active [NutritionPlan], or `null` when the client has none
  /// (HTTP 404 — the portal's "no active plan" state).
  Future<NutritionPlan?> fetchActivePlan() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/active-plan',
      );
      return NutritionPlan.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw ApiException.fromDio(e);
    }
  }
}

final nutritionRepositoryProvider = Provider<NutritionRepository>(
  (ref) => NutritionRepository(ref.watch(dioProvider)),
);

/// The active nutrition plan as an [AsyncValue]; `null` data = no active plan.
final activeNutritionPlanProvider =
    FutureProvider.autoDispose<NutritionPlan?>((ref) {
  return ref.watch(nutritionRepositoryProvider).fetchActivePlan();
});
