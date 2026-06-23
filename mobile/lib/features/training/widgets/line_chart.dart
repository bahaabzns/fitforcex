import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class ChartPoint {
  const ChartPoint(this.label, this.value);
  final String label;
  final double value;
}

/// Dependency-free responsive line chart for workout progress — a CustomPainter
/// port of the web `LineChart` (gridlines, y labels, line, dots, x labels).
/// Always LTR (time flows left→right) even in RTL layouts.
class LineChart extends StatelessWidget {
  const LineChart(
      {super.key, required this.data, this.valueLabel = '', this.height = 220});

  final List<ChartPoint> data;
  final String valueLabel;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text('—',
              style: TextStyle(color: context.appColors.mutedForeground)),
        ),
      );
    }
    return Directionality(
      textDirection: TextDirection.ltr,
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(
          painter: _LineChartPainter(
            data: data,
            line: Theme.of(context).colorScheme.primary,
            grid: context.appColors.border,
            label: context.appColors.mutedForeground,
          ),
        ),
      ),
    );
  }
}

class _LineChartPainter extends CustomPainter {
  _LineChartPainter({
    required this.data,
    required this.line,
    required this.grid,
    required this.label,
  });

  final List<ChartPoint> data;
  final Color line;
  final Color grid;
  final Color label;

  static const _padTop = 16.0;
  static const _padRight = 16.0;
  static const _padBottom = 28.0;
  static const _padLeft = 40.0;
  static const _yTicks = 4;

  @override
  void paint(Canvas canvas, Size size) {
    final innerW = (size.width - _padLeft - _padRight).clamp(0.0, size.width);
    final innerH = size.height - _padTop - _padBottom;

    final values = data.map((p) => p.value).toList();
    final rawMax = values.reduce((a, b) => a > b ? a : b);
    final rawMin = values.reduce((a, b) => a < b ? a : b);
    final span = (rawMax - rawMin) == 0
        ? (rawMax.abs() == 0 ? 1.0 : rawMax.abs())
        : rawMax - rawMin;
    final yMax = rawMax + span * 0.1;
    final yMin = (rawMin - span * 0.1) < 0 ? 0.0 : rawMin - span * 0.1;

    double xFor(int i) => data.length == 1
        ? _padLeft + innerW / 2
        : _padLeft + innerW * i / (data.length - 1);
    double yFor(double v) =>
        _padTop +
        innerH * (1 - (v - yMin) / ((yMax - yMin) == 0 ? 1 : (yMax - yMin)));

    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    final textStyle = TextStyle(fontSize: 10, color: label);

    // Horizontal gridlines + y labels
    for (var i = 0; i <= _yTicks; i++) {
      final v = yMin + (yMax - yMin) * i / _yTicks;
      final y = yFor(v);
      canvas.drawLine(
          Offset(_padLeft, y), Offset(size.width - _padRight, y), gridPaint);
      _text(canvas, (((v * 10).round()) / 10).toString(),
          Offset(_padLeft - 6, y), textStyle,
          alignRight: true);
    }

    // Line
    final linePaint = Paint()
      ..color = line
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    final path = Path();
    for (var i = 0; i < data.length; i++) {
      final o = Offset(xFor(i), yFor(data[i].value));
      if (i == 0) {
        path.moveTo(o.dx, o.dy);
      } else {
        path.lineTo(o.dx, o.dy);
      }
    }
    canvas.drawPath(path, linePaint);

    // Dots + x labels
    final dotPaint = Paint()..color = line;
    final xLabelStep = (data.length / 6).ceil().clamp(1, data.length);
    for (var i = 0; i < data.length; i++) {
      canvas.drawCircle(Offset(xFor(i), yFor(data[i].value)), 2.5, dotPaint);
      if (i % xLabelStep == 0 || i == data.length - 1) {
        _text(
            canvas, data[i].label, Offset(xFor(i), size.height - 8), textStyle,
            center: true);
      }
    }
  }

  void _text(Canvas canvas, String text, Offset at, TextStyle style,
      {bool alignRight = false, bool center = false}) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
    )..layout();
    var dx = at.dx;
    if (alignRight) dx = at.dx - tp.width;
    if (center) dx = at.dx - tp.width / 2;
    final dy = center ? at.dy : at.dy - tp.height / 2;
    tp.paint(canvas, Offset(dx, dy));
  }

  @override
  bool shouldRepaint(_LineChartPainter old) =>
      old.data != data || old.line != line;
}
