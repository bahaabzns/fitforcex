import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/access/access_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/workout_log.dart';
import '../../shared/utils/exercise_tracking_types.dart';
import '../../shared/utils/format_amount.dart';
import '../../shared/utils/localization.dart';
import '../../shared/utils/workout.dart';
import '../access/restricted_view.dart';
import 'workout_repository.dart';

/// A single logged session with its exercises and sets. Port of the web
/// history/[logId] page.
class HistoryDetailPage extends ConsumerWidget {
  const HistoryDetailPage({super.key, required this.logId});

  final String logId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final log = ref.watch(workoutLogProvider(logId));
    final locale = Localizations.localeOf(context).toString();

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.trainingHistory),
      ),
      body: !ref.watch(clientAccessProvider).canViewProgress
          ? RestrictedView(message: l10n.restrictedProgress)
          : AsyncValueWidget<WorkoutLogDetail>(
              value: log,
              onRetry: () => ref.invalidate(workoutLogProvider(logId)),
              data: (log) {
                final date = DateTime.tryParse(log.date);
                final dateLabel = date != null
                    ? DateFormat.yMMMEd(locale).format(date)
                    : log.date;
                final muted = context.appColors.mutedForeground;

                return ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(log.dayName ?? l10n.trainingWorkout,
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    Text(dateLabel,
                        style: TextStyle(fontSize: 13, color: muted)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _stat(formatDuration(log.durationSeconds), muted),
                        const SizedBox(width: 12),
                        _stat(
                            '${prettyAmount(log.totalVolume)} ${l10n.trainingVolumeUnit}',
                            muted),
                        const SizedBox(width: 12),
                        _stat('${log.totalSets} ${l10n.trainingSetsShort}',
                            muted),
                      ],
                    ),
                    const SizedBox(height: 16),
                    for (var i = 0; i < log.exercises.length; i++) ...[
                      _ExerciseCard(exercise: log.exercises[i], index: i),
                      const SizedBox(height: 12),
                    ],
                  ],
                );
              },
            ),
    );
  }

  Widget _stat(String text, Color muted) =>
      Text(text, style: TextStyle(fontSize: 12, color: muted));
}

class _ExerciseCard extends StatelessWidget {
  const _ExerciseCard({required this.exercise, required this.index});

  final LoggedExerciseDetail exercise;
  final int index;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final primary = Theme.of(context).colorScheme.primary;
    final locale = Localizations.localeOf(context).languageCode;
    final exerciseName = localizedField(
      base: exercise.libraryNameEn ?? exercise.name,
      arabic: exercise.libraryNameAr,
      localeCode: locale,
    );
    final header = TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.5,
      color: muted.withValues(alpha: 0.6),
    );

    Widget cell(String t, TextStyle? s) => Expanded(child: Text(t, style: s));

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('#${index + 1}',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: primary)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(exerciseName,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                cell(l10n.trainingSet.toUpperCase(), header),
                for (final field in _loggedFields)
                  cell(fieldLabel(l10n, field).toUpperCase(), header),
              ],
            ),
            const SizedBox(height: 4),
            for (var i = 0; i < exercise.sets.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Builder(
                  builder: (context) {
                    final s = exercise.sets[i];
                    final dim =
                        s.completed ? null : muted.withValues(alpha: 0.5);
                    final style = TextStyle(fontSize: 13, color: dim);
                    return Row(
                      children: [
                        cell('${i + 1}', TextStyle(fontSize: 12, color: muted)),
                        for (final field in _loggedFields)
                          cell(_fieldValue(s, field), style),
                      ],
                    );
                  },
                ),
              ),
            if ((exercise.note ?? '').isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(exercise.note!,
                  style: TextStyle(
                      fontSize: 12, fontStyle: FontStyle.italic, color: muted)),
            ],
          ],
        ),
      ),
    );
  }

  // Snapshotted at submission time, so history renders exactly what was
  // prescribed then even if the coach later changes the catalog exercise's
  // type/metrics. Only ever the *loggable* fields — tempo/rir/rpe are
  // prescribed targets, and a completed log has no "prescribed" data to
  // show a target from, only what was actually logged.
  List<String> get _loggedFields =>
      loggedFieldsFor(exercise.trackingType, exercise.trackedMetrics);

  static String _n(double? v) => v != null ? prettyAmount(v) : '—';

  static String _fieldValue(LoggedSet set, String field) => switch (field) {
        'weight' => _n(set.weight),
        'reps' => _n(set.reps),
        'duration_seconds' =>
          set.durationSeconds != null ? formatClock(set.durationSeconds!) : '—',
        'distance_km' => _n(set.distanceKm),
        'incline_percent' => _n(set.inclinePercent),
        'speed_kmh' => _n(set.speedKmh),
        _ => '—',
      };
}
