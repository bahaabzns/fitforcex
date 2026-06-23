import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/training_plan.dart';

/// Reads the client's active training plan
/// (`GET /client-portal/active-training-plan`).
class TrainingRepository {
  TrainingRepository(this._dio);

  final Dio _dio;

  /// Returns the active [TrainingPlan], or `null` when the client has none
  /// (HTTP 404 — the portal's "no active plan" state).
  Future<TrainingPlan?> fetchActivePlan() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/active-training-plan',
      );
      return TrainingPlan.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw ApiException.fromDio(e);
    }
  }
}

final trainingRepositoryProvider = Provider<TrainingRepository>(
  (ref) => TrainingRepository(ref.watch(dioProvider)),
);

/// The active training plan as an [AsyncValue]; `null` data = no active plan.
final activeTrainingPlanProvider =
    FutureProvider.autoDispose<TrainingPlan?>((ref) {
  return ref.watch(trainingRepositoryProvider).fetchActivePlan();
});
