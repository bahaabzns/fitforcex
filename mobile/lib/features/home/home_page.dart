import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_state.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/form.dart';
import '../forms/forms_repository.dart';
import '../nutrition/nutrition_repository.dart';
import '../training/training_repository.dart';

/// Home dashboard: a quick at-a-glance summary that links into each tab.
/// Replaces the placeholder; aggregates existing endpoints (no backend change).
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final firstName = switch (auth) {
      Authenticated(:final client) => client.fname,
      _ => '',
    };

    final nutrition = ref.watch(activeNutritionPlanProvider);
    final training = ref.watch(activeTrainingPlanProvider);
    final forms = ref.watch(formRequestsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(activeNutritionPlanProvider);
        ref.invalidate(activeTrainingPlanProvider);
        ref.invalidate(formRequestsProvider);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        children: [
          Text(
            firstName.isEmpty ? l10n.homeTitle : l10n.homeWelcome(firstName),
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _DashboardCard(
            icon: Icons.restaurant,
            title: l10n.nutritionTitle,
            subtitle: nutrition.maybeWhen(
              data: (p) => p?.name.isNotEmpty == true
                  ? p!.name
                  : l10n.nutritionNoActivePlan,
              orElse: () => '…',
            ),
            onTap: () => context.go(AppRoutes.nutrition),
          ),
          const SizedBox(height: 12),
          _DashboardCard(
            icon: Icons.fitness_center,
            title: l10n.trainingTitle,
            subtitle: training.maybeWhen(
              data: (p) => p?.name.isNotEmpty == true
                  ? p!.name
                  : l10n.trainingNoActivePlan,
              orElse: () => '…',
            ),
            onTap: () => context.go(AppRoutes.training),
          ),
          const SizedBox(height: 12),
          _DashboardCard(
            icon: Icons.assignment,
            title: l10n.formsTitle,
            subtitle: forms.maybeWhen(
              data: (list) {
                final pending =
                    list.where((r) => r.status == formStatusPending).length;
                return pending > 0
                    ? l10n.formsPendingChip(pending)
                    : l10n.homeAllCaughtUp;
              },
              orElse: () => '…',
            ),
            badge: forms.maybeWhen(
              data: (list) =>
                  list.where((r) => r.status == formStatusPending).length,
              orElse: () => 0,
            ),
            onTap: () => context.go(AppRoutes.forms),
          ),
          const SizedBox(height: 12),
          _DashboardCard(
            icon: Icons.chat_bubble,
            title: l10n.messagesTitle,
            subtitle: l10n.messagesSubtitle,
            onTap: () => context.go(AppRoutes.messages),
          ),
        ],
      ),
    );
  }
}

class _DashboardCard extends StatelessWidget {
  const _DashboardCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = context.appColors.mutedForeground;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: scheme.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: scheme.primary, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: muted)),
                  ],
                ),
              ),
              if (badge > 0)
                Container(
                  margin: const EdgeInsetsDirectional.only(end: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: context.appColors.warning,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('$badge',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
                ),
              Icon(Icons.chevron_right, color: muted),
            ],
          ),
        ),
      ),
    );
  }
}
