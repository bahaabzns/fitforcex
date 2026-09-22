import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// Tier color for a subscription status — every subscription surface
/// (profile summary row, subscription page, payment history) reuses this so
/// a status always reads the same color. Mirrors web's `subStatusColor`.
Color subscriptionStatusColor(BuildContext context, String? status) {
  switch (status) {
    case 'Active':
      return context.appColors.success;
    case 'Expired':
      return Theme.of(context).colorScheme.error;
    case 'Frozen':
      return Theme.of(context).colorScheme.primary;
    case 'Pre-start':
      return context.appColors.warning;
    case 'Refunded':
      return const Color(0xFF8B5CF6);
    default:
      return context.appColors.mutedForeground;
  }
}

/// Localized label for a subscription status, or null for an unrecognized
/// value (the caller should just hide the chip in that case).
String? subscriptionStatusLabel(AppLocalizations l10n, String? status) {
  switch (status) {
    case 'Active':
      return l10n.subscriptionStatusActive;
    case 'Expired':
      return l10n.subscriptionStatusExpired;
    case 'Frozen':
      return l10n.subscriptionStatusFrozen;
    case 'Pre-start':
      return l10n.subscriptionStatusPreStart;
    case 'Refunded':
      return l10n.subscriptionStatusRefunded;
    default:
      return null;
  }
}
