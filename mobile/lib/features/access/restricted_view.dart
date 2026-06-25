import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_controller.dart';
import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';

/// Shown in place of a module's content when the client's subscription no longer
/// grants access to it (direct navigation, deep link, push, or a saved route).
/// The backend also returns 403 for these routes — this is the UX mirror.
class RestrictedView extends ConsumerWidget {
  const RestrictedView({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return EmptyState(
      variant: EmptyStateVariant.permission,
      icon: Icons.lock_outline,
      title: l10n.restrictedTitle,
      hint: message,
      action: OutlinedButton.icon(
        onPressed: () => ref.read(accessControllerProvider.notifier).refresh(),
        icon: const Icon(Icons.refresh, size: 18),
        label: Text(l10n.statusRefresh),
      ),
    );
  }
}
