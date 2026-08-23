import 'package:freezed_annotation/freezed_annotation.dart';

part 'workout_session.freezed.dart';
part 'workout_session.g.dart';

/// An in-progress Training Mode session. Persisted to shared_preferences as
/// JSON (the mobile parallel of the web's localStorage draft) so a kill/restart
/// resumes the same day. Field names are our own (camelCase) — both ends are
/// the app, so no server mapping is needed.
@freezed
abstract class WorkoutSession with _$WorkoutSession {
  const factory WorkoutSession({
    // Minted client-side the moment a session starts (not server-generated)
    // so every debounced autosave and the final Finish both target the same
    // workout_logs row via upsert. Nullable only so a session cached before
    // this field existed can still be parsed — session_page.dart mints one
    // on resume if missing.
    String? id,
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
abstract class SessionExercise with _$SessionExercise {
  const factory SessionExercise({
    required String exerciseId,
    String? exerciseLibraryId,
    @Default('') String name,
    String? libraryNameEn,
    String? libraryNameAr,
    String? thumbnailPath,
    String? youtubeUrl,
    String? videoPath,
    String? muscleGroup,
    String? muscleGroupAr,
    String? equipment,
    String? equipmentAr,
    String? instructionsEn,
    String? instructionsAr,
    // 'sets_reps' or 'time_based' — see shared/utils/exercise_tracking_types.dart.
    @Default('sets_reps') String trackingType,
    @Default(<String>[]) List<String> trackedMetrics,
    @Default(<PrescribedSet>[]) List<PrescribedSet> prescribed,
    @Default('') String note,
    @Default(<SessionSet>[]) List<SessionSet> sets,
  }) = _SessionExercise;

  factory SessionExercise.fromJson(Map<String, dynamic> json) =>
      _$SessionExerciseFromJson(json);
}

/// The coach-prescribed target for a set (shown as faint guidance, or —
/// for time_based's loggable metrics — as the input's placeholder).
@freezed
abstract class PrescribedSet with _$PrescribedSet {
  const factory PrescribedSet({
    String? reps,
    int? restSeconds,
    String? rir,
    String? tempo,
    String? rpe,
    String? durationSeconds,
    String? distanceKm,
    String? inclinePercent,
    String? speedKmh,
  }) = _PrescribedSet;

  factory PrescribedSet.fromJson(Map<String, dynamic> json) =>
      _$PrescribedSetFromJson(json);
}

/// A logged set being edited. Every field stays as text while the user types
/// (parsed to numbers on save), matching the web inputs. Which fields are
/// actually editable/shown depends on the exercise's category — see
/// loggedFieldsFor in exercise_tracking_types.dart. RIR/tempo/RPE are never
/// logged (sets_reps target-only, read from PrescribedSet instead), so they
/// have no field here.
@freezed
abstract class SessionSet with _$SessionSet {
  const factory SessionSet({
    required int setOrder,
    @Default('') String weight,
    @Default('') String reps,
    @Default('') String durationSeconds,
    @Default('') String distanceKm,
    @Default('') String inclinePercent,
    @Default('') String speedKmh,
    int? restSeconds,
    @Default(false) bool completed,
  }) = _SessionSet;

  factory SessionSet.fromJson(Map<String, dynamic> json) =>
      _$SessionSetFromJson(json);
}
