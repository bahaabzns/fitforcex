import 'package:flutter/material.dart';

import '../../core/access/client_access.dart';
import '../../core/theme/app_colors.dart';
import '../../l10n/generated/app_localizations.dart';

/// Persistent slim banner shown above the shell body when the subscription is
/// expired or frozen (but the portal is still open). Hidden for active clients.
class SubscriptionStatusBanner extends StatelessWidget {
  const SubscriptionStatusBanner({super.key, required this.access});

  final ClientAccess access;

  @override
  Widget build(BuildContext context) {
    if (!access.isRestricted) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final frozen = access.isFrozen;
    final accent = frozen ? AppColors.warning : AppColors.danger;
    final text = frozen ? l10n.statusBannerFrozen : l10n.statusBannerExpired;
    final icon = frozen ? Icons.pause_circle_outline : Icons.error_outline;

    return Material(
      color: accent.withValues(alpha: 0.12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Icon(icon, size: 16, color: accent),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: accent,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
