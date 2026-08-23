import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../shared/models/exercise_insights.dart';
import '../../shared/models/workout_log.dart';
import '../../shared/models/workout_session.dart';

/// A server-side in-progress session (`GET /client-portal/workout-logs/draft`)
/// — the cross-device/cleared-storage fallback local shared_preferences alone
/// can't cover. Only the client's own entered values (note, sets) and
/// identity (id, started_at) are meaningful here; every other field
/// (thumbnails, prescribed targets, tracking config) is re-derived from the
/// freshly-fetched plan on resume, in case a coach edited it meanwhile.
class WorkoutDraft {
  WorkoutDraft({
    required this.id,
    required this.startedAt,
    required this.exercisesById,
  });

  final String id;
  final String startedAt;
  final Map<String, ({String note, List<SessionSet> sets})> exercisesById;

  static WorkoutDraft? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final rawExercises = json['exercises'] as List<dynamic>? ?? [];
    return WorkoutDraft(
      id: json['id'] as String,
      startedAt: json['started_at'] as String? ??
          DateTime.now().toUtc().toIso8601String(),
      exercisesById: {
        for (final e in rawExercises)
          (e as Map<String, dynamic>)['exercise_id'] as String: (
            note: e['note'] as String? ?? '',
            sets: ((e['sets'] as List<dynamic>? ?? [])
                .map((s) => _sessionSetFromDraft(s as Map<String, dynamic>))
                .toList()),
          ),
      },
    );
  }
}

String _asText(dynamic value) => value == null ? '' : value.toString();

SessionSet _sessionSetFromDraft(Map<String, dynamic> s) => SessionSet(
      setOrder: (s['set_order'] as num?)?.toInt() ?? 0,
      completed: s['completed'] == true,
      restSeconds: (s['rest_seconds'] as num?)?.toInt(),
      weight: _asText(s['weight']),
      reps: _asText(s['reps']),
      durationSeconds: _asText(s['duration_seconds']),
      distanceKm: _asText(s['distance_km']),
      inclinePercent: _asText(s['incline_percent']),
      speedKmh: _asText(s['speed_kmh']),
    );

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

  Future<ExerciseInsights> fetchInsights({
    String? exerciseLibraryId,
    String? exerciseId,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/client-portal/workout-logs/exercise-insights',
        queryParameters: {
          if (exerciseLibraryId != null)
            'exercise_library_id': exerciseLibraryId,
          if (exerciseId != null) 'exercise_id': exerciseId,
        },
      );
      return ExerciseInsights.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Upserts one session by client-minted id — the same call for a
  /// debounced background autosave (`completed: false`) and the final
  /// Finish (`completed: true`), so both target the same workout_logs row.
  /// A completed row is an immutable snapshot server-side: a stray autosave
  /// racing in after Finish is a no-op there, not a mutation.
  Future<void> upsertLog(String id, Map<String, dynamic> payload) async {
    try {
      await _dio.put<Map<String, dynamic>>(
        '/api/client-portal/workout-logs/$id',
        data: payload,
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// The cross-device/cleared-storage fallback: an in-progress draft from
  /// the server (bounded to the last 24h), if any. Best-effort — returns
  /// null on failure so a fresh session can always start blank instead.
  Future<WorkoutDraft?> fetchDraft(String dayId) async {
    try {
      final res = await _dio.get<Map<String, dynamic>?>(
        '/api/client-portal/workout-logs/draft',
        queryParameters: {'day_id': dayId},
      );
      return WorkoutDraft.fromJson(res.data);
    } catch (_) {
      return null;
    }
  }

  Future<void> deleteLog(String id) async {
    try {
      await _dio.delete<void>('/api/client-portal/workout-logs/$id');
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

/// PRs + recent sessions + chart for one exercise, shown in the Training Mode
/// insights modal. Family key is "libraryId|exerciseId".
final exerciseInsightsProvider = FutureProvider.autoDispose
    .family<ExerciseInsights, ({String? libraryId, String? exerciseId})>((
  ref,
  key,
) {
  return ref.watch(workoutRepositoryProvider).fetchInsights(
        exerciseLibraryId: key.libraryId,
        exerciseId: key.exerciseId,
      );
});
