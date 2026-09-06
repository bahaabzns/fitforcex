import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import 'prompt_card_host.dart';

/// The manual/immediate Founder Prompt surface — a floating, dismissible
/// card above the bottom nav. Dismiss is session-only (no persisted state),
/// matching web: only one manual prompt is ever active at a time, and it
/// simply comes back next session. Mount once in the app shell.
class InsightBanner extends StatelessWidget {
  const InsightBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return PromptCardHost(
      fetchPrompt: (repo) => repo.fetchActivePrompt(),
      persistDismiss: false,
      wrap: (context, card) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(16),
          color: Theme.of(context).cardColor,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: context.appColors.border),
            ),
            child: card,
          ),
        ),
      ),
    );
  }
}
