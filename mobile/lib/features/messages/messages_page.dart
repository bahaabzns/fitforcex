import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/access/access_controller.dart';
import '../../core/auth/token_storage.dart';
import '../../core/config/providers.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/message.dart';
import '../access/restricted_view.dart';
import '../insights/widgets/trigger_insight_banner.dart';
import '../notifications/notifications_repository.dart';
import 'message_segments.dart';
import 'messages_repository.dart';

const _pollInterval = Duration(seconds: 5);

/// Client ↔ coach chat. WhatsApp-style grouped bubbles with date separators,
/// realtime via Socket.IO with 5s polling as a fallback. Port of the web
/// messages page.
class MessagesPage extends ConsumerStatefulWidget {
  const MessagesPage({super.key});

  @override
  ConsumerState<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends ConsumerState<MessagesPage> {
  final _draft = TextEditingController();
  final _scroll = ScrollController();
  final _picker = ImagePicker();
  List<Message> _messages = [];
  bool _loading = true;
  bool _sending = false;
  bool _attaching = false;
  Message? _editing;
  Message? _replyingTo;
  String? _highlightedId;
  Timer? _highlightTimer;
  final _messageKeys = <String, GlobalKey>{};
  // Segment indices the list built since the last reset — lets a jump to an
  // off-screen original know which way to keep scrolling (ListView.builder
  // only builds what's near the viewport).
  final _builtSegmentIndices = <int>{};
  Timer? _poll;
  io.Socket? _socket;

  @override
  void initState() {
    super.initState();
    unawaited(_fetch(initial: true));
    _startPolling();
    unawaited(_initSocket());
  }

  @override
  void dispose() {
    _stopPolling();
    _highlightTimer?.cancel();
    _socket?.dispose();
    _draft.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _startPolling() {
    _poll ??= Timer.periodic(_pollInterval, (_) => unawaited(_fetch()));
  }

  void _stopPolling() {
    _poll?.cancel();
    _poll = null;
  }

  /// Connect to the realtime thread. On `new_message` we refetch; while the
  /// socket is live we stop polling, and resume it on disconnect/error.
  Future<void> _initSocket() async {
    final token = await ref.read(tokenStorageProvider).readToken();
    if (token == null || token.isEmpty || !mounted) return;
    final baseUrl = ref.read(appConfigProvider).apiBaseUrl;

    final socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket']).setAuth({'token': token}).build(),
    );
    _socket = socket;

    socket.onConnect((_) => _stopPolling());
    socket.on('new_message', (_) => unawaited(_fetch()));
    socket.onDisconnect((_) {
      if (mounted) _startPolling();
    });
    socket.onConnectError((_) {
      if (mounted) _startPolling();
    });
  }

  Future<void> _fetch({bool initial = false}) async {
    try {
      final thread = await ref.read(messagesRepositoryProvider).fetchThread();
      if (!mounted) return;
      final grew = thread.messages.length != _messages.length;
      setState(() {
        _messages = thread.messages;
        if (initial) _loading = false;
      });
      if (grew) _scrollToBottom();
      // Opening the thread marks team messages (+ the linked notification)
      // read server-side — refresh now instead of waiting up to 15s for the
      // next poll, so the Messages bottom-nav dot clears immediately.
      if (initial) ref.invalidate(unreadNotificationsProvider);
    } catch (_) {
      if (mounted && initial) setState(() => _loading = false);
    }
  }

  void _showSendError(Object error) {
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    final message = error is ApiException ? error.message : l10n.commonSomethingWentWrong;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
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
    if (_editing != null) return _saveEdit();

    setState(() => _sending = true);
    try {
      final msg = await ref
          .read(messagesRepositoryProvider)
          .send(body, replyToId: _replyingTo?.id);
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, msg];
        _draft.clear();
        _replyingTo = null;
      });
      _scrollToBottom();
    } catch (e) {
      // Leave the draft in place so the user can retry.
      _showSendError(e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _startEdit(Message m) {
    setState(() {
      _replyingTo = null;
      _editing = m;
      _draft.text = m.body;
    });
  }

  void _startReply(Message m) {
    if (m.isDeleted) return;
    setState(() {
      _editing = null;
      _replyingTo = m;
    });
  }

  void _cancelReply() => setState(() => _replyingTo = null);

  GlobalKey _keyFor(String messageId) =>
      _messageKeys.putIfAbsent(messageId, GlobalKey.new);

  /// Scrolls to a quoted original and flashes it. The list is lazy, so an
  /// off-screen target is reached by jumping toward it and nudging a viewport at
  /// a time until its row has been built.
  Future<void> _jumpToMessage(String messageId) async {
    final segments = buildChatSegments(_messages);
    final segmentIndex = segments.indexWhere(
      (s) => s is MessageGroup && s.messages.any((m) => m.id == messageId),
    );
    if (segmentIndex < 0) return;

    const maxNudges = 40;
    for (var attempt = 0; attempt < maxNudges; attempt++) {
      if (!mounted || !_scroll.hasClients) return;
      final targetContext = _keyFor(messageId).currentContext;
      if (targetContext != null && targetContext.mounted) {
        await Scrollable.ensureVisible(
          targetContext,
          alignment: 0.5,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
        _highlight(messageId);
        return;
      }

      final position = _scroll.position;
      final firstGuess = attempt == 0 && _builtSegmentIndices.isEmpty;
      final double target;
      if (firstGuess) {
        target = position.maxScrollExtent *
            (segmentIndex / (segments.length - 1).clamp(1, segments.length));
      } else {
        final built = _builtSegmentIndices;
        final towardEnd = built.isNotEmpty && built.reduce((a, b) => a > b ? a : b) < segmentIndex;
        target = position.pixels +
            (towardEnd ? 1 : -1) * position.viewportDimension * 0.8;
      }
      _builtSegmentIndices.clear();
      _scroll.jumpTo(target.clamp(0.0, position.maxScrollExtent));
      await WidgetsBinding.instance.endOfFrame;
    }
  }

  void _highlight(String messageId) {
    setState(() => _highlightedId = messageId);
    _highlightTimer?.cancel();
    _highlightTimer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _highlightedId = null);
    });
  }

  void _cancelEdit() {
    setState(() {
      _editing = null;
      _draft.clear();
    });
  }

  Future<void> _saveEdit() async {
    final editing = _editing;
    final body = _draft.text.trim();
    if (editing == null || body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final updated =
          await ref.read(messagesRepositoryProvider).edit(editing.id, body);
      if (!mounted) return;
      setState(() {
        _messages = [
          for (final m in _messages) if (m.id == updated.id) updated else m,
        ];
        _editing = null;
        _draft.clear();
      });
    } catch (e) {
      // Leave the draft + edit mode in place so the user can retry.
      _showSendError(e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _deleteMessage(Message m) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(l10n.messagesDeleteConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.messagesDelete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final updated = await ref.read(messagesRepositoryProvider).delete(m.id);
      if (!mounted) return;
      setState(() {
        _messages = [
          for (final msg in _messages) if (msg.id == updated.id) updated else msg,
        ];
      });
    } catch (_) {
      // Best-effort — leave the message as-is on failure.
    }
  }

  Future<void> _pickAttachment(ImageSource source) async {
    final file = await _picker.pickImage(source: source, imageQuality: 85);
    if (file == null || !mounted) return;

    setState(() => _attaching = true);
    try {
      final caption = _draft.text.trim();
      final msg = await ref.read(messagesRepositoryProvider).sendAttachment(
            file,
            caption: caption.isEmpty ? null : caption,
            replyToId: _replyingTo?.id,
          );
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, msg];
        _draft.clear();
        _replyingTo = null;
      });
      _scrollToBottom();
    } catch (e) {
      // Best-effort — the draft caption stays so the user can retry.
      _showSendError(e);
    } finally {
      if (mounted) setState(() => _attaching = false);
    }
  }

  void _showAttachSheet() {
    final l10n = AppLocalizations.of(context);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(l10n.formsPhotoTakePhoto),
              onTap: () {
                Navigator.pop(ctx);
                _pickAttachment(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(l10n.formsPhotoChooseFromGallery),
              onTap: () {
                Navigator.pop(ctx);
                _pickAttachment(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (!ref.watch(clientAccessProvider).canMessage) {
      return RestrictedView(message: l10n.restrictedMessages);
    }

    return Column(
      children: [
        _Header(coachName: l10n.messagesCoachFallback),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12),
          child: TriggerInsightBanner(
              triggerEvent: 'first_message_sent_by_client'),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _messages.isEmpty
                  ? _EmptyChat()
                  : _MessageList(
                      scroll: _scroll,
                      messages: _messages,
                      onEdit: _startEdit,
                      onDelete: _deleteMessage,
                      onReply: _startReply,
                      onQuoteTap: _jumpToMessage,
                      keyFor: _keyFor,
                      highlightedId: _highlightedId,
                      coachName: l10n.messagesCoachFallback,
                      onSegmentBuilt: _builtSegmentIndices.add,
                    ),
        ),
        SafeArea(
          top: false,
          child: Column(
            children: [
              if (_replyingTo != null && _editing == null)
                _ReplyPreview(
                  message: _replyingTo!,
                  senderName: _replyingTo!.isClient
                      ? l10n.messagesReplyYou
                      : l10n.messagesCoachFallback,
                  onCancel: _cancelReply,
                ),
              if (_editing != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      Icon(Icons.edit, size: 14, color: context.appColors.mutedForeground),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(l10n.messagesEditingBanner,
                            style: TextStyle(
                                fontSize: 12,
                                color: context.appColors.mutedForeground)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 16),
                        onPressed: _cancelEdit,
                      ),
                    ],
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                child: Row(
                  children: [
                    if (_editing == null)
                      IconButton(
                        onPressed: _attaching ? null : _showAttachSheet,
                        icon: _attaching
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.attach_file),
                      ),
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
                      icon: Icon(_editing != null ? Icons.check : Icons.send,
                          size: 18),
                    ),
                  ],
                ),
              ),
            ],
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
  const _MessageList({
    required this.scroll,
    required this.messages,
    required this.onEdit,
    required this.onDelete,
    required this.onReply,
    required this.onQuoteTap,
    required this.keyFor,
    required this.highlightedId,
    required this.coachName,
    required this.onSegmentBuilt,
  });

  final ScrollController scroll;
  final List<Message> messages;
  final ValueChanged<Message> onEdit;
  final ValueChanged<Message> onDelete;
  final ValueChanged<Message> onReply;
  final ValueChanged<String> onQuoteTap;
  final GlobalKey Function(String messageId) keyFor;
  final String? highlightedId;
  final String coachName;
  final void Function(int segmentIndex) onSegmentBuilt;

  @override
  Widget build(BuildContext context) {
    final segments = buildChatSegments(messages);
    return ListView.builder(
      controller: scroll,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: segments.length,
      itemBuilder: (context, i) {
        onSegmentBuilt(i);
        final seg = segments[i];
        return switch (seg) {
          DateSeparator(:final date) => _DateChip(date: date),
          MessageGroup() => _Group(
              group: seg,
              onEdit: onEdit,
              onDelete: onDelete,
              onReply: onReply,
              onQuoteTap: onQuoteTap,
              keyFor: keyFor,
              highlightedId: highlightedId,
              coachName: coachName,
            ),
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
  const _Group({
    required this.group,
    required this.onEdit,
    required this.onDelete,
    required this.onReply,
    required this.onQuoteTap,
    required this.keyFor,
    required this.highlightedId,
    required this.coachName,
  });
  final MessageGroup group;
  final ValueChanged<Message> onEdit;
  final ValueChanged<Message> onDelete;
  final ValueChanged<Message> onReply;
  final ValueChanged<String> onQuoteTap;
  final GlobalKey Function(String messageId) keyFor;
  final String? highlightedId;
  final String coachName;

  void _showActions(BuildContext context, Message m) {
    final l10n = AppLocalizations.of(context);
    // Edit/delete are only for the client's own messages; Reply is for everyone.
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.reply),
              title: Text(l10n.messagesReply),
              onTap: () {
                Navigator.pop(ctx);
                onReply(m);
              },
            ),
            if (m.isClient && m.type == messageTypeText)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: Text(l10n.messagesEdit),
                onTap: () {
                  Navigator.pop(ctx);
                  onEdit(m);
                },
              ),
            if (m.isClient)
              ListTile(
                leading: const Icon(Icons.delete_outline),
                title: Text(l10n.messagesDelete),
                onTap: () {
                  Navigator.pop(ctx);
                  onDelete(m);
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, Message m, bool isClient) {
    final l10n = AppLocalizations.of(context);
    final primary = Theme.of(context).colorScheme.primary;
    final highlighted = highlightedId == m.id;

    final bubble = KeyedSubtree(
      key: keyFor(m.id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          boxShadow: highlighted
              ? [BoxShadow(color: primary.withValues(alpha: 0.6), spreadRadius: 2)]
              : const [],
        ),
        child: _Bubble(
          message: m,
          isClient: isClient,
          coachName: coachName,
          onQuoteTap: onQuoteTap,
        ),
      ),
    );

    final row = Align(
      alignment: isClient
          ? AlignmentDirectional.centerEnd
          : AlignmentDirectional.centerStart,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.78,
        ),
        child: GestureDetector(
          onLongPress: m.isDeleted ? null : () => _showActions(context, m),
          child: bubble,
        ),
      ),
    );

    if (m.isDeleted) return row;

    // Swipe toward the reading direction to reply. confirmDismiss returns false
    // so the row always springs back instead of being removed.
    return Dismissible(
      key: ValueKey('reply-swipe-${m.id}'),
      direction: DismissDirection.startToEnd,
      dismissThresholds: const {DismissDirection.startToEnd: 0.2},
      confirmDismiss: (_) async {
        onReply(m);
        return false;
      },
      background: Align(
        alignment: AlignmentDirectional.centerStart,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Icon(Icons.reply,
              semanticLabel: l10n.messagesReply,
              color: context.appColors.mutedForeground),
        ),
      ),
      child: row,
    );
  }

  @override
  Widget build(BuildContext context) {
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
              child: _row(context, m, isClient),
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

/// Accent-barred summary of a quoted message: text excerpt, or a short label
/// for photo / voice / file, or the deleted notice. Used inside reply bubbles
/// ([MessageQuote]) and in the composer's preview ([Message]).
class _QuoteBlock extends StatelessWidget {
  const _QuoteBlock({
    required this.senderName,
    required this.type,
    required this.body,
    required this.attachmentName,
    required this.attachmentUrl,
    required this.isDeleted,
    required this.foreground,
    required this.accent,
    this.onTap,
  });

  final String senderName;
  final String type;
  final String body;
  final String? attachmentName;
  final String? attachmentUrl;
  final bool isDeleted;
  final Color foreground;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final style = TextStyle(fontSize: 12, color: foreground.withValues(alpha: 0.85));

    final IconData? icon;
    final String summary;
    if (isDeleted) {
      icon = null;
      summary = l10n.messagesDeletedPlaceholder;
    } else if (type == messageTypeImage) {
      icon = Icons.image_outlined;
      summary = body.isNotEmpty ? body : l10n.messagesReplyPhoto;
    } else if (type == messageTypeVoice) {
      icon = Icons.mic_none;
      summary = l10n.messagesReplyVoice;
    } else if (type == messageTypeFile) {
      icon = Icons.insert_drive_file_outlined;
      summary = (attachmentName ?? '').isNotEmpty ? attachmentName! : l10n.messagesReplyFile;
    } else {
      icon = null;
      summary = body;
    }
    final showThumbnail =
        !isDeleted && type == messageTypeImage && (attachmentUrl ?? '').isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        decoration: BoxDecoration(
          color: foreground.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: BorderDirectional(start: BorderSide(color: accent, width: 4)),
        ),
        padding: const EdgeInsetsDirectional.fromSTEB(8, 6, 8, 6),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(senderName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: style.copyWith(fontWeight: FontWeight.w600, color: accent)),
                  Row(
                    children: [
                      if (icon != null) ...[
                        Icon(icon, size: 13, color: style.color),
                        const SizedBox(width: 4),
                      ],
                      Expanded(
                        child: Text(
                          summary,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: isDeleted
                              ? style.copyWith(fontStyle: FontStyle.italic)
                              : style,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (showThumbnail) ...[
              const SizedBox(width: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.network(
                  attachmentUrl!,
                  width: 36,
                  height: 36,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox(width: 36, height: 36),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// "Replying to …" strip above the input, with an X to cancel.
class _ReplyPreview extends StatelessWidget {
  const _ReplyPreview({
    required this.message,
    required this.senderName,
    required this.onCancel,
  });

  final Message message;
  final String senderName;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 0),
      child: Row(
        children: [
          Expanded(
            child: _QuoteBlock(
              senderName: senderName,
              type: message.type,
              body: message.body,
              attachmentName: message.attachmentName,
              attachmentUrl: message.attachmentUrl,
              isDeleted: message.isDeleted,
              foreground: scheme.onSurface,
              accent: scheme.primary,
            ),
          ),
          IconButton(
            tooltip: l10n.messagesCancelReply,
            icon: const Icon(Icons.close, size: 18),
            onPressed: onCancel,
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.message,
    required this.isClient,
    required this.coachName,
    required this.onQuoteTap,
  });

  final Message message;
  final bool isClient;
  final String coachName;
  final ValueChanged<String> onQuoteTap;

  Widget? _quote(BuildContext context, Color fg) {
    final quoted = message.replyTo;
    if (quoted == null || message.isDeleted) return null;
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return _QuoteBlock(
      senderName: quoted.senderType == messageSenderClient
          ? l10n.messagesReplyYou
          : coachName,
      type: quoted.type,
      body: quoted.body,
      attachmentName: quoted.attachmentName,
      attachmentUrl: quoted.attachmentUrl,
      isDeleted: quoted.isDeleted,
      foreground: fg,
      accent: isClient ? scheme.onPrimary : scheme.primary,
      onTap: () => onQuoteTap(quoted.id),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fg = isClient ? scheme.onPrimary : scheme.onSurface;
    final bg = isClient ? scheme.primary : context.appColors.secondary;
    final quote = _quote(context, fg);

    if (message.isDeleted) {
      final l10n = AppLocalizations.of(context);
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
        child: Text(l10n.messagesDeletedPlaceholder,
            style: TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: fg.withValues(alpha: 0.7))),
      );
    }

    if (message.isImage && (message.attachmentUrl ?? '').isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Container(
          color: bg,
          padding: const EdgeInsets.all(4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (quote != null) quote,
              GestureDetector(
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => _ImageViewer(url: message.attachmentUrl!),
                )),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    message.attachmentUrl!,
                    width: 200,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 200,
                      height: 140,
                      alignment: Alignment.center,
                      child: const Icon(Icons.broken_image_outlined),
                    ),
                  ),
                ),
              ),
              if (message.body.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 6, 8, 4),
                  child: Text(message.body,
                      style: TextStyle(fontSize: 13, color: fg)),
                ),
            ],
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (quote != null) quote,
          Text(message.body, style: TextStyle(fontSize: 14, height: 1.3, color: fg)),
          if (message.isEdited)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(AppLocalizations.of(context).messagesEditedLabel,
                  style: TextStyle(fontSize: 10, color: fg.withValues(alpha: 0.7))),
            ),
        ],
      ),
    );
  }
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Center(child: InteractiveViewer(child: Image.network(url))),
    );
  }
}
