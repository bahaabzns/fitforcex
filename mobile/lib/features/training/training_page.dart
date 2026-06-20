import 'package:flutter/material.dart';

import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';

/// Placeholder — the real training plan view lands in Phase 3.
class TrainingPage extends StatelessWidget {
  const TrainingPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return EmptyState(
      icon: Icons.fitness_center_outlined,
      title: l10n.trainingTitle,
      hint: l10n.commonComingSoon,
    );
  }
}
