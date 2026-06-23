import '../../shared/models/message.dart';

/// A rendered chat segment: either a date separator or a group of consecutive
/// messages from the same sender. Pure (no UI/locale) so it's unit-testable.
sealed class ChatSegment {
  const ChatSegment();
}

class DateSeparator extends ChatSegment {
  const DateSeparator(this.date);
  final DateTime date;
}

class MessageGroup extends ChatSegment {
  MessageGroup(this.isClient, this.messages);
  final bool isClient;
  final List<Message> messages;
}

const _groupWindow = Duration(minutes: 5);

/// Groups consecutive same-sender messages within a 5-minute window and inserts
/// a date separator whenever the calendar day changes. Port of the web
/// `buildSegments`.
List<ChatSegment> buildChatSegments(List<Message> messages) {
  final groups = <MessageGroup>[];
  for (final m in messages) {
    final last = groups.isNotEmpty ? groups.last : null;
    final sameSender = last != null && last.isClient == m.isClient;
    final lastTime = last?.messages.last.createdAtDate;
    final withinWindow = lastTime != null &&
        m.createdAtDate != null &&
        m.createdAtDate!.difference(lastTime) < _groupWindow;
    if (sameSender && withinWindow) {
      last.messages.add(m);
    } else {
      groups.add(MessageGroup(m.isClient, [m]));
    }
  }

  final segments = <ChatSegment>[];
  DateTime? lastDay;
  for (final g in groups) {
    final d = g.messages.first.createdAtDate;
    if (d != null) {
      final day = DateTime(d.year, d.month, d.day);
      if (lastDay == null || day != lastDay) {
        segments.add(DateSeparator(day));
        lastDay = day;
      }
    }
    segments.add(g);
  }
  return segments;
}
