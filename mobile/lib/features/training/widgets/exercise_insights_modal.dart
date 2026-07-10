import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/line_chart.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/models/exercise_insights.dart';
import '../workout_repository.dart';

enum _Metric { topWeight, est1rm, totalVolume }

/// Personal records, recent sessions and a metric-toggle chart for one
/// exercise, opened from the logging card during a Training Mode session.
/// Port of the web `ClientExerciseInsightsModal` — deliberately shows only
/// PRs/recent-sessions/chart, not the coach-only strength-trend/plateau block
/// the same endpoint also returns (the web client doesn't render that either).
class ExerciseInsightsModal extends ConsumerStatefulWidget {
  const ExerciseInsightsModal({
    super.key,
    required this.exerciseLibraryId,
    required this.exerciseId,
    required this.exerciseName,
  });

  final String? exerciseLibraryId;
  final String exerciseId;
  final String exerciseName;

  @override
  ConsumerState<ExerciseInsightsModal> createState() =>
      _ExerciseInsightsModalState();
}

class _ExerciseInsightsModalState extends ConsumerState<ExerciseInsightsModal> {
  _Metric _metric = _Metric.topWeight;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final insights = ref.watch(exerciseInsightsProvider(
      (libraryId: widget.exerciseLibraryId, exerciseId: widget.exerciseId),
    ));

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.exerciseName,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Expanded(
            child: insights.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (_, __) => Center(child: Text(l10n.trainingInsightsLoadError)),
              data: (data) {
                if (data.progressPoints.isEmpty &&
                    data.recentSessions.isEmpty) {
                  return Center(
                    child: Text(l10n.trainingNoLogsForExercise,
                        style: TextStyle(
                            color: context.appColors.mutedForeground)),
                  );
                }
                return ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  children: [
                    _MetricToggle(
                      metric: _metric,
                      onChanged: (m) => setState(() => _metric = m),
                    ),
                    const SizedBox(height: 12),
                    LineChart(
                      data: [
                        for (final p in data.progressPoints)
                          ChartPoint(_dateLabel(context, p.date), _value(p)),
                      ],
                    ),
                    if (data.personalRecords != null) ...[
                      const SizedBox(height: 20),
                      Text(l10n.trainingInsightsPersonalRecords,
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      _PrGrid(records: data.personalRecords!),
                    ],
                    if (data.recentSessions.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Text(l10n.trainingInsightsRecentSessions,
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      for (final s in data.recentSessions)
                        _SessionRow(session: s),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  double _value(InsightProgressPoint p) => switch (_metric) {
        _Metric.topWeight => p.topWeight,
        _Metric.est1rm => p.est1rm,
        _Metric.totalVolume => p.totalVolume,
      };

  String _dateLabel(BuildContext context, String date) {
    final d = DateTime.tryParse(date);
    final locale = Localizations.localeOf(context).toString();
    return d != null ? DateFormat.MMMd(locale).format(d) : date;
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

class _PrGrid extends StatelessWidget {
  const _PrGrid({required this.records});

  final PersonalRecords records;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final items = <(String, String)>[
      if (records.heaviestWeight != null)
        (l10n.trainingInsightsHeaviestWeight,
            '${_fmt(records.heaviestWeight!.value)} kg'),
      if (records.bestSet != null)
        (
          l10n.trainingInsightsBestSet,
          '${_fmt(records.bestSet!.weight ?? 0)}×${_fmt(records.bestSet!.reps ?? 0)}'
          '${records.bestSet!.rir != null ? ' @${_fmt(records.bestSet!.rir!)} RIR' : ''}',
        ),
      if (records.highestVolume != null)
        (l10n.trainingInsightsHighestVolume,
            '${_fmt(records.highestVolume!.value)} kg'),
      if (records.est1rm != null)
        (l10n.trainingInsightsEst1Rm, '${_fmt(records.est1rm!.value)} kg'),
    ];
    if (items.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (label, value) in items)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: context.appColors.secondary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontSize: 10, color: context.appColors.mutedForeground)),
                Text(value,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
      ],
    );
  }

  static String _fmt(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);
}

class _SessionRow extends StatelessWidget {
  const _SessionRow({required this.session});

  final RecentSession session;

  @override
  Widget build(BuildContext context) {
    final muted = context.appColors.mutedForeground;
    final d = DateTime.tryParse(session.date);
    final locale = Localizations.localeOf(context).toString();
    final dateLabel = d != null ? DateFormat.yMMMd(locale).format(d) : session.date;
    final best = session.bestSet;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
              width: 90,
              child: Text(dateLabel,
                  style: TextStyle(fontSize: 12, color: muted))),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (best != null)
                  Text(
                    '${_PrGrid._fmt(best.weight ?? 0)}×${_PrGrid._fmt(best.reps ?? 0)}'
                    '${best.rir != null ? ' @${_PrGrid._fmt(best.rir!)} RIR' : ''}',
                    style: const TextStyle(fontSize: 13),
                  ),
                if ((session.note ?? '').isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(session.note!,
                        style: TextStyle(
                            fontSize: 12,
                            fontStyle: FontStyle.italic,
                            color: muted)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
