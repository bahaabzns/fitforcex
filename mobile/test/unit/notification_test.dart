import 'package:fitforce_x/shared/models/notification.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppNotification.fromJson', () {
    test('maps snake_case fields and importance', () {
      final n = AppNotification.fromJson(const {
        'id': 'n1',
        'type': 'message.received',
        'importance': 'actionable',
        'title': 'New message from your coach',
        'entity_type': 'thread',
        'entity_id': 't1',
        'created_at': '2026-01-01T00:00:00Z',
      });
      expect(n.id, 'n1');
      expect(n.importance, notificationImportanceActionable);
      expect(n.entityType, 'thread');
      expect(n.isUnread, isTrue);
    });

    test('read_at set means not unread', () {
      final n = AppNotification.fromJson(const {
        'id': 'n1',
        'type': 'plan.assigned',
        'title': 'A new plan was assigned to you',
        'read_at': '2026-01-02T00:00:00Z',
      });
      expect(n.isUnread, isFalse);
    });
  });
}
