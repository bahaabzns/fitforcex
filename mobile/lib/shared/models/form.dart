import 'package:freezed_annotation/freezed_annotation.dart';

part 'form.freezed.dart';
part 'form.g.dart';

/// Status values returned by the server for a form request.
const formStatusPending = 'pending';
const formStatusScheduled = 'scheduled';
const formStatusSubmitted = 'submitted';
const formStatusReviewed = 'reviewed';

/// A request that still needs the client's attention — the Forms list's
/// "pending" bucket plus not-yet-open scheduled requests. Shared by the Forms
/// page and the bottom-nav unread dot so the two never drift apart.
bool formRequestNeedsAction(FormRequestSummary r) =>
    r.status == formStatusPending || r.status == formStatusScheduled;

/// A form request in the client's list (`GET /client-portal/form-requests`).
@freezed
abstract class FormRequestSummary with _$FormRequestSummary {
  const factory FormRequestSummary({
    required String id,
    @Default(formStatusPending) String status,
    @JsonKey(name: 'requested_at') String? requestedAt,
    @JsonKey(name: 'submitted_at') String? submittedAt,
    @JsonKey(name: 'scheduled_at') String? scheduledAt,
    @JsonKey(name: 'form_title_en') String? formTitleEn,
    @JsonKey(name: 'form_title_ar') String? formTitleAr,
    @JsonKey(name: 'form_description_en') String? formDescriptionEn,
    @JsonKey(name: 'form_description_ar') String? formDescriptionAr,
  }) = _FormRequestSummary;

  factory FormRequestSummary.fromJson(Map<String, dynamic> json) =>
      _$FormRequestSummaryFromJson(json);
}

/// A form request with its questions and any saved responses
/// (`GET /client-portal/form-requests/:id`).
@freezed
abstract class FormRequestDetail with _$FormRequestDetail {
  const factory FormRequestDetail({
    required String id,
    @Default(formStatusPending) String status,
    @JsonKey(name: 'form_title_en') String? formTitleEn,
    @JsonKey(name: 'form_title_ar') String? formTitleAr,
    @JsonKey(name: 'form_description_en') String? formDescriptionEn,
    @JsonKey(name: 'form_description_ar') String? formDescriptionAr,
    @Default(<FormQuestion>[]) List<FormQuestion> questions,
    @Default(<FormResponse>[]) List<FormResponse> responses,
  }) = _FormRequestDetail;

  factory FormRequestDetail.fromJson(Map<String, dynamic> json) =>
      _$FormRequestDetailFromJson(json);
}

@freezed
abstract class FormQuestion with _$FormQuestion {
  const factory FormQuestion({
    required String id,
    @Default('text') String type,
    @JsonKey(name: 'label_en') @Default('') String labelEn,
    @JsonKey(name: 'label_ar') String? labelAr,
    @JsonKey(name: 'placeholder_en') String? placeholderEn,
    @JsonKey(name: 'placeholder_ar') String? placeholderAr,
    @Default(false) bool required,
    @JsonKey(name: 'min_value') int? minValue,
    @JsonKey(name: 'max_value') int? maxValue,
    @JsonKey(fromJson: _stringList) @Default(<String>[]) List<String> options,
    @JsonKey(name: 'options_ar', fromJson: _stringList)
    @Default(<String>[])
    List<String> optionsAr,
    // Flattened onto the question when it's linked to a `metrics` row — drives
    // whether a `metric`-typed question renders as a number field (with a unit
    // suffix) or a photo upload. See clientPortal.controller.ts `getFormRequest`.
    @JsonKey(name: 'metric_type') String? metricType,
    @JsonKey(name: 'metric_unit') String? metricUnit,
    @JsonKey(name: 'metric_name') String? metricName,
  }) = _FormQuestion;

  factory FormQuestion.fromJson(Map<String, dynamic> json) =>
      _$FormQuestionFromJson(json);
}

@freezed
abstract class FormResponse with _$FormResponse {
  const factory FormResponse({
    @JsonKey(name: 'question_id') required String questionId,
    String? answer,
  }) = _FormResponse;

  factory FormResponse.fromJson(Map<String, dynamic> json) =>
      _$FormResponseFromJson(json);
}

/// Options arrive as a JSON array (or null); coerce every element to a string.
List<String> _stringList(dynamic value) =>
    value is List ? value.map((e) => e.toString()).toList() : const <String>[];
