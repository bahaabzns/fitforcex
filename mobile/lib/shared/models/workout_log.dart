import 'package:freezed_annotation/freezed_annotation.dart';

import 'json_converters.dart';

part 'workout_log.freezed.dart';
part 'workout_log.g.dart';

/// A saved workout session summary (`GET /client-portal/workout-logs`).
@freezed
class WorkoutLogSummary with _$WorkoutLogSummary {
  const factory WorkoutLogSummary({
    required String id,
    required String date,
    @JsonKey(name: 'day_name') String? dayName,
    @JsonKey(name: 'duration_seconds') int? durationSeconds,
    @JsonKey(name: 'total_volume')
    @NumToDouble()
    @Default(0)
    double totalVolume,
    @JsonKey(name: 'total_sets') @Default(0) int totalSets,
  }) = _WorkoutLogSummary;

  factory WorkoutLogSummary.fromJson(Map<String, dynamic> json) =>
      _$WorkoutLogSummaryFromJson(json);
}

/// A single saved session with its exercises (`GET /client-portal/workout-logs/:id`).
@freezed
class WorkoutLogDetail with _$WorkoutLogDetail {
  const factory WorkoutLogDetail({
    required String id,
    required String date,
    @JsonKey(name: 'day_name') String? dayName,
    @JsonKey(name: 'duration_seconds') int? durationSeconds,
    @JsonKey(name: 'total_volume')
    @NumToDouble()
    @Default(0)
    double totalVolume,
    @JsonKey(name: 'total_sets') @Default(0) int totalSets,
    @Default(<LoggedExerciseDetail>[]) List<LoggedExerciseDetail> exercises,
  }) = _WorkoutLogDetail;

  factory WorkoutLogDetail.fromJson(Map<String, dynamic> json) =>
      _$WorkoutLogDetailFromJson(json);
}

@freezed
class LoggedExerciseDetail with _$LoggedExerciseDetail {
  const factory LoggedExerciseDetail({
    @Default('') String name,
    String? note,
    @Default(<LoggedSet>[]) List<LoggedSet> sets,
  }) = _LoggedExerciseDetail;

  factory LoggedExerciseDetail.fromJson(Map<String, dynamic> json) =>
      _$LoggedExerciseDetailFromJson(json);
}

@freezed
class LoggedSet with _$LoggedSet {
  const factory LoggedSet({
    @JsonKey(name: 'set_order') @Default(0) int setOrder,
    @NumToDoubleOrNull() double? weight,
    @NumToDoubleOrNull() double? reps,
    @NumToDoubleOrNull() double? rir,
    @Default(false) bool completed,
  }) = _LoggedSet;

  factory LoggedSet.fromJson(Map<String, dynamic> json) =>
      _$LoggedSetFromJson(json);
}

/// One point in an exercise progress series
/// (`GET /client-portal/workout-logs/exercise-progress`).
@freezed
class ProgressPoint with _$ProgressPoint {
  const factory ProgressPoint({
    required String date,
    @JsonKey(name: 'top_weight') @NumToDouble() @Default(0) double topWeight,
    @JsonKey(name: 'est_1rm') @NumToDouble() @Default(0) double est1rm,
    @JsonKey(name: 'total_volume')
    @NumToDouble()
    @Default(0)
    double totalVolume,
  }) = _ProgressPoint;

  factory ProgressPoint.fromJson(Map<String, dynamic> json) =>
      _$ProgressPointFromJson(json);
}

/// A distinct logged exercise for the progress picker
/// (`GET /client-portal/workout-logs/exercises`).
@freezed
class LoggedExerciseRef with _$LoggedExerciseRef {
  const factory LoggedExerciseRef({
    @JsonKey(name: 'exercise_id') String? exerciseId,
    @JsonKey(name: 'exercise_library_id') String? exerciseLibraryId,
    @Default('') String name,
  }) = _LoggedExerciseRef;

  factory LoggedExerciseRef.fromJson(Map<String, dynamic> json) =>
      _$LoggedExerciseRefFromJson(json);
}

/// A previously-logged set keyed by order, for the "previous" hint column
/// (`GET /client-portal/workout-logs/previous`).
@freezed
class PreviousSet with _$PreviousSet {
  const factory PreviousSet({
    @JsonKey(name: 'set_order') @Default(0) int setOrder,
    @NumToDoubleOrNull() double? weight,
    @NumToDoubleOrNull() double? reps,
  }) = _PreviousSet;

  factory PreviousSet.fromJson(Map<String, dynamic> json) =>
      _$PreviousSetFromJson(json);
}
