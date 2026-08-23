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
  String? _coachName;
  bool _loading = true;
  bool _sending = false;
  bool _attaching = false;
  Message? _editing;
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
        _coachName = thread.coachName ?? _coachName;
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
      final msg = await ref.read(messagesRepositoryProvider).send(body);
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, msg];
        _draft.clear();
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
      _editing = m;
      _draft.text = m.body;
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
      final msg = await ref
          .read(messagesRepositoryProvider)
          .sendAttachment(file, caption: caption.isEmpty ? null : caption);
      if (!mounted) return;
      setState(() {
        _messages = [..._messages, msg];
        _draft.clear();
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
        _Header(coachName: _coachName ?? l10n.messagesCoachFallback),
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
                    ),
        ),
        SafeArea(
          top: false,
          child: Column(
            children: [
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
  });

  final ScrollController scroll;
  final List<Message> messages;
  final ValueChanged<Message> onEdit;
  final ValueChanged<Message> onDelete;

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
          MessageGroup() =>
            _Group(group: seg, onEdit: onEdit, onDelete: onDelete),
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
  const _Group({required this.group, required this.onEdit, required this.onDelete});
  final MessageGroup group;
  final ValueChanged<Message> onEdit;
  final ValueChanged<Message> onDelete;

  void _showActions(BuildContext context, Message m) {
    final l10n = AppLocalizations.of(context);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            if (m.type == messageTypeText)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: Text(l10n.messagesEdit),
                onTap: () {
                  Navigator.pop(ctx);
                  onEdit(m);
                },
              ),
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
              child: Align(
                alignment: isClient
                    ? AlignmentDirectional.centerEnd
                    : AlignmentDirectional.centerStart,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                  ),
                  child: GestureDetector(
                    onLongPress: (isClient && !m.isDeleted)
                        ? () => _showActions(context, m)
                        : null,
                    child: _Bubble(message: m, isClient: isClient),
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

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.isClient});

  final Message message;
  final bool isClient;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fg = isClient ? scheme.onPrimary : scheme.onSurface;
    final bg = isClient ? scheme.primary : context.appColors.secondary;

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
