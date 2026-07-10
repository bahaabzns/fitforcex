import 'package:fitforce_x/shared/models/message.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Message.fromJson', () {
    test('defaults to a text message', () {
      final m = Message.fromJson(const {
        'id': 'm1',
        'sender_type': 'client',
        'body': 'hello',
      });
      expect(m.type, messageTypeText);
      expect(m.isClient, isTrue);
      expect(m.isDeleted, isFalse);
      expect(m.isEdited, isFalse);
    });

    test('parses an image attachment', () {
      final m = Message.fromJson(const {
        'id': 'm2',
        'sender_type': 'team',
        'type': 'image',
        'attachment_url': 'https://cdn/x.jpg',
        'attachment_name': 'photo.jpg',
        'attachment_size': 12345,
      });
      expect(m.isImage, isTrue);
      expect(m.attachmentUrl, 'https://cdn/x.jpg');
    });

    test('a deleted message carries deleted_at and no body/attachment', () {
      final m = Message.fromJson(const {
        'id': 'm3',
        'sender_type': 'client',
        'deleted_at': '2026-01-01T00:00:00Z',
        'body': null,
      });
      expect(m.isDeleted, isTrue);
    });

    test('an edited text message carries edited_at', () {
      final m = Message.fromJson(const {
        'id': 'm4',
        'sender_type': 'client',
        'body': 'updated text',
        'edited_at': '2026-01-01T00:00:00Z',
      });
      expect(m.isEdited, isTrue);
    });
  });
}
