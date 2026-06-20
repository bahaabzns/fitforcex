import 'package:flutter/material.dart';

import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';

/// Placeholder home — matches the web portal's "coming soon" home until a real
/// dashboard is designed (plan Phase 7).
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return EmptyState(
      icon: Icons.home_outlined,
      title: l10n.homeComingSoon,
      hint: l10n.homeComingSoonHint,
    );
  }
}
