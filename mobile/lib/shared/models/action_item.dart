import 'package:freezed_annotation/freezed_annotation.dart';

part 'action_item.freezed.dart';
part 'action_item.g.dart';

/// One "needs your attention" entry on Home (`GET /client-portal/action-items`):
/// a pending check-in form, a newly assigned/restarted plan, or a
/// subscription entering its renewal grace window. `titleEn`/`subtitle` are
/// server-synthesized plain English for the non-form kinds — `home_page.dart`
/// re-translates those by kind/href instead of trusting them verbatim; only
/// `pending_form`'s title is genuinely dynamic, coach-authored text.
@freezed
abstract class ActionItem with _$ActionItem {
  const factory ActionItem({
    required String id,
    required String kind,
    @JsonKey(name: 'title_en') @Default('') String titleEn,
    @JsonKey(name: 'title_ar') String? titleAr,
    String? subtitle,
    required String href,
    @JsonKey(name: 'createdAt') String? createdAt,
  }) = _ActionItem;

  factory ActionItem.fromJson(Map<String, dynamic> json) =>
      _$ActionItemFromJson(json);
}
