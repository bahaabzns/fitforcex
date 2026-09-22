import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/action_item.dart';
import '../../shared/utils/localization.dart';
import '../notifications/notifications_repository.dart';
import '../progress/progress_dashboard.dart';
import '../progress/progress_repository.dart';
import 'action_items_repository.dart';

/// Home tab: the client's body-transformation/progress dashboard — matching
/// the web client portal exactly, where `/portal/home` IS the Progress
/// section (metric charts, progress photos, date-range picker, submission
/// timeline) and nothing else. No dashboard-hub tiles here; every other
/// module (Nutrition/Training/Forms/Messages) is reached via the bottom tab
/// bar, same as the web nav.
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(transformationProvider),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        children: [
          Text(
            l10n.homeTitle,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          const _ActionNeededSection(),
          Text(
            l10n.progressTitle,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          const ProgressDashboardBody(),
        ],
      ),
    );
  }
}

/// "Needs your attention" strip: pending check-in forms, a newly
/// assigned/restarted plan, a subscription in its renewal grace window.
/// Hidden entirely when there's nothing to show, matching the web behavior.
class _ActionNeededSection extends ConsumerWidget {
  const _ActionNeededSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(actionItemsProvider).valueOrNull ?? const [];
    if (items.isEmpty) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.homeActionNeeded.toUpperCase(),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
              color: context.appColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 8),
          for (final item in items) ...[
            _ActionItemTile(item: item),
            const SizedBox(height: 6),
          ],
        ],
      ),
    );
  }
}

class _ActionItemTile extends ConsumerWidget {
  const _ActionItemTile({required this.item});

  final ActionItem item;

  IconData get _icon {
    if (item.kind == 'subscription') return Icons.credit_card;
    if (item.kind == 'plan_update') {
      return item.href == '/portal/training'
          ? Icons.fitness_center
          : Icons.restaurant;
    }
    return Icons.assignment;
  }

  String _title(AppLocalizations l10n, String locale) {
    if (item.kind == 'subscription') return l10n.homeSubscriptionExpiringSoon;
    if (item.kind == 'plan_update') {
      return item.href == '/portal/training'
          ? l10n.homeTrainingPlanAssigned
          : l10n.homeNutritionPlanAssigned;
    }
    // Only pending_form carries genuinely dynamic, coach-authored text —
    // everything else is fixed copy synthesized server-side.
    return localizedField(
      base: item.titleEn,
      arabic: item.titleAr,
      localeCode: locale,
    );
  }

  String? _subtitle(AppLocalizations l10n) {
    if (item.kind == 'subscription') return l10n.homeRenewNowSubtitle;
    if (item.kind == 'pending_form') return l10n.homeCheckinFormReady;
    if (item.kind == 'plan_update') {
      return item.href == '/portal/training'
          ? l10n.homeNewTrainingPlanSubtitle
          : l10n.homeNewNutritionPlanSubtitle;
    }
    return item.subtitle;
  }

  Future<void> _openHref(BuildContext context, WidgetRef ref) async {
    if (item.kind == 'plan_update') {
      unawaited(
          ref.read(notificationsRepositoryProvider).markRead(item.id));
    }

    final href = item.href;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      final uri = Uri.tryParse(href);
      if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
    }
    if (!context.mounted) return;
    if (href.startsWith('/portal/forms/')) {
      unawaited(
          context.push(AppRoutes.formFill(href.substring('/portal/forms/'.length))));
    } else if (href == '/portal/training') {
      context.go(AppRoutes.training);
    } else if (href == '/portal/nutrition') {
      context.go(AppRoutes.nutrition);
    } else {
      context.go(AppRoutes.profile);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final muted = context.appColors.mutedForeground;
    final isSubscription = item.kind == 'subscription';
    final accent =
        isSubscription ? Theme.of(context).colorScheme.error : Theme.of(context).colorScheme.primary;
    final subtitle = _subtitle(l10n);

    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _openHref(context, ref),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(_icon, size: 14, color: accent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _title(l10n, locale),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.w500),
                    ),
                    if (subtitle != null && subtitle.isNotEmpty)
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 11.5, color: muted),
                      ),
                  ],
                ),
              ),
              Icon(
                Directionality.of(context) == TextDirection.rtl
                    ? Icons.chevron_left
                    : Icons.chevron_right,
                size: 16,
                color: muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
