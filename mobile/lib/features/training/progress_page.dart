import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/workout_log.dart';
import 'widgets/line_chart.dart';
import 'workout_repository.dart';

enum _Metric { topWeight, est1rm, totalVolume }

/// Per-exercise progress: pick a logged exercise, pick a metric, see the trend.
/// Port of the web training/progress page.
class ProgressPage extends ConsumerStatefulWidget {
  const ProgressPage({super.key});

  @override
  ConsumerState<ProgressPage> createState() => _ProgressPageState();
}

class _ProgressPageState extends ConsumerState<ProgressPage> {
  LoggedExerciseRef? _selected;
  _Metric _metric = _Metric.topWeight;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final exercises = ref.watch(loggedExercisesProvider);

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.trainingProgress),
      ),
      body: AsyncValueWidget<List<LoggedExerciseRef>>(
        value: exercises,
        onRetry: () => ref.invalidate(loggedExercisesProvider),
        data: (list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.show_chart,
              title: l10n.trainingNoExercisesForProgress,
            );
          }
          final selected = _selected ?? list.first;
          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              _ExercisePicker(
                exercises: list,
                selected: selected,
                onSelected: (e) => setState(() => _selected = e),
              ),
              const SizedBox(height: 12),
              _MetricToggle(
                metric: _metric,
                onChanged: (m) => setState(() => _metric = m),
              ),
              const SizedBox(height: 16),
              _Chart(selected: selected, metric: _metric),
            ],
          );
        },
      ),
    );
  }
}

class _ExercisePicker extends StatelessWidget {
  const _ExercisePicker({
    required this.exercises,
    required this.selected,
    required this.onSelected,
  });

  final List<LoggedExerciseRef> exercises;
  final LoggedExerciseRef selected;
  final ValueChanged<LoggedExerciseRef> onSelected;

  bool _same(LoggedExerciseRef a, LoggedExerciseRef b) =>
      (a.exerciseLibraryId ?? a.name) == (b.exerciseLibraryId ?? b.name);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = context.appColors.mutedForeground;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final ex in exercises) ...[
            GestureDetector(
              onTap: () => onSelected(ex),
              child: Container(
                margin: const EdgeInsetsDirectional.only(end: 8),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color:
                      _same(ex, selected) ? scheme.primary : Colors.transparent,
                  border: Border.all(
                      color: _same(ex, selected)
                          ? scheme.primary
                          : context.appColors.border),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  ex.name,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: _same(ex, selected) ? scheme.onPrimary : muted,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetricToggle extends StatelessWidget {
  const _MetricToggle({required this.metric, required this.onChanged});

  final _Metric metric;
  final ValueChanged<_Metric> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final labels = {
      _Metric.topWeight: l10n.trainingMetricWeight,
      _Metric.est1rm: l10n.trainingMetricOneRm,
      _Metric.totalVolume: l10n.trainingMetricVolume,
    };
    return Row(
      children: [
        for (final m in _Metric.values)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: GestureDetector(
                onTap: () => onChanged(m),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: metric == m
                        ? context.appColors.secondary
                        : Colors.transparent,
                    border: Border.all(
                        color: metric == m
                            ? context.appColors.border
                            : Colors.transparent),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    labels[m]!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: metric == m
                          ? Theme.of(context).colorScheme.onSurface
                          : context.appColors.mutedForeground,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Chart extends ConsumerWidget {
  const _Chart({required this.selected, required this.metric});

  final LoggedExerciseRef selected;
  final _Metric metric;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final series = ref.watch(exerciseProgressProvider(
      (libraryId: selected.exerciseLibraryId, exerciseId: selected.exerciseId),
    ));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: series.when(
          loading: () => const SizedBox(
              height: 220, child: Center(child: CircularProgressIndicator())),
          error: (_, __) => SizedBox(
            height: 220,
            child: Center(child: Text(l10n.commonFailedToLoad)),
          ),
          data: (points) {
            if (points.isEmpty) {
              return SizedBox(
                height: 220,
                child: Center(
                  child: Text(l10n.trainingNoLogsForExercise,
                      style:
                          TextStyle(color: context.appColors.mutedForeground)),
                ),
              );
            }
            final chartData = [
              for (final p in points)
                ChartPoint(_label(p.date, locale), _value(p)),
            ];
            return LineChart(
                data: chartData, valueLabel: l10n.trainingVolumeUnit);
          },
        ),
      ),
    );
  }

  double _value(ProgressPoint p) => switch (metric) {
        _Metric.topWeight => p.topWeight,
        _Metric.est1rm => p.est1rm,
        _Metric.totalVolume => p.totalVolume,
      };

  String _label(String date, String locale) {
    final d = DateTime.tryParse(date);
    return d != null ? DateFormat.MMMd(locale).format(d) : date;
  }
}
