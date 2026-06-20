import 'package:flutter/material.dart';

import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';

/// Placeholder — the real chat thread lands in Phase 6.
class MessagesPage extends StatelessWidget {
  const MessagesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return EmptyState(
      icon: Icons.chat_bubble_outline,
      title: l10n.messagesTitle,
      hint: l10n.commonComingSoon,
    );
  }
}
