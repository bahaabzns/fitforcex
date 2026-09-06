import 'package:freezed_annotation/freezed_annotation.dart';

part 'form.freezed.dart';
part 'form.g.dart';

/// Status values returned by the server for a form request.
const formStatusPending = 'pending';
const formStatusScheduled = 'scheduled';
const formStatusSubmitted = 'submitted';
const formStatusReviewed = 'reviewed';
// Not a distinct client-facing state: the dispatcher cron (server
// scheduler.ts) ticks a due 'pending' request over to 'sent' once it notices
// it — same "awaiting the client" bucket as 'pending', matching the coach
// Plans Queue's identical treatment (forms.controller.ts).
const formStatusSent = 'sent';

/// A request that still needs the client's attention — the Forms list's
/// "pending" bucket plus not-yet-open scheduled requests. Shared by the Forms
/// page and the bottom-nav unread dot so the two never drift apart.
bool formRequestNeedsAction(FormRequestSummary r) =>
    r.status == formStatusPending ||
    r.status == formStatusScheduled ||
    r.status == formStatusSent;

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
      _$FormRequestDetailFromJson(_withAttachmentCategoryKeys(json));
}

/// `attachment` questions store their category (images/documents/videos/any)
/// in the same `options` JSON column select/multiselect use for their choice
/// list — here it's an object, not an array. FormQuestion.options coerces
/// non-arrays to `[]` (see `_stringList`), which would silently discard it,
/// so each question's raw `options` is copied into a synthetic
/// `attachment_category` key before the generated parser ever sees it. Done
/// here (once, on the parent's raw question list) rather than by overriding
/// FormQuestion.fromJson itself — a hand-written body there breaks freezed's
/// toJson codegen for any type that embeds a `List<FormQuestion>`.
Map<String, dynamic> _withAttachmentCategoryKeys(Map<String, dynamic> json) {
  final questions = json['questions'];
  if (questions is! List) return json;
  return {
    ...json,
    'questions': questions.map((q) {
      if (q is! Map) return q;
      final rawOptions = q['options'];
      if (rawOptions is! Map) return q;
      return {...q, 'attachment_category': rawOptions['allowedCategory']};
    }).toList(),
  };
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
    // Populated from a synthetic key by _withAttachmentCategoryKeys above
    // (see server/src/lib/formAttachments.ts's ATTACHMENT_CATEGORIES for the
    // possible values) — not read directly off `options`.
    @JsonKey(name: 'attachment_category') String? attachmentCategory,
  }) = _FormQuestion;

  factory FormQuestion.fromJson(Map<String, dynamic> json) =>
      _$FormQuestionFromJson(json);
}

@freezed
abstract class FormResponse with _$FormResponse {
  const factory FormResponse({
    @JsonKey(name: 'question_id') required String questionId,
    String? answer,
    @Default(false) bool edited,
    @Default(<AnswerEditEntry>[]) List<AnswerEditEntry> history,
  }) = _FormResponse;

  factory FormResponse.fromJson(Map<String, dynamic> json) =>
      _$FormResponseFromJson(json);
}

/// One entry in an answer's edit trail (oldest first), as returned inline on
/// each `FormResponse` by `attachEditHistory` server-side.
@freezed
abstract class AnswerEditEntry with _$AnswerEditEntry {
  const factory AnswerEditEntry({
    @JsonKey(name: 'previous_answer') String? previousAnswer,
    @JsonKey(name: 'new_answer') String? newAnswer,
    @JsonKey(name: 'edited_at') required String editedAt,
  }) = _AnswerEditEntry;

  factory AnswerEditEntry.fromJson(Map<String, dynamic> json) =>
      _$AnswerEditEntryFromJson(json);
}

/// Options arrive as a JSON array (or null); coerce every element to a string.
List<String> _stringList(dynamic value) =>
    value is List ? value.map((e) => e.toString()).toList() : const <String>[];

