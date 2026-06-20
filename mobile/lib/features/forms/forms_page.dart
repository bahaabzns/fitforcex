import 'package:flutter/material.dart';

import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';

/// Placeholder — the real forms list + renderer lands in Phase 5.
class FormsPage extends StatelessWidget {
  const FormsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return EmptyState(
      icon: Icons.assignment_outlined,
      title: l10n.formsTitle,
      hint: l10n.commonComingSoon,
    );
  }
}
