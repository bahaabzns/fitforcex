import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/insight_prompt.dart';
import '../insights_repository.dart';
import 'prompt_card.dart';

/// Shared fetch/respond/dismiss/thanked lifecycle for a Founder Prompt
/// surface. Renders nothing (`SizedBox.shrink`) until a prompt loads and
/// stays hidden once dismissed/answered — the caller only supplies how to
/// fetch the prompt, whether a dismiss persists server-side, and how to wrap
/// the resulting card (floating overlay vs. inline block). This is the one
/// shared implementation behind InsightBanner, TriggerInsightBanner, and
/// TriggerInsightBannerGroup, which otherwise would have tripled this logic.
class PromptCardHost extends ConsumerStatefulWidget {
  const PromptCardHost({
    super.key,
    required this.fetchPrompt,
    required this.persistDismiss,
    required this.wrap,
  });

  final Future<InsightPrompt?> Function(InsightsRepository repo) fetchPrompt;

  /// Manual/immediate prompts (InsightBanner) dismiss for this session only
  /// — no persisted state exists for that surface, matching web. Contextual
  /// (trigger-event) prompts persist the dismissal so a repeatable action
  /// doesn't keep re-asking.
  final bool persistDismiss;

  final Widget Function(BuildContext context, Widget card) wrap;

  @override
  ConsumerState<PromptCardHost> createState() => _PromptCardHostState();
}

class _PromptCardHostState extends ConsumerState<PromptCardHost> {
  InsightPrompt? _prompt;
  bool _hidden = false;
  bool _submitting = false;
  bool _thanked = false;

  @override
  void initState() {
    super.initState();
    widget.fetchPrompt(ref.read(insightsRepositoryProvider)).then((p) {
      if (mounted) setState(() => _prompt = p);
    }).catchError((_) {});
  }

  Future<void> _dismiss() async {
    final prompt = _prompt;
    setState(() => _hidden = true);
    if (widget.persistDismiss && prompt != null) {
      unawaited(ref.read(insightsRepositoryProvider).dismissPrompt(prompt.id));
    }
  }

  Future<void> _submit(PromptAnswer answer) async {
    final prompt = _prompt;
    if (prompt == null) return;
    setState(() => _submitting = true);
    try {
      await ref.read(insightsRepositoryProvider).respondToPrompt(
            prompt.id,
            ratingValue: answer.ratingValue,
            selectedOption: answer.selectedOption,
            textValue: answer.textValue,
          );
      if (!mounted) return;
      setState(() => _thanked = true);
      Future.delayed(const Duration(milliseconds: 1800), () {
        if (mounted) setState(() => _hidden = true);
      });
    } catch (_) {
      // Silent — a failed answer isn't worth interrupting the page with an
      // error; the card simply stays up so the client can retry.
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final prompt = _prompt;
    if (prompt == null || _hidden) return const SizedBox.shrink();

    return widget.wrap(
      context,
      PromptCard(
        prompt: prompt,
        onSubmit: _submit,
        onDismiss: _dismiss,
        onStart: () => ref
            .read(insightsRepositoryProvider)
            .markPromptStarted(prompt.id),
        submitting: _submitting,
        thanked: _thanked,
      ),
    );
  }
}
