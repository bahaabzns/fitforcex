import 'package:freezed_annotation/freezed_annotation.dart';

part 'message.freezed.dart';
part 'message.g.dart';

const messageSenderClient = 'client';
const messageSenderTeam = 'team';

/// A chat message in the client↔coach thread (`GET /client-portal/messages`).
@freezed
class Message with _$Message {
  const factory Message({
    required String id,
    @JsonKey(name: 'sender_type') @Default(messageSenderTeam) String senderType,
    @Default('') String body,
    @JsonKey(name: 'created_at') String? createdAt,
  }) = _Message;

  factory Message.fromJson(Map<String, dynamic> json) =>
      _$MessageFromJson(json);
}

extension MessageX on Message {
  bool get isClient => senderType == messageSenderClient;
  DateTime? get createdAtDate =>
      createdAt == null ? null : DateTime.tryParse(createdAt!)?.toLocal();
}
