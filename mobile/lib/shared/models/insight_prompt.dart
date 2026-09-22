import 'package:freezed_annotation/freezed_annotation.dart';

part 'insight_prompt.freezed.dart';
part 'insight_prompt.g.dart';

/// A Founder Prompt micro-survey question (manual/immediate via
/// `/prompts/active`, or contextual via `/prompts/for-trigger/:event` and
/// `/prompts/post-session`). Web never reads `question_ar` for these either
/// (server-authored content, always shown in English) — matched here.
@freezed
abstract class InsightPrompt with _$InsightPrompt {
  const factory InsightPrompt({
    required String id,
    @JsonKey(name: 'question_en') @Default('') String questionEn,
    @JsonKey(name: 'response_type') @Default('text') String responseType,
    @JsonKey(fromJson: _stringListOrNull) List<String>? options,
    @JsonKey(name: 'scale_max') @Default(10) int scaleMax,
  }) = _InsightPrompt;

  factory InsightPrompt.fromJson(Map<String, dynamic> json) =>
      _$InsightPromptFromJson(json);
}

List<String>? _stringListOrNull(dynamic value) =>
    value is List ? value.map((e) => e.toString()).toList() : null;
