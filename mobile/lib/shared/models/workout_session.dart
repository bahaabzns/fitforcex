import 'package:freezed_annotation/freezed_annotation.dart';

part 'workout_session.freezed.dart';
part 'workout_session.g.dart';

/// An in-progress Training Mode session. Persisted to shared_preferences as
/// JSON (the mobile parallel of the web's localStorage draft) so a kill/restart
/// resumes the same day. Field names are our own (camelCase) — both ends are
/// the app, so no server mapping is needed.
@freezed
class WorkoutSession with _$WorkoutSession {
  const factory WorkoutSession({
    String? planId,
    required String dayId,
    required int dayIndex,
    @Default('') String dayName,
    required String startedAt,
    @Default(<SessionExercise>[]) List<SessionExercise> exercises,
  }) = _WorkoutSession;

  factory WorkoutSession.fromJson(Map<String, dynamic> json) =>
      _$WorkoutSessionFromJson(json);
}

@freezed
class SessionExercise with _$SessionExercise {
  const factory SessionExercise({
    required String exerciseId,
    String? exerciseLibraryId,
    @Default('') String name,
    String? thumbnailPath,
    String? muscleGroup,
    String? equipment,
    @Default(<PrescribedSet>[]) List<PrescribedSet> prescribed,
    @Default('') String note,
    @Default(<SessionSet>[]) List<SessionSet> sets,
  }) = _SessionExercise;

  factory SessionExercise.fromJson(Map<String, dynamic> json) =>
      _$SessionExerciseFromJson(json);
}

/// The coach-prescribed target for a set (shown as faint guidance).
@freezed
class PrescribedSet with _$PrescribedSet {
  const factory PrescribedSet({
    String? reps,
    int? restSeconds,
    String? rir,
    String? tempo,
  }) = _PrescribedSet;

  factory PrescribedSet.fromJson(Map<String, dynamic> json) =>
      _$PrescribedSetFromJson(json);
}

/// A logged set being edited. Weight/reps/rir stay as text while the user types
/// (parsed to numbers on save), matching the web inputs.
@freezed
class SessionSet with _$SessionSet {
  const factory SessionSet({
    required int setOrder,
    @Default('') String weight,
    @Default('') String reps,
    @Default('') String rir,
    int? restSeconds,
    @Default(false) bool completed,
  }) = _SessionSet;

  factory SessionSet.fromJson(Map<String, dynamic> json) =>
      _$SessionSetFromJson(json);
}
