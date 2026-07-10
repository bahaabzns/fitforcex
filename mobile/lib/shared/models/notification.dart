import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification.freezed.dart';
part 'notification.g.dart';

const notificationImportanceInfo = 'info';
const notificationImportanceActionable = 'actionable';
const notificationImportanceAlert = 'alert';

/// A row from `GET /client-portal/notifications` — mirrors the `notifications`
/// table (`recipient_type` is always `'client'` on this endpoint).
@freezed
abstract class AppNotification with _$AppNotification {
  const factory AppNotification({
    required String id,
    required String type,
    @Default(notificationImportanceInfo) String importance,
    required String title,
    String? body,
    @JsonKey(name: 'entity_type') String? entityType,
    @JsonKey(name: 'entity_id') String? entityId,
    @JsonKey(name: 'read_at') String? readAt,
    @JsonKey(name: 'created_at') String? createdAt,
  }) = _AppNotification;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      _$AppNotificationFromJson(json);
}

extension AppNotificationX on AppNotification {
  bool get isUnread => readAt == null;
  DateTime? get createdAtDate =>
      createdAt == null ? null : DateTime.tryParse(createdAt!)?.toLocal();
}
