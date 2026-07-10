import 'package:freezed_annotation/freezed_annotation.dart';

import 'json_converters.dart';

part 'exercise_insights.freezed.dart';
part 'exercise_insights.g.dart';

/// Response of `GET /client-portal/workout-logs/exercise-insights` — personal
/// records, recent sessions, and the progress chart for one exercise. Mirrors
/// what the web `ClientExerciseInsightsModal` renders (the server also returns
/// a coach-only `insights` block — strength trend/plateau/consistency — that
/// the web client deliberately doesn't show to clients, so it's not modeled
/// here either).
@freezed
abstract class ExerciseInsights with _$ExerciseInsights {
  const factory ExerciseInsights({
    @JsonKey(name: 'progressPoints') @Default(<InsightProgressPoint>[])
    List<InsightProgressPoint> progressPoints,
    @JsonKey(name: 'recentSessions') @Default(<RecentSession>[])
    List<RecentSession> recentSessions,
    @JsonKey(name: 'personalRecords') PersonalRecords? personalRecords,
  }) = _ExerciseInsights;

  factory ExerciseInsights.fromJson(Map<String, dynamic> json) =>
      _$ExerciseInsightsFromJson(json);
}

@freezed
abstract class InsightProgressPoint with _$InsightProgressPoint {
  const factory InsightProgressPoint({
    required String date,
    @JsonKey(name: 'top_weight') @NumToDouble() @Default(0) double topWeight,
    @JsonKey(name: 'est_1rm') @NumToDouble() @Default(0) double est1rm,
    @JsonKey(name: 'total_volume')
    @NumToDouble()
    @Default(0)
    double totalVolume,
  }) = _InsightProgressPoint;

  factory InsightProgressPoint.fromJson(Map<String, dynamic> json) =>
      _$InsightProgressPointFromJson(json);
}

@freezed
abstract class RecentSession with _$RecentSession {
  const factory RecentSession({
    required String date,
    @JsonKey(name: 'best_set') BestSet? bestSet,
    String? note,
  }) = _RecentSession;

  factory RecentSession.fromJson(Map<String, dynamic> json) =>
      _$RecentSessionFromJson(json);
}

@freezed
abstract class BestSet with _$BestSet {
  const factory BestSet({
    @NumToDoubleOrNull() double? weight,
    @NumToDoubleOrNull() double? reps,
    @NumToDoubleOrNull() double? rir,
  }) = _BestSet;

  factory BestSet.fromJson(Map<String, dynamic> json) =>
      _$BestSetFromJson(json);
}

@freezed
abstract class PersonalRecords with _$PersonalRecords {
  const factory PersonalRecords({
    @JsonKey(name: 'heaviest_weight') PrRecord? heaviestWeight,
    @JsonKey(name: 'best_set') PrBestSet? bestSet,
    @JsonKey(name: 'highest_volume') PrRecord? highestVolume,
    @JsonKey(name: 'est_1rm') PrRecord? est1rm,
  }) = _PersonalRecords;

  factory PersonalRecords.fromJson(Map<String, dynamic> json) =>
      _$PersonalRecordsFromJson(json);
}

@freezed
abstract class PrRecord with _$PrRecord {
  const factory PrRecord({
    @NumToDouble() @Default(0) double value,
    String? date,
  }) = _PrRecord;

  factory PrRecord.fromJson(Map<String, dynamic> json) =>
      _$PrRecordFromJson(json);
}

@freezed
abstract class PrBestSet with _$PrBestSet {
  const factory PrBestSet({
    @NumToDoubleOrNull() double? weight,
    @NumToDoubleOrNull() double? reps,
    @NumToDoubleOrNull() double? rir,
    String? date,
  }) = _PrBestSet;

  factory PrBestSet.fromJson(Map<String, dynamic> json) =>
      _$PrBestSetFromJson(json);
}
