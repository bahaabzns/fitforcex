import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/new_feature_hint.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/insight_prompt.dart';
import '../../shared/utils/workout.dart';
import '../insights/insights_repository.dart';

/// Shown once, right after a client finishes a Training Mode session —
/// replaces the old silent redirect straight to History. The rating+text
/// section is deliberately built from scratch rather than reusing
/// PromptCard/InsightBanner: those read as a dismissible "quick question"
/// card, and this is meant to feel like part of the celebration itself.
/// Port of the web `session/complete` page (commit 0a7f9bc).
///
/// Unlike web, this always exposes a close action regardless of whether the
/// post-session prompt loads — web's page has no way forward when the fetch
/// fails because its persistent bottom nav is still reachable underneath;
/// mobile pushes this full-screen with no nav visible, so leaving the client
/// stranded here on a failed fetch would be a real trap.
class SessionCompletePage extends ConsumerStatefulWidget {
  const SessionCompletePage({
    super.key,
    this.dayName,
    this.durationSeconds,
    this.volume,
    this.sets,
  });

  final String? dayName;
  final int? durationSeconds;
  final String? volume;
  final int? sets;

  @override
  ConsumerState<SessionCompletePage> createState() =>
      _SessionCompletePageState();
}

class _SessionCompletePageState extends ConsumerState<SessionCompletePage> {
  // Picked once, not on every rebuild (a rating tap shouldn't change it).
  late final int _phraseIndex = Random().nextInt(8);

  InsightPrompt? _prompt;
  bool _loadingPrompt = true;
  int _rating = 0;
  int _hoverRating = 0;
  bool _rateHintShown = false;
  final _feedbackController = TextEditingController();

  @override
  void initState() {
    super.initState();
    unawaited(_loadPrompt());
  }

  @override
  void dispose() {
    _feedbackController.dispose();
    super.dispose();
  }

  Future<void> _loadPrompt() async {
    try {
      final prompt =
          await ref.read(insightsRepositoryProvider).fetchPostSessionPrompt();
      if (mounted) setState(() => _prompt = prompt);
    } catch (_) {
      // Feedback is a nice-to-have — a failed fetch just hides that section.
    } finally {
      if (mounted) setState(() => _loadingPrompt = false);
    }
  }

  void _backToPlan() => context.go(AppRoutes.training);

  // Feedback is a nice-to-have, not the critical path — fire it and leave
  // immediately rather than making the client wait on a confirmation screen.
  void _sendFeedback() {
    final prompt = _prompt;
    if (prompt == null || _rating == 0) return;
    final text = _feedbackController.text.trim();
    unawaited(
      ref
          .read(insightsRepositoryProvider)
          .respondToPrompt(
            prompt.id,
            ratingValue: _rating,
            textValue: text.isEmpty ? null : text,
          )
          .catchError((_) {}),
    );
    _backToPlan();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final phrases = [
      l10n.trainingMotivationalPhrase1,
      l10n.trainingMotivationalPhrase2,
      l10n.trainingMotivationalPhrase3,
      l10n.trainingMotivationalPhrase4,
      l10n.trainingMotivationalPhrase5,
      l10n.trainingMotivationalPhrase6,
      l10n.trainingMotivationalPhrase7,
      l10n.trainingMotivationalPhrase8,
    ];
    final muted = context.appColors.mutedForeground;
    final hasStats =
        widget.durationSeconds != null || widget.volume != null || widget.sets != null;

    _rateHintShown = maybeShowFeatureHint(
      context,
      ref,
      featureKey: 'rate_session_hint',
      active: !_loadingPrompt && _prompt != null,
      alreadyShown: _rateHintShown,
      message: l10n.trainingRateSessionHint,
      dismissLabel: l10n.trainingRateSessionHintDismiss,
      badgeLabel: l10n.trainingRateSessionNewFeature,
    );

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close),
          tooltip: l10n.commonClose,
          onPressed: _backToPlan,
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: context.appColors.success.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.celebration,
                      size: 32, color: context.appColors.success),
                ),
                const SizedBox(height: 12),
                Text(
                  l10n.trainingSessionCompleteTitle,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                if ((widget.dayName ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(widget.dayName!,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: muted)),
                ],
                const SizedBox(height: 6),
                Text(
                  phrases[_phraseIndex],
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: muted),
                ),
                if (hasStats) ...[
                  const SizedBox(height: 24),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (widget.durationSeconds != null)
                        _Stat(
                          value: formatDuration(widget.durationSeconds),
                          label: l10n.trainingWorkout,
                        ),
                      if (widget.volume != null)
                        _Stat(
                          value: '${widget.volume} ${l10n.trainingVolumeUnit}',
                          label: l10n.trainingMetricVolume,
                        ),
                      if (widget.sets != null)
                        _Stat(
                          value: '${widget.sets}',
                          label: l10n.trainingSetsShort,
                        ),
                    ],
                  ),
                ],
                if (!_loadingPrompt && _prompt != null) ...[
                  const SizedBox(height: 24),
                  Divider(color: context.appColors.border),
                  const SizedBox(height: 20),
                  Text(
                    _prompt!.questionEn,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (var n = 1; n <= _prompt!.scaleMax; n++)
                        IconButton(
                          onPressed: () => setState(() => _rating = n),
                          onHover: (hovering) =>
                              setState(() => _hoverRating = hovering ? n : 0),
                          icon: Icon(
                            (_hoverRating > 0 ? _hoverRating : _rating) >= n
                                ? Icons.star
                                : Icons.star_border,
                            color: (_hoverRating > 0 ? _hoverRating : _rating) >= n
                                ? Colors.amber
                                : muted.withValues(alpha: 0.4),
                            size: 28,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _feedbackController,
                    minLines: 3,
                    maxLines: 5,
                    decoration: InputDecoration(
                      hintText: l10n.trainingFeedbackPlaceholder,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _rating == 0 ? null : _sendFeedback,
                      child: Text(l10n.trainingSendFeedback),
                    ),
                  ),
                  const SizedBox(height: 4),
                  SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      onPressed: _backToPlan,
                      child: Text(l10n.trainingSkipFeedback),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        children: [
          Text(value,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(fontSize: 11, color: context.appColors.mutedForeground)),
        ],
      ),
    );
  }
}
