import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/line_chart.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/transformation.dart';
import '../../shared/utils/localization.dart';
import 'progress_repository.dart';

enum _RangePreset { d30, d90, m6, all }

/// Body-transformation tracker: metric charts (weight, measurements, ...)
/// extracted from check-in answers, progress photos with a first/latest
/// compare, and a submission timeline. This IS the Home tab's content — the
/// web client portal's `/portal/home` is exclusively this `ProgressSection`,
/// so mobile's Home mirrors that 1:1 instead of hiding it behind another
/// screen. No Scaffold/AppBar here; [HomePage] provides those (the shell
/// already renders the top bar).
class ProgressDashboardBody extends ConsumerStatefulWidget {
  const ProgressDashboardBody({super.key});

  @override
  ConsumerState<ProgressDashboardBody> createState() =>
      _ProgressDashboardBodyState();
}

class _ProgressDashboardBodyState extends ConsumerState<ProgressDashboardBody> {
  _RangePreset _preset = _RangePreset.d90;

  DateTime? get _rangeStart {
    final now = DateTime.now();
    return switch (_preset) {
      _RangePreset.d30 => now.subtract(const Duration(days: 30)),
      _RangePreset.d90 => now.subtract(const Duration(days: 90)),
      _RangePreset.m6 => now.subtract(const Duration(days: 182)),
      _RangePreset.all => null,
    };
  }

  List<MetricHistoryPoint> _inRange(List<MetricHistoryPoint> points) {
    final start = _rangeStart;
    if (start == null) return points;
    return points.where((p) {
      final d = DateTime.tryParse(p.date);
      return d != null && d.isAfter(start);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final data = ref.watch(transformationProvider);

    return AsyncValueWidget<TransformationPayload>(
      value: data,
      onRetry: () => ref.invalidate(transformationProvider),
      data: (payload) {
        if (payload.metrics.isEmpty && payload.timeline.isEmpty) {
          return EmptyState(
            icon: Icons.trending_up,
            title: l10n.progressEmptyTitle,
            hint: l10n.progressEmptyHint,
          );
        }

        final numeric = payload.metrics.where((m) => !m.isImage).toList();
        final images = payload.metrics.where((m) => m.isImage).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _RangePicker(
              preset: _preset,
              onChanged: (p) => setState(() => _preset = p),
            ),
            const SizedBox(height: 16),
            for (final m in numeric) ...[
              _NumericMetricCard(metric: m, points: _inRange(m.history)),
              const SizedBox(height: 12),
            ],
            for (final m in images) ...[
              _PhotoMetricCard(metric: m, points: _inRange(m.history)),
              const SizedBox(height: 12),
            ],
            if (payload.timeline.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(l10n.progressTimeline,
                  style:
                      const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              for (final s in payload.timeline) _TimelineEntry(submission: s),
            ],
          ],
        );
      },
    );
  }
}

class _RangePicker extends StatelessWidget {
  const _RangePicker({required this.preset, required this.onChanged});

  final _RangePreset preset;
  final ValueChanged<_RangePreset> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final labels = {
      _RangePreset.d30: l10n.progressRange30d,
      _RangePreset.d90: l10n.progressRange90d,
      _RangePreset.m6: l10n.progressRange6m,
      _RangePreset.all: l10n.progressRangeAll,
    };
    return Row(
      children: [
        for (final p in _RangePreset.values)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: GestureDetector(
                onTap: () => onChanged(p),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: preset == p
                        ? Theme.of(context).colorScheme.primary
                        : context.appColors.secondary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    labels[p]!,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: preset == p
                          ? Theme.of(context).colorScheme.onPrimary
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

class _NumericMetricCard extends StatelessWidget {
  const _NumericMetricCard({required this.metric, required this.points});

  final TransformationMetric metric;
  final List<MetricHistoryPoint> points;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final values = [
      for (final p in points) double.tryParse(p.value) ?? 0,
    ];
    final current = values.isNotEmpty ? values.last : null;
    final start = values.isNotEmpty ? values.first : null;
    final delta =
        (current != null && start != null) ? current - start : null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(metric.name,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                ),
                if (current != null)
                  Text('${_fmt(current)} ${metric.unit ?? ''}',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.bold)),
              ],
            ),
            if (delta != null)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  '${delta >= 0 ? '+' : ''}${_fmt(delta)} ${metric.unit ?? ''} · ${l10n.progressReadings(points.length)}',
                  style: TextStyle(fontSize: 11, color: muted),
                ),
              ),
            const SizedBox(height: 8),
            if (points.isEmpty)
              SizedBox(
                height: 120,
                child: Center(
                  child: Text(l10n.progressNoDataInRange,
                      style: TextStyle(fontSize: 12, color: muted)),
                ),
              )
            else
              LineChart(
                height: 140,
                data: [
                  for (final p in points)
                    ChartPoint(_dateLabel(context, p.date),
                        double.tryParse(p.value) ?? 0),
                ],
              ),
          ],
        ),
      ),
    );
  }

  static String _fmt(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);

  static String _dateLabel(BuildContext context, String date) {
    final d = DateTime.tryParse(date);
    final locale = Localizations.localeOf(context).toString();
    return d != null ? DateFormat.MMMd(locale).format(d) : date;
  }
}

class _PhotoMetricCard extends StatelessWidget {
  const _PhotoMetricCard({required this.metric, required this.points});

  final TransformationMetric metric;
  final List<MetricHistoryPoint> points;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(metric.name,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                ),
                if (points.length >= 2)
                  TextButton(
                    onPressed: () => _showCompare(context, points),
                    child: Text(l10n.progressCompare),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (points.isEmpty)
              Text(l10n.progressNoDataInRange,
                  style: TextStyle(fontSize: 12, color: muted))
            else
              SizedBox(
                height: 96,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: points.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, i) => GestureDetector(
                    onTap: () => _showFullscreen(context, points, i),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.network(
                        points[i].value,
                        width: 96,
                        height: 96,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 96,
                          height: 96,
                          color: context.appColors.secondary,
                          child: const Icon(Icons.broken_image_outlined),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showFullscreen(
      BuildContext context, List<MetricHistoryPoint> points, int index) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => _PhotoViewer(points: points, initialIndex: index),
    ));
  }

  void _showCompare(BuildContext context, List<MetricHistoryPoint> points) {
    final l10n = AppLocalizations.of(context);
    showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(l10n.progressCompare,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _comparePane(points.first)),
                  const SizedBox(width: 6),
                  Expanded(child: _comparePane(points.last)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _comparePane(MetricHistoryPoint p) {
    return AspectRatio(
      aspectRatio: 3 / 4,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(p.value, fit: BoxFit.cover),
      ),
    );
  }
}

class _PhotoViewer extends StatelessWidget {
  const _PhotoViewer({required this.points, required this.initialIndex});

  final List<MetricHistoryPoint> points;
  final int initialIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: PageView.builder(
        controller: PageController(initialPage: initialIndex),
        itemCount: points.length,
        itemBuilder: (context, i) => InteractiveViewer(
          child: Center(child: Image.network(points[i].value)),
        ),
      ),
    );
  }
}

class _TimelineEntry extends StatelessWidget {
  const _TimelineEntry({required this.submission});

  final TransformationSubmission submission;

  @override
  Widget build(BuildContext context) {
    final locale = Localizations.localeOf(context);
    final title = localizedField(
      base: submission.formTitle,
      arabic: submission.formTitleAr,
      localeCode: locale.languageCode,
    );
    final d = DateTime.tryParse(submission.submittedAt ?? '');
    final dateLabel =
        d != null ? DateFormat.yMMMd(locale.toString()).format(d) : '';

    return Card(
      child: ExpansionTile(
        title: Text(title, style: const TextStyle(fontSize: 13)),
        subtitle: Text(dateLabel,
            style:
                TextStyle(fontSize: 11, color: context.appColors.mutedForeground)),
        children: [
          for (final a in submission.answers)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      localizedField(
                        base: a.label,
                        arabic: a.labelAr,
                        localeCode: locale.languageCode,
                      ),
                      style: TextStyle(
                          fontSize: 12,
                          color: context.appColors.mutedForeground),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: a.metricType == metricTypeImage
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: Image.network(a.answer,
                                height: 48, fit: BoxFit.cover),
                          )
                        : Text(a.answer,
                            textAlign: TextAlign.end,
                            style: const TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
