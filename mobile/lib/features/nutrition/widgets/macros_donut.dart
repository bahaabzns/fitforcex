import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/utils/nutrition_calc.dart';

/// Segmented macro ring (carbs / fat / protein) with the calorie total in the
/// centre. Port of the web `MacrosDonut`; drawn with a [CustomPainter] so it
/// needs no chart dependency. Always laid out LTR like the web component.
class MacrosDonut extends StatelessWidget {
  const MacrosDonut({super.key, required this.totals, required this.labels});

  final Macros totals;
  final MacroLabels labels;

  static const _carbColor = Color(0xFF159BFF); // primary
  static const _fatColor = Color(0xFFF59E0B); // amber-500
  static const _proteinColor = Color(0xFFF97316); // orange-500

  @override
  Widget build(BuildContext context) {
    final carbCal = totals.carbs * 4;
    final fatCal = totals.fats * 9;
    final proteinCal = totals.protein * 4;
    final macroCal = carbCal + fatCal + proteinCal;
    final empty = macroCal == 0;

    final carbPct = empty ? 0 : (carbCal / macroCal * 100).round();
    final fatPct = empty ? 0 : (fatCal / macroCal * 100).round();
    final proteinPct = empty ? 0 : 100 - carbPct - fatPct;

    final muted = context.appColors.mutedForeground;

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Row(
        children: [
          SizedBox(
            width: 96,
            height: 96,
            child: CustomPaint(
              painter: _DonutPainter(
                carbPct: carbPct.toDouble(),
                fatPct: fatPct.toDouble(),
                proteinPct: proteinPct.toDouble(),
                trackColor: context.appColors.secondary,
                carbColor: _carbColor,
                fatColor: _fatColor,
                proteinColor: _proteinColor,
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${totals.calories.round()}',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      labels.kcal,
                      style: TextStyle(fontSize: 11, color: muted),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _column(labels.carbs, carbPct, totals.carbs.round(), _carbColor,
                    muted),
                _column(
                    labels.fat, fatPct, totals.fats.round(), _fatColor, muted),
                _column(labels.protein, proteinPct, totals.protein.round(),
                    _proteinColor, muted),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _column(String label, int pct, int grams, Color color, Color muted) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$pct%',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text.rich(
          TextSpan(
            text: '$grams',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            children: [
              TextSpan(
                text: 'g',
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.normal, color: muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 12, color: muted)),
      ],
    );
  }
}

class MacroLabels {
  const MacroLabels({
    required this.carbs,
    required this.fat,
    required this.protein,
    required this.kcal,
  });

  final String carbs;
  final String fat;
  final String protein;
  final String kcal;
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({
    required this.carbPct,
    required this.fatPct,
    required this.proteinPct,
    required this.trackColor,
    required this.carbColor,
    required this.fatColor,
    required this.proteinColor,
  });

  final double carbPct;
  final double fatPct;
  final double proteinPct;
  final Color trackColor;
  final Color carbColor;
  final Color fatColor;
  final Color proteinColor;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 7.0;
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - stroke) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = trackColor;
    canvas.drawCircle(center, radius, track);

    var startDeg = -90.0;
    void arc(double pct, Color color) {
      if (pct <= 0) return;
      final sweep = pct / 100 * 360;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = color;
      canvas.drawArc(
        rect,
        startDeg * math.pi / 180,
        sweep * math.pi / 180,
        false,
        paint,
      );
      startDeg += sweep;
    }

    arc(carbPct, carbColor);
    arc(fatPct, fatColor);
    arc(proteinPct, proteinColor);
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.carbPct != carbPct ||
      old.fatPct != fatPct ||
      old.proteinPct != proteinPct ||
      old.trackColor != trackColor;
}
