import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/notification.dart';
import 'notifications_repository.dart';

enum _Filter { all, unread, messages, coaching, billing }

const _coachingTypes = {
  'plan.assigned',
  'plan.duration_restarted',
  'plan.review_due',
  'checkin.reviewed',
  'checkin.requested',
  'checkin.submitted',
  'checkin.assigned',
  'client.created',
};
const _billingTypes = {
  'billing.payment_received',
  'billing.payment_failed',
  'subscription.expired',
  'subscription.frozen',
  'subscription.reactivated',
};

_Filter _categoryOf(String type) {
  if (type == 'message.received') return _Filter.messages;
  if (_billingTypes.contains(type)) return _Filter.billing;
  if (_coachingTypes.contains(type)) return _Filter.coaching;
  return _Filter.coaching;
}

/// Full notifications list: filters, priority accent, read/unread state,
/// mark-read/mark-all-read, and deep links into the right tab/screen. Port of
/// the web notifications page.
class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  _Filter _filter = _Filter.all;

  List<AppNotification> _apply(List<AppNotification> all) {
    return all.where((n) {
      return switch (_filter) {
        _Filter.all => true,
        _Filter.unread => n.isUnread,
        _ => _categoryOf(n.type) == _filter,
      };
    }).toList();
  }

  Future<void> _open(AppNotification n) async {
    final repo = ref.read(notificationsRepositoryProvider);
    if (n.isUnread) {
      unawaited(repo.markRead(n.id).then((_) {
        ref.invalidate(notificationsProvider);
        ref.invalidate(unreadNotificationsCountProvider);
      }));
    }
    final route = _destinationFor(n);
    if (route == null || !mounted) return;
    if (route.startsWith('/forms/')) {
      unawaited(context.push(route));
    } else {
      context.go(route);
    }
  }

  String? _destinationFor(AppNotification n) {
    switch (n.type) {
      case 'message.received':
        return AppRoutes.messages;
      case 'plan.assigned':
      case 'plan.duration_restarted':
        return n.entityType == 'training_plan'
            ? AppRoutes.training
            : AppRoutes.nutrition;
      case 'checkin.reviewed':
        return n.entityId != null
            ? AppRoutes.formFill(n.entityId!)
            : AppRoutes.forms;
      case 'checkin.requested':
        return AppRoutes.forms;
      case 'subscription.expired':
      case 'subscription.frozen':
      case 'subscription.reactivated':
        return AppRoutes.home;
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final notifications = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.notificationsTitle),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(notificationsRepositoryProvider).markAllRead();
              ref.invalidate(notificationsProvider);
              ref.invalidate(unreadNotificationsCountProvider);
            },
            child: Text(l10n.notificationsMarkAllRead),
          ),
        ],
      ),
      body: AsyncValueWidget<List<AppNotification>>(
        value: notifications,
        onRetry: () => ref.invalidate(notificationsProvider),
        data: (all) {
          if (all.isEmpty) {
            return EmptyState(
              icon: Icons.notifications_outlined,
              title: l10n.notificationsComingSoon,
              hint: l10n.notificationsComingSoonHint,
            );
          }
          final filtered = _apply(all);
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: _FilterChips(
                  filter: _filter,
                  onChanged: (f) => setState(() => _filter = f),
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(l10n.notificationsEmptyFiltered,
                                style: TextStyle(
                                    color: context.appColors.mutedForeground)),
                            TextButton(
                              onPressed: () =>
                                  setState(() => _filter = _Filter.all),
                              child: Text(l10n.notificationsClearFilter),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) =>
                            _NotificationTile(n: filtered[i], onTap: _open),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({required this.filter, required this.onChanged});

  final _Filter filter;
  final ValueChanged<_Filter> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final labels = {
      _Filter.all: l10n.notificationsFilterAll,
      _Filter.unread: l10n.notificationsFilterUnread,
      _Filter.messages: l10n.notificationsFilterMessages,
      _Filter.coaching: l10n.notificationsFilterCoaching,
      _Filter.billing: l10n.notificationsFilterBilling,
    };
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final f in _Filter.values)
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: ChoiceChip(
                label: Text(labels[f]!),
                selected: filter == f,
                onSelected: (_) => onChanged(f),
              ),
            ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.n, required this.onTap});

  final AppNotification n;
  final ValueChanged<AppNotification> onTap;

  Color _accent(BuildContext context) => switch (n.importance) {
        notificationImportanceAlert => Theme.of(context).colorScheme.error,
        notificationImportanceActionable => context.appColors.warning,
        _ => Colors.transparent,
      };

  IconData get _icon => switch (n.type) {
        'message.received' => Icons.chat_bubble_outline,
        'plan.assigned' || 'plan.duration_restarted' => Icons.fitness_center,
        'checkin.reviewed' || 'checkin.requested' => Icons.assignment_outlined,
        _ when n.type.startsWith('subscription.') || n.type.startsWith('billing.') =>
          Icons.credit_card,
        _ => Icons.notifications_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final muted = context.appColors.mutedForeground;
    final created = n.createdAtDate;
    final locale = Localizations.localeOf(context).toString();
    final timeLabel = created != null
        ? DateFormat.MMMd(locale).add_jm().format(created)
        : '';

    // A rounded container can't have a border with per-side colors in
    // Flutter (BoxDecoration throws at paint time: "borderRadius can only be
    // given for borders with uniform colors"). The web's CSS `border-left`
    // accent + rounded-corners look is reproduced instead with a ClipRRect
    // that clips a Row: a solid accent bar on the leading edge, and the
    // content pane with its own (uniform-color) border on the other three
    // sides.
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => onTap(n),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: _accent(context)),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: n.isUnread
                        ? Theme.of(context)
                            .colorScheme
                            .primary
                            .withValues(alpha: 0.05)
                        : null,
                    border: Border.all(color: context.appColors.border),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(_icon, size: 20, color: muted),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(n.title,
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: n.isUnread
                                        ? FontWeight.w600
                                        : FontWeight.w400)),
                            if ((n.body ?? '').isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(n.body!,
                                    style:
                                        TextStyle(fontSize: 12, color: muted)),
                              ),
                            const SizedBox(height: 4),
                            Text(timeLabel,
                                style: TextStyle(fontSize: 11, color: muted)),
                          ],
                        ),
                      ),
                      if (n.isUnread)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(top: 4),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
