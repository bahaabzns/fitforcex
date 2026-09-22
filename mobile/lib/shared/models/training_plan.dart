import 'package:freezed_annotation/freezed_annotation.dart';

import 'json_converters.dart';

part 'training_plan.freezed.dart';
part 'training_plan.g.dart';

/// The client's active training plan (`GET /client-portal/active-training-plan`).
/// Mirrors `buildTrainingPlanHierarchy`: plan → days → exercises → sets/alts.
@freezed
abstract class TrainingPlan with _$TrainingPlan {
  const factory TrainingPlan({
    required String id,
    @Default('') String name,
    String? notes,
    // See NutritionPlan.activatedAt — same purpose (bottom-nav unread dot).
    @JsonKey(name: 'activated_at') String? activatedAt,
    @Default(<TrainingDay>[]) List<TrainingDay> days,
  }) = _TrainingPlan;

  factory TrainingPlan.fromJson(Map<String, dynamic> json) =>
      _$TrainingPlanFromJson(json);
}

@freezed
abstract class TrainingDay with _$TrainingDay {
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
abstract class TrainingExercise with _$TrainingExercise {
  const factory TrainingExercise({
    required String id,
    @Default('') String name,
    @JsonKey(name: 'library_name_en') String? libraryNameEn,
    @JsonKey(name: 'library_name_ar') String? libraryNameAr,
    @JsonKey(name: 'exercise_order') @Default(0) int exerciseOrder,
    @JsonKey(name: 'exercise_library_id') String? exerciseLibraryId,
    String? equipment,
    @JsonKey(name: 'equipment_ar') String? equipmentAr,
    String? notes,
    @JsonKey(name: 'muscle_group') String? muscleGroup,
    @JsonKey(name: 'muscle_group_ar') String? muscleGroupAr,
    @JsonKey(name: 'thumbnail_path') String? thumbnailPath,
    @JsonKey(name: 'video_path') String? videoPath,
    @JsonKey(name: 'youtube_url') String? youtubeUrl,
    @JsonKey(name: 'instructions_en') String? instructionsEn,
    @JsonKey(name: 'instructions_ar') String? instructionsAr,
    @Default(<TrainingSet>[]) List<TrainingSet> sets,
    @Default(<TrainingAlternative>[]) List<TrainingAlternative> alternatives,
    @JsonKey(name: 'tracking_type') String? trackingType,
    @JsonKey(name: 'tracked_metrics', fromJson: _stringListOrNull)
    List<String>? trackedMetrics,
  }) = _TrainingExercise;

  factory TrainingExercise.fromJson(Map<String, dynamic> json) =>
      _$TrainingExerciseFromJson(json);
}

@freezed
abstract class TrainingSet with _$TrainingSet {
  const factory TrainingSet({
    required String id,
    @JsonKey(name: 'set_order') @Default(0) int setOrder,
    // reps may be a range string ("8-12") or a number; keep as text.
    @JsonKey(fromJson: _toStringOrNull) String? reps,
    @JsonKey(name: 'rest_seconds') int? restSeconds,
    String? tempo,
    int? rir,
    @NumToDoubleOrNull() double? rpe,
    @JsonKey(name: 'duration_seconds') int? durationSeconds,
    @JsonKey(name: 'distance_km') @NumToDoubleOrNull() double? distanceKm,
    @JsonKey(name: 'incline_percent')
    @NumToDoubleOrNull()
    double? inclinePercent,
    @JsonKey(name: 'speed_kmh') @NumToDoubleOrNull() double? speedKmh,
  }) = _TrainingSet;

  factory TrainingSet.fromJson(Map<String, dynamic> json) =>
      _$TrainingSetFromJson(json);
}

@freezed
abstract class TrainingAlternative with _$TrainingAlternative {
  const factory TrainingAlternative({
    required String id,
    @JsonKey(name: 'alt_order') @Default(0) int altOrder,
    @JsonKey(name: 'name_en') String? nameEn,
    @JsonKey(name: 'name_ar') String? nameAr,
    @JsonKey(name: 'muscle_group') String? muscleGroup,
    @JsonKey(name: 'muscle_group_ar') String? muscleGroupAr,
    String? equipment,
    @JsonKey(name: 'equipment_ar') String? equipmentAr,
    @JsonKey(name: 'thumbnail_path') String? thumbnailPath,
    @JsonKey(name: 'youtube_url') String? youtubeUrl,
    @JsonKey(name: 'video_path') String? videoPath,
  }) = _TrainingAlternative;

  factory TrainingAlternative.fromJson(Map<String, dynamic> json) =>
      _$TrainingAlternativeFromJson(json);
}

String? _toStringOrNull(dynamic value) => value?.toString();

List<String>? _stringListOrNull(dynamic value) =>
    value is List ? value.map((e) => e.toString()).toList() : null;
