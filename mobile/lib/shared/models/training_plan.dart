import 'package:freezed_annotation/freezed_annotation.dart';

part 'training_plan.freezed.dart';
part 'training_plan.g.dart';

/// The client's active training plan (`GET /client-portal/active-training-plan`).
/// Mirrors `buildTrainingPlanHierarchy`: plan → days → exercises → sets/alts.
@freezed
class TrainingPlan with _$TrainingPlan {
  const factory TrainingPlan({
    required String id,
    @Default('') String name,
    String? notes,
    @Default(<TrainingDay>[]) List<TrainingDay> days,
  }) = _TrainingPlan;

  factory TrainingPlan.fromJson(Map<String, dynamic> json) =>
      _$TrainingPlanFromJson(json);
}

@freezed
class TrainingDay with _$TrainingDay {
  const factory TrainingDay({
    required String id,
    @Default('') String name,
    @JsonKey(name: 'day_order') @Default(0) int dayOrder,
    String? notes,
    @Default(<TrainingExercise>[]) List<TrainingExercise> exercises,
  }) = _TrainingDay;

  factory TrainingDay.fromJson(Map<String, dynamic> json) =>
      _$TrainingDayFromJson(json);
}

@freezed
class TrainingExercise with _$TrainingExercise {
  const factory TrainingExercise({
    required String id,
    @Default('') String name,
    @JsonKey(name: 'exercise_order') @Default(0) int exerciseOrder,
    @JsonKey(name: 'exercise_library_id') String? exerciseLibraryId,
    String? equipment,
    String? notes,
    @JsonKey(name: 'muscle_group') String? muscleGroup,
    @JsonKey(name: 'thumbnail_path') String? thumbnailPath,
    @JsonKey(name: 'video_path') String? videoPath,
    @JsonKey(name: 'youtube_url') String? youtubeUrl,
    @JsonKey(name: 'instructions_en') String? instructionsEn,
    @JsonKey(name: 'instructions_ar') String? instructionsAr,
    @Default(<TrainingSet>[]) List<TrainingSet> sets,
    @Default(<TrainingAlternative>[]) List<TrainingAlternative> alternatives,
  }) = _TrainingExercise;

  factory TrainingExercise.fromJson(Map<String, dynamic> json) =>
      _$TrainingExerciseFromJson(json);
}

@freezed
class TrainingSet with _$TrainingSet {
  const factory TrainingSet({
    required String id,
    @JsonKey(name: 'set_order') @Default(0) int setOrder,
    // reps may be a range string ("8-12") or a number; keep as text.
    @JsonKey(fromJson: _toStringOrNull) String? reps,
    @JsonKey(name: 'rest_seconds') int? restSeconds,
    String? tempo,
    int? rir,
  }) = _TrainingSet;

  factory TrainingSet.fromJson(Map<String, dynamic> json) =>
      _$TrainingSetFromJson(json);
}

@freezed
class TrainingAlternative with _$TrainingAlternative {
  const factory TrainingAlternative({
    required String id,
    @JsonKey(name: 'alt_order') @Default(0) int altOrder,
    @JsonKey(name: 'name_en') String? nameEn,
    @JsonKey(name: 'name_ar') String? nameAr,
    @JsonKey(name: 'muscle_group') String? muscleGroup,
    String? equipment,
    @JsonKey(name: 'thumbnail_path') String? thumbnailPath,
    @JsonKey(name: 'youtube_url') String? youtubeUrl,
    @JsonKey(name: 'video_path') String? videoPath,
  }) = _TrainingAlternative;

  factory TrainingAlternative.fromJson(Map<String, dynamic> json) =>
      _$TrainingAlternativeFromJson(json);
}

String? _toStringOrNull(dynamic value) => value?.toString();
