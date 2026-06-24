import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/access/access_controller.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/workout_log.dart';
import '../../shared/utils/workout.dart';
import '../access/restricted_view.dart';
import 'workout_repository.dart';

/// Logged workout history list. Tapping a session opens its detail.
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
                  itemCount: logs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _LogTile(log: logs[i], locale: locale),
                );
              },
            ),
    );
  }
}

class _LogTile extends StatelessWidget {
  const _LogTile({required this.log, required this.locale});

  final WorkoutLogSummary log;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final date = DateTime.tryParse(log.date);
    final dateLabel =
        date != null ? DateFormat.yMMMEd(locale).format(date) : log.date;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push(AppRoutes.trainingHistoryDetail(log.id)),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(log.dayName ?? l10n.trainingWorkout,
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    Text(dateLabel,
                        style: TextStyle(fontSize: 12, color: muted)),
                  ],
                ),
              ),
              Row(
                children: [
                  _stat(formatDuration(log.durationSeconds), muted),
                  const SizedBox(width: 12),
                  _stat('${_n(log.totalVolume)} ${l10n.trainingVolumeUnit}',
                      muted),
                  const SizedBox(width: 12),
                  _stat('${log.totalSets} ${l10n.trainingSetsShort}', muted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stat(String text, Color muted) =>
      Text(text, style: TextStyle(fontSize: 12, color: muted));

  static String _n(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();
}
