import 'package:freezed_annotation/freezed_annotation.dart';

part 'message.freezed.dart';
part 'message.g.dart';

const messageSenderClient = 'client';
const messageSenderTeam = 'team';

const messageTypeText = 'text';
const messageTypeImage = 'image';
const messageTypeVoice = 'voice';
const messageTypeFile = 'file';

/// A chat message in the client↔coach thread (`GET /client-portal/messages`).
@freezed
abstract class Message with _$Message {
  const factory Message({
    required String id,
    @JsonKey(name: 'sender_type') @Default(messageSenderTeam) String senderType,
    @Default(messageTypeText) String type,
    @Default('') String body,
    @JsonKey(name: 'created_at') String? createdAt,
    @JsonKey(name: 'edited_at') String? editedAt,
    @JsonKey(name: 'deleted_at') String? deletedAt,
    @JsonKey(name: 'attachment_url') String? attachmentUrl,
    @JsonKey(name: 'attachment_name') String? attachmentName,
    @JsonKey(name: 'attachment_size') int? attachmentSize,
    @JsonKey(name: 'reply_to') MessageQuote? replyTo,
  }) = _Message;

  factory Message.fromJson(Map<String, dynamic> json) =>
      _$MessageFromJson(json);
}

/// The original message a reply quotes (`reply_to` on a message). A deleted
/// original arrives with its content already stripped by the server.
@freezed
abstract class MessageQuote with _$MessageQuote {
  const factory MessageQuote({
    required String id,
    @JsonKey(name: 'sender_type') @Default(messageSenderTeam) String senderType,
    @Default(messageTypeText) String type,
    @Default('') String body,
    @JsonKey(name: 'attachment_name') String? attachmentName,
    @JsonKey(name: 'attachment_url') String? attachmentUrl,
    @JsonKey(name: 'deleted_at') String? deletedAt,
  }) = _MessageQuote;

  factory MessageQuote.fromJson(Map<String, dynamic> json) =>
      _$MessageQuoteFromJson(json);
}

extension MessageQuoteX on MessageQuote {
  bool get isDeleted => deletedAt != null;
}

extension MessageX on Message {
  bool get isClient => senderType == messageSenderClient;
  bool get isDeleted => deletedAt != null;
  bool get isEdited => editedAt != null;
  bool get isImage => type == messageTypeImage;
  DateTime? get createdAtDate =>
      createdAt == null ? null : DateTime.tryParse(createdAt!)?.toLocal();
}
