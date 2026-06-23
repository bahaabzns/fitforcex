import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/message.dart';
import 'message_segments.dart';
import 'messages_repository.dart';

const _pollInterval = Duration(seconds: 5);

/// Client ↔ coach chat. WhatsApp-style grouped bubbles with date separators,
/// 5s polling (socket realtime is a follow-up). Port of the web messages page.
class MessagesPage extends ConsumerStatefulWidget {
  const MessagesPage({super.key});

  @override
  ConsumerState<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends ConsumerState<MessagesPage> {
  final _draft = TextEditingController();
  final _scroll = ScrollController();
  List<Message> _messages = [];
  String? _coachName;
  bool _loading = true;
  bool _sending = false;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    unawaited(_fetch(initial: true));
    _poll = Timer.periodic(_pollInterval, (_) => unawaited(_fetch()));
  }

  @override
  void dispose() {
    _poll?.cancel();
    _draft.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _fetch({bool initial = false}) async {
    try {
      final thread = await ref.read(messagesRepositoryProvider).fetchThread();
      if (!mounted) return;
      final grew = thread.messages.length != _messages.length;
      setState(() {
        _messages = thread.messages;
        _coachName = thread.coachName ?? _coachName;
        if (initial) _loading = false;
      });
      if (grew) _scrollToBottom();
    } catch (_) {
      if (mounted && initial) setState(() => _loading = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final body = _draft.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final msg = await ref.read(messagesRepositoryProvider).send(body);
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, msg];
        _draft.clear();
      });
      _scrollToBottom();
    } catch (_) {
      // Leave the draft in place so the user can retry.
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Column(
      children: [
        _Header(coachName: _coachName ?? l10n.messagesCoachFallback),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _messages.isEmpty
                  ? _EmptyChat()
                  : _MessageList(
                      scroll: _scroll,
                      messages: _messages,
                    ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _draft,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(),
                    decoration: InputDecoration(
                      hintText: l10n.messagesReplyHint,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _sending ? null : _send,
                  icon: const Icon(Icons.send, size: 18),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.coachName});
  final String coachName;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final initials = coachName.trim().isEmpty
        ? 'C'
        : coachName
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((w) => w[0])
            .join()
            .toUpperCase();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: context.appColors.border)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: scheme.primary,
            child: Text(initials,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: scheme.onPrimary)),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(coachName,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600)),
              Text(l10n.messagesSubtitle,
                  style: TextStyle(
                      fontSize: 12, color: context.appColors.mutedForeground)),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyChat extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.send, size: 28, color: muted),
          const SizedBox(height: 8),
          Text(l10n.messagesEmptyTitle,
              style: const TextStyle(fontWeight: FontWeight.w500)),
          const SizedBox(height: 4),
          Text(l10n.messagesEmptyHint,
              style: TextStyle(fontSize: 12, color: muted)),
        ],
      ),
    );
  }
}

class _MessageList extends StatelessWidget {
  const _MessageList({required this.scroll, required this.messages});

  final ScrollController scroll;
  final List<Message> messages;

  @override
  Widget build(BuildContext context) {
    final segments = buildChatSegments(messages);
    return ListView.builder(
      controller: scroll,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: segments.length,
      itemBuilder: (context, i) {
        final seg = segments[i];
        return switch (seg) {
          DateSeparator(:final date) => _DateChip(date: date),
          MessageGroup() => _Group(group: seg),
        };
      },
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({required this.date});
  final DateTime date;

  String _label(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final diff = today.difference(date).inDays;
    if (diff == 0) return l10n.messagesToday;
    if (diff == 1) return l10n.messagesYesterday;
    final locale = Localizations.localeOf(context).toString();
    return DateFormat.MMMEd(locale).format(date);
  }

  @override
  Widget build(BuildContext context) {
    final muted = context.appColors.mutedForeground;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Expanded(child: Divider(color: context.appColors.border)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(_label(context),
                style: TextStyle(fontSize: 11, color: muted)),
          ),
          Expanded(child: Divider(color: context.appColors.border)),
        ],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.group});
  final MessageGroup group;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = context.appColors.mutedForeground;
    final isClient = group.isClient;
    final last = group.messages.last.createdAtDate;
    final time =
        last != null ? TimeOfDay.fromDateTime(last).format(context) : '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment:
            isClient ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          for (final m in group.messages)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Align(
                alignment: isClient
                    ? AlignmentDirectional.centerEnd
                    : AlignmentDirectional.centerStart,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                  ),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: isClient
                          ? scheme.primary
                          : context.appColors.secondary,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      m.body,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.3,
                        color: isClient
                            ? scheme.onPrimary
                            : Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(time, style: TextStyle(fontSize: 11, color: muted)),
          ),
        ],
      ),
    );
  }
}
