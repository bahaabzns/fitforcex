import 'package:flutter/material.dart';

import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';

/// Placeholder — the real nutrition plan view lands in Phase 2.
class NutritionPage extends StatelessWidget {
  const NutritionPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return EmptyState(
      icon: Icons.restaurant_outlined,
      title: l10n.nutritionTitle,
      hint: l10n.commonComingSoon,
    );
  }
}
