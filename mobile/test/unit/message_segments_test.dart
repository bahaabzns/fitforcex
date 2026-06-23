import 'package:fitforce_x/features/messages/message_segments.dart';
import 'package:fitforce_x/shared/models/message.dart';
import 'package:flutter_test/flutter_test.dart';

Message _m(String id, String sender, DateTime at) => Message(
    id: id, senderType: sender, body: id, createdAt: at.toIso8601String());

void main() {
  group('buildChatSegments', () {
    test('groups same-sender messages within 5 minutes', () {
      final base = DateTime(2026, 1, 1, 10);
      final segs = buildChatSegments([
        _m('a', messageSenderClient, base),
        _m('b', messageSenderClient, base.add(const Duration(minutes: 2))),
      ]);
      final groups = segs.whereType<MessageGroup>().toList();
      expect(groups.length, 1);
      expect(groups.first.messages.length, 2);
      expect(groups.first.isClient, isTrue);
    });

    test('splits when sender changes or window exceeded', () {
      final base = DateTime(2026, 1, 1, 10);
      final segs = buildChatSegments([
        _m('a', messageSenderClient, base),
        _m('b', messageSenderTeam, base.add(const Duration(minutes: 1))),
        _m('c', messageSenderTeam, base.add(const Duration(minutes: 30))),
      ]);
      expect(segs.whereType<MessageGroup>().length, 3);
    });

    test('inserts a date separator per calendar day', () {
      final segs = buildChatSegments([
        _m('a', messageSenderClient, DateTime(2026, 1, 1, 10)),
        _m('b', messageSenderClient, DateTime(2026, 1, 2, 10)),
      ]);
      expect(segs.whereType<DateSeparator>().length, 2);
    });

    test('empty input yields no segments', () {
      expect(buildChatSegments([]), isEmpty);
    });
  });
}
