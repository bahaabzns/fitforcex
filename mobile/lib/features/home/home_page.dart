import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../progress/progress_dashboard.dart';
import '../progress/progress_repository.dart';

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
