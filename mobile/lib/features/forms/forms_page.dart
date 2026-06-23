import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/form.dart';
import '../../shared/utils/localization.dart';
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
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final requests = ref.watch(formRequestsProvider);

    return AsyncValueWidget<List<FormRequestSummary>>(
      value: requests,
      onRetry: () => ref.invalidate(formRequestsProvider),
      data: (all) {
        final pendingCount =
            all.where((r) => r.status == formStatusPending).length;
        final filtered = all.where((r) {
          if (_filter == _Filter.pending) return r.status == formStatusPending;
          return r.status == formStatusSubmitted ||
              r.status == formStatusReviewed ||
              r.status == formStatusScheduled;
        }).toList();

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
                ],
              ),
            ),
            Expanded(
              child: filtered.isEmpty
                  ? EmptyState(
                      icon: Icons.assignment_outlined,
                      title: _filter == _Filter.submitted
                          ? l10n.formsEmptySubmitted
                          : l10n.formsEmptyPending,
                      hint: l10n.formsEmptyHint,
                    )
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
