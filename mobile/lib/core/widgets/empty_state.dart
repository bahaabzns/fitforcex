import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Semantic intent of an [EmptyState], mirroring the web portal's empty-state
/// strategy. In this client app most empties are [informational] "your coach
/// hasn't added this yet" waiting states — they carry no action. Use [filter]
/// or [search] (a lighter, denser treatment) when data exists but the current
/// filter/search matched nothing, and pair those with a recovery action.
/// [permission] and [error] are prominent and always carry a recovery action.
///
/// There is intentionally no "first-time create" variant: clients never create
/// plans, forms, or logs — the coach assigns them — so a creation CTA never
/// belongs here. That activation case lives only in the coach web portal.
enum EmptyStateVariant { informational, filter, search, permission, error }

/// The portal's recurring centered empty state: icon + title + hint (+ action).
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.hint,
    this.action,
    this.variant = EmptyStateVariant.informational,
  });

  final IconData icon;
  final String title;
  final String? hint;
  final Widget? action;
  final EmptyStateVariant variant;

  /// search/filter empties get a lighter touch so they read as "narrow down"
  /// rather than the prominent "nothing here at all" waiting states.
  bool get _isLight =>
      variant == EmptyStateVariant.filter ||
      variant == EmptyStateVariant.search;

  @override
  Widget build(BuildContext context) {
    final muted = context.appColors.mutedForeground;
    final theme = Theme.of(context);
    final titleStyle =
        (_isLight ? theme.textTheme.titleSmall : theme.textTheme.titleMedium)
            ?.copyWith(fontWeight: FontWeight.w600);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: _isLight ? 36 : 52,
              color: muted.withValues(alpha: 0.3),
            ),
            SizedBox(height: _isLight ? 10 : 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: titleStyle,
            ),
            if (hint != null) ...[
              const SizedBox(height: 6),
              Text(
                hint!,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(color: muted),
              ),
            ],
            if (action != null) ...[
              SizedBox(height: _isLight ? 12 : 16),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}
