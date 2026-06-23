import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/workout_log.dart';

/// Talks to `/client-portal/workout-logs/*` — Training Mode history, progress,
/// previous-set hints, and saving a finished session.
class WorkoutRepository {
  WorkoutRepository(this._dio);

  final Dio _dio;

  Future<List<WorkoutLogSummary>> fetchLogs() async {
    try {
      final res =
          await _dio.get<List<dynamic>>('/api/client-portal/workout-logs');
      return (res.data ?? [])
          .map((e) => WorkoutLogSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<WorkoutLogDetail> fetchLog(String id) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/workout-logs/$id',
      );
      return WorkoutLogDetail.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Map of exercise_id → previously-logged sets, for the "previous" column.
  /// Best-effort: returns an empty map on failure so it never blocks a session.
  Future<Map<String, List<PreviousSet>>> fetchPrevious(String dayId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/workout-logs/previous',
        queryParameters: {'day_id': dayId},
      );
      final data = res.data ?? {};
      return data.map(
        (key, value) => MapEntry(
          key,
          (value as List<dynamic>)
              .map((e) => PreviousSet.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
    } catch (_) {
      return {};
    }
  }

  Future<List<LoggedExerciseRef>> fetchLoggedExercises() async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/api/client-portal/workout-logs/exercises',
      );
      return (res.data ?? [])
          .map((e) => LoggedExerciseRef.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<ProgressPoint>> fetchProgress({
    String? exerciseLibraryId,
    String? exerciseId,
  }) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/api/client-portal/workout-logs/exercise-progress',
        queryParameters: {
          if (exerciseLibraryId != null)
            'exercise_library_id': exerciseLibraryId,
          if (exerciseId != null) 'exercise_id': exerciseId,
        },
      );
      return (res.data ?? [])
          .map((e) => ProgressPoint.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<void> createLog(Map<String, dynamic> payload) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        '/api/client-portal/workout-logs',
        data: payload,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

final workoutRepositoryProvider = Provider<WorkoutRepository>(
  (ref) => WorkoutRepository(ref.watch(dioProvider)),
);

final workoutLogsProvider =
    FutureProvider.autoDispose<List<WorkoutLogSummary>>((ref) {
  return ref.watch(workoutRepositoryProvider).fetchLogs();
});

final workoutLogProvider =
    FutureProvider.autoDispose.family<WorkoutLogDetail, String>((ref, id) {
  return ref.watch(workoutRepositoryProvider).fetchLog(id);
});

final loggedExercisesProvider =
    FutureProvider.autoDispose<List<LoggedExerciseRef>>((ref) {
  return ref.watch(workoutRepositoryProvider).fetchLoggedExercises();
});

/// Progress series for one exercise. Family key is "libraryId|exerciseId".
final exerciseProgressProvider = FutureProvider.autoDispose
    .family<List<ProgressPoint>, ({String? libraryId, String? exerciseId})>((
  ref,
  key,
) {
  return ref.watch(workoutRepositoryProvider).fetchProgress(
        exerciseLibraryId: key.libraryId,
        exerciseId: key.exerciseId,
      );
});
