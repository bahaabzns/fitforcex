import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/access/access_controller.dart';
import '../../core/network/api_exception.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/new_feature_hint.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/workout_log.dart';
import '../../shared/utils/workout.dart';
import '../access/restricted_view.dart';
import '../insights/widgets/trigger_insight_banner.dart';
import 'workout_repository.dart';

/// Logged workout history list. Tapping a session opens its detail; each
/// card also offers a delete action (with confirmation). Port of the web
/// training/history page.
class HistoryPage extends ConsumerWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final logs = ref.watch(workoutLogsProvider);
    final locale = Localizations.localeOf(context).toString();

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.trainingHistory),
        actions: [
          TextButton.icon(
            onPressed: () => context.push(AppRoutes.trainingProgress),
            icon: const Icon(Icons.show_chart, size: 18),
            label: Text(l10n.trainingProgress),
          ),
        ],
      ),
      body: !ref.watch(clientAccessProvider).canViewProgress
          ? RestrictedView(message: l10n.restrictedProgress)
          : AsyncValueWidget<List<WorkoutLogSummary>>(
              value: logs,
              onRetry: () => ref.invalidate(workoutLogsProvider),
              data: (logs) {
                if (logs.isEmpty) {
                  return EmptyState(
                    icon: Icons.fitness_center,
                    title: l10n.trainingNoLogs,
                    hint: l10n.trainingNoLogsHint,
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(24),
                  itemCount: logs.length + 1,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => i == 0
                      ? const TriggerInsightBannerGroup(
                          events: ['first_workout_logged', 'workout_logs_10x'])
                      : _LogTile(
                          log: logs[i - 1], locale: locale, isFirst: i == 1),
                );
              },
            ),
    );
  }
}

class _LogTile extends ConsumerStatefulWidget {
  const _LogTile({required this.log, required this.locale, required this.isFirst});

  final WorkoutLogSummary log;
  final String locale;
  final bool isFirst;

  @override
  ConsumerState<_LogTile> createState() => _LogTileState();
}

class _LogTileState extends ConsumerState<_LogTile> {
  bool _deleting = false;
  bool _deleteHintShown = false;

  Future<void> _confirmDelete() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.trainingDeleteLog),
        content: Text(l10n.trainingDeleteLogConfirm),
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
            child: Text(l10n.trainingDeleteLog),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _deleting = true);
    try {
      await ref.read(workoutRepositoryProvider).deleteLog(widget.log.id);
      ref.invalidate(workoutLogsProvider);
    } catch (e) {
      if (mounted) {
        final message =
            e is ApiException ? e.message : l10n.trainingDeleteLogFailed;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
        setState(() => _deleting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final primary = Theme.of(context).colorScheme.primary;
    final log = widget.log;
    final date = DateTime.tryParse(log.startTime ?? log.date);
    final dateLabel = date != null
        ? DateFormat.yMMMEd(widget.locale).add_jm().format(date)
        : log.date;

    _deleteHintShown = maybeShowFeatureHint(
      context,
      ref,
      featureKey: 'delete_log_hint',
      active: widget.isFirst,
      alreadyShown: _deleteHintShown,
      message: l10n.trainingDeleteLogHint,
      dismissLabel: l10n.trainingDeleteLogHintDismiss,
      badgeLabel: l10n.trainingDeleteLogNewFeature,
    );

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: _deleting
            ? null
            : () => context.push(AppRoutes.trainingHistoryDetail(log.id)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Opacity(
            opacity: _deleting ? 0.5 : 1,
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.fitness_center, size: 18, color: primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(log.dayName ?? l10n.trainingWorkout,
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text(dateLabel,
                          style: TextStyle(fontSize: 12, color: muted)),
                      const SizedBox(height: 2),
                      Text(
                        '${formatDuration(log.durationSeconds)} · ${_n(log.totalVolume)} ${l10n.trainingVolumeUnit} · ${log.totalSets} ${l10n.trainingSetsShort}',
                        style: TextStyle(fontSize: 12, color: muted),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: l10n.trainingDeleteLog,
                  onPressed: _deleting ? null : _confirmDelete,
                  icon: Icon(Icons.delete_outline, size: 20, color: muted),
                ),
                Icon(Icons.chevron_right, size: 18, color: muted),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _n(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();
}
