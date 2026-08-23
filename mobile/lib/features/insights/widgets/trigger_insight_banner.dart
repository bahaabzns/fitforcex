import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/insight_prompt.dart';
import '../insights_repository.dart';
import 'prompt_card_host.dart';

Widget _inlineCard(BuildContext context, Widget card) {
  return Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 16),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: context.appColors.border),
    ),
    child: card,
  );
}

/// The contextual counterpart to [InsightBanner] — checks, on mount, whether
/// a prompt tied to [triggerEvent] is eligible for this client right now
/// (the server evaluates the condition; this widget never guesses). Mounted
/// on the page a client lands on right after the triggering action. Unlike
/// [InsightBanner], dismiss here persists server-side, so a contextual
/// prompt tied to a repeatable action doesn't keep re-asking.
class TriggerInsightBanner extends StatelessWidget {
  const TriggerInsightBanner({super.key, required this.triggerEvent});

  final String triggerEvent;

  @override
  Widget build(BuildContext context) {
    return PromptCardHost(
      fetchPrompt: (repo) => repo.fetchPromptForTrigger(triggerEvent),
      persistDismiss: true,
      wrap: _inlineCard,
    );
  }
}

/// Checks a list of trigger events for this page (in order) and renders the
/// first one that's eligible — never more than one at a time. Some pages
/// have more than one meaningful moment worth a trigger.
class TriggerInsightBannerGroup extends StatelessWidget {
  const TriggerInsightBannerGroup({super.key, required this.events});

  final List<String> events;

  Future<InsightPrompt?> _fetchFirstEligible(InsightsRepository repo) async {
    for (final event in events) {
      try {
        final prompt = await repo.fetchPromptForTrigger(event);
        if (prompt != null) return prompt;
      } catch (_) {
        // Try the next trigger in the list.
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return PromptCardHost(
      fetchPrompt: (repo) => _fetchFirstEligible(repo),
      persistDismiss: true,
      wrap: _inlineCard,
    );
  }
}
