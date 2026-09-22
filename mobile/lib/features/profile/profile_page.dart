import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/auth/auth_state.dart';
import '../../core/i18n/locale_controller.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/theme_mode_controller.dart';
import '../../l10n/generated/app_localizations.dart';
import '../insights/widgets/feedback_entry_modal.dart';
import 'subscription_repository.dart';
import 'widgets/subscription_status_chip.dart';

/// Profile: identity + preferences (theme, language) + logout. Mirror of the
/// web portal profile page.
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final client = auth.clientOrNull;
    final subscription = ref.watch(subscriptionProvider).asData?.value;
    final scheme = Theme.of(context).colorScheme;
    final muted = context.appColors.mutedForeground;

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.profileTitle),
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          // Identity
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: scheme.primary,
                  child: Text(
                    client?.initials ?? '?',
                    style: TextStyle(
                      fontSize: 28,
                      color: scheme.onPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  client?.fullName ?? '',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                if (client?.email != null)
                  Text(client!.email, style: TextStyle(color: muted)),
                if (client?.clientCode != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      '#${client!.clientCode}',
                      style: TextStyle(fontSize: 12, color: muted),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Subscription
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => context.push(AppRoutes.subscription),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: context.appColors.secondary,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Icon(Icons.credit_card, size: 16, color: muted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        text: l10n.subscriptionCardLabel,
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w500),
                        children: [
                          if ((subscription?.plan?.name ?? '').isNotEmpty)
                            TextSpan(
                              text: ' — ${subscription!.plan!.name}',
                              style: TextStyle(
                                  fontWeight: FontWeight.normal, color: muted),
                            ),
                        ],
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (subscription?.status != null) ...[
                    SubscriptionStatusChip(status: subscription!.status),
                    const SizedBox(width: 8),
                  ],
                  Icon(Icons.chevron_right, size: 16, color: muted),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Preferences
          Text(
            l10n.profilePreferences.toUpperCase(),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
              color: muted,
            ),
          ),
          const SizedBox(height: 8),
          _PreferenceTile(
            label: l10n.profileAppearance,
            trailing: const _ThemeSelector(),
          ),
          const SizedBox(height: 4),
          _PreferenceTile(
            label: l10n.profileLanguage,
            trailing: const _LanguageSelector(),
          ),
          const SizedBox(height: 24),

          // Feedback entry — opt-in only, never a popup
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => FeedbackEntryModal.show(context),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: context.appColors.secondary,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Icon(Icons.add_comment_outlined, size: 16, color: muted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(l10n.insightsNavLabel,
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w500)),
                  ),
                  Icon(Icons.chevron_right, size: 16, color: muted),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Logout
          FilledButton.tonalIcon(
            style: FilledButton.styleFrom(
              backgroundColor: scheme.error.withValues(alpha: 0.12),
              foregroundColor: scheme.error,
            ),
            onPressed: () => _confirmLogout(context, ref),
            icon: const Icon(Icons.logout, size: 18),
            label: Text(l10n.profileLogout),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.profileLogoutConfirmTitle),
        content: Text(l10n.profileLogoutConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.profileLogout),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authControllerProvider.notifier).logout();
      // Router redirect sends us to login on the unauthenticated state.
    }
  }
}

class _PreferenceTile extends StatelessWidget {
  const _PreferenceTile({required this.label, required this.trailing});
  final String label;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: context.appColors.secondary,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
          trailing,
        ],
      ),
    );
  }
}

class _ThemeSelector extends ConsumerWidget {
  const _ThemeSelector();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeControllerProvider);
    return SegmentedButton<ThemeMode>(
      showSelectedIcon: false,
      style: const ButtonStyle(visualDensity: VisualDensity.compact),
      segments: const [
        ButtonSegment(
            value: ThemeMode.system,
            icon: Icon(Icons.brightness_auto, size: 18)),
        ButtonSegment(
            value: ThemeMode.light, icon: Icon(Icons.light_mode, size: 18)),
        ButtonSegment(
            value: ThemeMode.dark, icon: Icon(Icons.dark_mode, size: 18)),
      ],
      selected: {mode},
      onSelectionChanged: (s) => unawaited(
        ref.read(themeModeControllerProvider.notifier).setMode(s.first),
      ),
    );
  }
}

class _LanguageSelector extends ConsumerWidget {
  const _LanguageSelector();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeControllerProvider);
    final current = locale?.languageCode ?? 'en';
    return DropdownButton<String>(
      value: current,
      underline: const SizedBox.shrink(),
      items: const [
        DropdownMenuItem(value: 'en', child: Text('English')),
        DropdownMenuItem(value: 'ar', child: Text('العربية')),
      ],
      onChanged: (code) {
        if (code != null) {
          unawaited(
            ref.read(localeControllerProvider.notifier).setLocale(Locale(code)),
          );
        }
      },
    );
  }
}
