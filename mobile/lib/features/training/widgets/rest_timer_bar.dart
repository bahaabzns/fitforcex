import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/utils/workout.dart';

/// Floating rest countdown shown after a set is marked done. Presentational —
/// the parent owns the timer and passes the remaining seconds.
class RestTimerBar extends StatelessWidget {
  const RestTimerBar({
    super.key,
    required this.remaining,
    required this.target,
    required this.onAdd,
    required this.onSkip,
  });

  final int remaining;
  final int target;
  final ValueChanged<int> onAdd;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final done = remaining <= 0;
    final pct = target > 0 ? (remaining / target).clamp(0.0, 1.0) : 0.0;
    final accent = done ? _successColor : Theme.of(context).colorScheme.primary;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(16),
          color: Theme.of(context).scaffoldBackgroundColor,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                LinearProgressIndicator(
                  value: pct,
                  minHeight: 3,
                  backgroundColor: context.appColors.secondary,
                  valueColor: AlwaysStoppedAnimation(accent),
                ),
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      Text(
                        l10n.trainingRest.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                          color: muted,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        done ? l10n.trainingRestDone : formatClock(remaining),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: done ? _successColor : null,
                        ),
                      ),
                      const Spacer(),
                      OutlinedButton(
                        onPressed: () => onAdd(15),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child:
                            const Text('+15s', style: TextStyle(fontSize: 12)),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: onSkip,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text(l10n.trainingSkip,
                            style: const TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Local alias for the success accent so the timer reads cleanly.
const _successColor = Color(0xFF22C55E);
