import 'package:freezed_annotation/freezed_annotation.dart';

part 'transformation.freezed.dart';
part 'transformation.g.dart';

const metricTypeNumber = 'number';
const metricTypeImage = 'image';

/// Response of `GET /client-portal/transformation` — metric history (from
/// check-in answers linked to a `metrics` row) plus a submission timeline.
/// Mirrors `buildTransformationPayload()`, shared with the coach dashboard.
@freezed
abstract class TransformationPayload with _$TransformationPayload {
  const factory TransformationPayload({
    @Default(<TransformationMetric>[]) List<TransformationMetric> metrics,
    @Default(<TransformationSubmission>[])
    List<TransformationSubmission> timeline,
  }) = _TransformationPayload;

  factory TransformationPayload.fromJson(Map<String, dynamic> json) =>
      _$TransformationPayloadFromJson(json);
}

@freezed
abstract class TransformationMetric with _$TransformationMetric {
  const factory TransformationMetric({
    required String id,
    @Default('') String name,
    String? unit,
    @Default(metricTypeNumber) String type,
    String? icon,
    @Default(<MetricHistoryPoint>[]) List<MetricHistoryPoint> history,
  }) = _TransformationMetric;

  factory TransformationMetric.fromJson(Map<String, dynamic> json) =>
      _$TransformationMetricFromJson(json);
}

@freezed
abstract class MetricHistoryPoint with _$MetricHistoryPoint {
  const factory MetricHistoryPoint({
    required String date,
    @Default('') String value,
  }) = _MetricHistoryPoint;

  factory MetricHistoryPoint.fromJson(Map<String, dynamic> json) =>
      _$MetricHistoryPointFromJson(json);
}

@freezed
abstract class TransformationSubmission with _$TransformationSubmission {
  const factory TransformationSubmission({
    @JsonKey(name: 'submissionId') required String submissionId,
    @JsonKey(name: 'submittedAt') String? submittedAt,
    @JsonKey(name: 'formTitle') @Default('') String formTitle,
    @JsonKey(name: 'formTitleAr') String? formTitleAr,
    @Default(<TransformationAnswer>[]) List<TransformationAnswer> answers,
  }) = _TransformationSubmission;

  factory TransformationSubmission.fromJson(Map<String, dynamic> json) =>
      _$TransformationSubmissionFromJson(json);
}

@freezed
abstract class TransformationAnswer with _$TransformationAnswer {
  const factory TransformationAnswer({
    @Default('') String label,
    @JsonKey(name: 'labelAr') String? labelAr,
    @Default('') String answer,
    @JsonKey(name: 'metricType') String? metricType,
  }) = _TransformationAnswer;

  factory TransformationAnswer.fromJson(Map<String, dynamic> json) =>
      _$TransformationAnswerFromJson(json);
}

extension TransformationMetricX on TransformationMetric {
  bool get isImage => type == metricTypeImage;
}
