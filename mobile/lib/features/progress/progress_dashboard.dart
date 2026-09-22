import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/line_chart.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/transformation.dart';
import 'progress_repository.dart';

enum _RangePreset { d30, d90, m6, all }

/// Body-transformation tracker: metric charts (weight, measurements, ...)
/// extracted from check-in answers, and progress photos with a first/latest
/// compare. (The submission timeline that used to live here was removed to
/// match web — full submission history now lives in the Forms > Submitted
/// tab instead, avoiding the duplication.) This IS the Home tab's content —
/// the web client portal's `/portal/home` is exclusively this `ProgressSection`,
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
        if (payload.metrics.isEmpty) {
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
      builder: (dialogContext) => Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(l10n.progressCompare,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              _ComparisonSlider(before: points.first, after: points.last),
              const SizedBox(height: 6),
              Text(
                l10n.progressCompareDrag,
                style: TextStyle(
                    fontSize: 10, color: dialogContext.appColors.mutedForeground),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One overlapping image with a draggable vertical divider that reveals
/// [before] on the left and [after] on the right — port of web's
/// `ComparisonSlider` (client-portal home page). Mobile's compare used to
/// show the two photos side by side instead of split like this.
class _ComparisonSlider extends StatefulWidget {
  const _ComparisonSlider({required this.before, required this.after});

  final MetricHistoryPoint before;
  final MetricHistoryPoint after;

  @override
  State<_ComparisonSlider> createState() => _ComparisonSliderState();
}

class _ComparisonSliderState extends State<_ComparisonSlider> {
  // Percent (0-100) of the container width where the divider sits.
  double _position = 50;

  void _updatePosition(Offset globalPosition, RenderBox box) {
    final local = box.globalToLocal(globalPosition);
    setState(() {
      _position = (local.dx / box.size.width * 100).clamp(2, 98);
    });
  }

  Widget _photo(String url) => Image.network(
        url,
        fit: BoxFit.cover,
        errorBuilder: (context, _, __) => Container(
          color: context.appColors.secondary,
          child: const Center(child: Icon(Icons.broken_image_outlined)),
        ),
      );

  Widget _cornerLabel(BuildContext context, String text, {required bool primary}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: primary
              ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.8)
              : Colors.black.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.4,
          ),
        ),
      );

  Widget _dateLabel(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(text,
            style: const TextStyle(
                color: Colors.white, fontSize: 9, fontWeight: FontWeight.w600)),
      );

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final beforeDate = DateTime.tryParse(widget.before.date);
    final afterDate = DateTime.tryParse(widget.after.date);
    final beforeLabel =
        beforeDate != null ? DateFormat.yMMMd(locale).format(beforeDate) : widget.before.date;
    final afterLabel =
        afterDate != null ? DateFormat.yMMMd(locale).format(afterDate) : widget.after.date;

    return AspectRatio(
      aspectRatio: 3 / 4,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (d) => _updatePosition(
                  d.globalPosition, context.findRenderObject()! as RenderBox),
              onHorizontalDragUpdate: (d) => _updatePosition(
                  d.globalPosition, context.findRenderObject()! as RenderBox),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _photo(widget.after.value),
                  ClipRect(
                    clipper: _LeftFractionClipper(_position / 100),
                    child: _photo(widget.before.value),
                  ),
                  Positioned(
                    left: width * _position / 100 - 1,
                    top: 0,
                    bottom: 0,
                    child: Container(
                      width: 2,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        boxShadow: [
                          BoxShadow(
                              color: Colors.black.withValues(alpha: 0.6), blurRadius: 4),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: (width * _position / 100 - 16).clamp(0.0, width - 32),
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(color: Colors.black26, blurRadius: 6),
                          ],
                        ),
                        child: const Icon(Icons.compare_arrows,
                            size: 16, color: Colors.black54),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: _cornerLabel(context, l10n.progressCompareBefore, primary: false),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: _cornerLabel(context, l10n.progressCompareAfter, primary: true),
                  ),
                  Positioned(bottom: 8, left: 8, child: _dateLabel(beforeLabel)),
                  Positioned(bottom: 8, right: 8, child: _dateLabel(afterLabel)),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Clips to the left [fraction] (0.0-1.0) of the child's width — the "before"
/// image is full-size underneath but only this much of it is visible,
/// exactly like web's `clipPath: inset(0 (100-position)% 0 0)`.
class _LeftFractionClipper extends CustomClipper<Rect> {
  const _LeftFractionClipper(this.fraction);

  final double fraction;

  @override
  Rect getClip(Size size) => Rect.fromLTWH(0, 0, size.width * fraction, size.height);

  @override
  bool shouldReclip(covariant _LeftFractionClipper oldClipper) =>
      oldClipper.fraction != fraction;
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
