import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';

/// Placeholder — matches the web portal's "coming soon" notifications. Wired to
/// push + a list in Phase 7.
class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.notificationsTitle),
      ),
      body: EmptyState(
        icon: Icons.notifications_outlined,
        title: l10n.notificationsComingSoon,
        hint: l10n.notificationsComingSoonHint,
      ),
    );
  }
}
