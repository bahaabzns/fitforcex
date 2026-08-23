import 'package:flutter/material.dart';

import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/utils/subscription_status.dart';

/// Small colored pill for a subscription status — shared by the profile
/// summary row, the subscription page's plan card, and each payment-history
/// row. Renders nothing for an unrecognized/null status.
class SubscriptionStatusChip extends StatelessWidget {
  const SubscriptionStatusChip({super.key, required this.status});

  final String? status;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final label = subscriptionStatusLabel(l10n, status);
    if (label == null) return const SizedBox.shrink();

    final color = subscriptionStatusColor(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
