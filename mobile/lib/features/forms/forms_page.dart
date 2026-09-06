import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_controller.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/unread/unread_indicators.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/form.dart';
import '../../shared/utils/localization.dart';
import '../access/restricted_view.dart';
import '../insights/widgets/trigger_insight_banner.dart';
import 'forms_repository.dart';

enum _Filter { pending, submitted }

/// The client's forms list with Pending / Submitted filters. Port of the web
/// portal forms page.
class FormsPage extends ConsumerStatefulWidget {
  const FormsPage({super.key});

  @override
  ConsumerState<FormsPage> createState() => _FormsPageState();
}

class _FormsPageState extends ConsumerState<FormsPage> {
  _Filter _filter = _Filter.pending;

  @override
  void initState() {
    super.initState();
    // fireImmediately: ref.listen (used in build()) only fires on a state
    // *transition* — it never fires for a value the provider already holds
    // when the listener registers. Since the shell keeps this provider warm
    // (it watches the unread flags on every tab), the list is often already
    // loaded by the time this page mounts, so a build()-scoped ref.listen
    // never marks it seen. listenManual + fireImmediately fixes that, and
    // keeps listening for the page's lifetime so a newly-arrived request
    // while this tab is already active (kept alive by the IndexedStack)
    // still clears the dot correctly. The mutation itself is deferred a
    // microtask — Riverpod forbids modifying provider state while the widget
    // tree is still building, which fireImmediately's synchronous initState
    // call is.
    if (ref.read(clientAccessProvider).canViewForms) {
      ref.listenManual<AsyncValue<List<FormRequestSummary>>>(
        formRequestsProvider,
        (_, next) {
          final loaded = next.asData?.value;
          if (loaded != null) {
            unawaited(Future.microtask(() {
              // Mark every currently-actionable request "seen" — clears the
              // bottom-nav dot even for requests still unfilled (the dot
              // means "new," not "incomplete"); it only reappears for ids
              // not in this set, i.e. a genuinely new request.
              final actionable = loaded
                  .where(formRequestNeedsAction)
                  .map((r) => r.id)
                  .toSet();
              ref.read(formsSeenProvider.notifier).markSeen(actionable);
            }));
          }
        },
        fireImmediately: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;

    if (!ref.watch(clientAccessProvider).canViewForms) {
      return RestrictedView(message: l10n.restrictedForms);
    }

    final requests = ref.watch(formRequestsProvider);

    return AsyncValueWidget<List<FormRequestSummary>>(
      value: requests,
      onRetry: () => ref.invalidate(formRequestsProvider),
      data: (all) {
        bool isSubmittedBucket(FormRequestSummary r) =>
            r.status == formStatusSubmitted ||
            r.status == formStatusReviewed ||
            r.status == formStatusScheduled;
        bool isAwaitingClient(FormRequestSummary r) =>
            r.status == formStatusPending || r.status == formStatusSent;
        final pendingCount = all.where(isAwaitingClient).length;
        final submittedCount = all.where(isSubmittedBucket).length;
        final filtered = all.where((r) {
          if (_filter == _Filter.pending) return isAwaitingClient(r);
          return isSubmittedBucket(r);
        }).toList();
        // When the current tab is empty but the other has forms, offer to jump
        // there (recovery) instead of a dead end.
        final otherHasItems = _filter == _Filter.submitted
            ? pendingCount > 0
            : submittedCount > 0;

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        l10n.formsTitle,
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      if (pendingCount > 0) ...[
                        const SizedBox(width: 8),
                        _Chip(
                          label: l10n.formsPendingChip(pendingCount),
                          color: context.appColors.warning,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  _FilterPills(
                    filter: _filter,
                    onChanged: (f) => setState(() => _filter = f),
                  ),
                  const SizedBox(height: 12),
                  const TriggerInsightBanner(
                      triggerEvent: 'first_checkin_completed'),
                ],
              ),
            ),
            Expanded(
              child: filtered.isEmpty
                  ? (all.isEmpty
                      // No forms assigned at all — informational waiting state.
                      ? EmptyState(
                          icon: Icons.assignment_outlined,
                          title: l10n.formsEmptyNone,
                          hint: l10n.formsEmptyNoneHint,
                        )
                      // Forms exist, just not in this tab — filter recovery.
                      : EmptyState(
                          variant: EmptyStateVariant.filter,
                          icon: Icons.assignment_outlined,
                          title: _filter == _Filter.submitted
                              ? l10n.formsEmptySubmitted
                              : l10n.formsEmptyPending,
                          hint: l10n.formsEmptyHint,
                          action: otherHasItems
                              ? OutlinedButton(
                                  onPressed: () => setState(() {
                                    _filter = _filter == _Filter.submitted
                                        ? _Filter.pending
                                        : _Filter.submitted;
                                  }),
                                  child: Text(_filter == _Filter.submitted
                                      ? l10n.formsViewPending
                                      : l10n.formsViewSubmitted),
                                )
                              : null,
                        ))
                  : RefreshIndicator(
                      onRefresh: () async =>
                          ref.invalidate(formRequestsProvider),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) =>
                            _RequestCard(request: filtered[i], locale: locale),
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _FilterPills extends StatelessWidget {
  const _FilterPills({required this.filter, required this.onChanged});

  final _Filter filter;
  final ValueChanged<_Filter> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final items = {
      _Filter.pending: l10n.formsFilterPending,
      _Filter.submitted: l10n.formsFilterSubmitted,
    };
    final scheme = Theme.of(context).colorScheme;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (final entry in items.entries) ...[
          GestureDetector(
            onTap: () => onChanged(entry.key),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color:
                    filter == entry.key ? scheme.primary : Colors.transparent,
                border: Border.all(
                    color: filter == entry.key
                        ? scheme.primary
                        : context.appColors.border),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                entry.value,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: filter == entry.key
                      ? scheme.onPrimary
                      : context.appColors.mutedForeground,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request, required this.locale});

  final FormRequestSummary request;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final title = localizedField(
      base: request.formTitleEn ?? '',
      arabic: request.formTitleAr,
      localeCode: locale,
    );
    final desc = localizedField(
      base: request.formDescriptionEn ?? '',
      arabic: request.formDescriptionAr,
      localeCode: locale,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                  if (desc.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(desc,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: muted)),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            _trailing(context, l10n),
          ],
        ),
      ),
    );
  }

  Widget _trailing(BuildContext context, AppLocalizations l10n) {
    switch (request.status) {
      case formStatusPending:
      case formStatusSent:
        return FilledButton(
          onPressed: () => context.push(AppRoutes.formFill(request.id)),
          style: FilledButton.styleFrom(
            minimumSize: Size.zero,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text(l10n.formsFillForm),
        );
      case formStatusScheduled:
        return _Chip(
            label: l10n.formsNotOpenYet,
            color: context.appColors.mutedForeground);
      default:
        return OutlinedButton(
          onPressed: () => context.push(AppRoutes.formFill(request.id)),
          style: OutlinedButton.styleFrom(
            minimumSize: Size.zero,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text(l10n.formsViewAnswers),
        );
    }
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w500, color: color)),
    );
  }
}
