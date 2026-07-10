import 'package:fitforce_x/shared/models/exercise_insights.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ExerciseInsights.fromJson', () {
    test('parses progress points, recent sessions and personal records', () {
      final insights = ExerciseInsights.fromJson(const {
        'progressPoints': [
          {'date': '2026-01-01', 'top_weight': 80, 'est_1rm': 100, 'total_volume': 4000},
        ],
        'recentSessions': [
          {
            'date': '2026-01-01',
            'best_set': {'weight': 80, 'reps': 5, 'rir': 2},
            'note': 'Felt strong today',
          },
        ],
        'personalRecords': {
          'heaviest_weight': {'value': 85, 'date': '2025-12-20'},
          'best_set': {'weight': 80, 'reps': 5, 'rir': 2, 'date': '2026-01-01'},
          'highest_volume': {'value': 4200, 'date': '2025-12-28'},
          'est_1rm': {'value': 102.5, 'date': '2025-12-28'},
        },
        // The coach-only insights block is intentionally not modeled — the
        // web client doesn't render it either.
        'insights': {'strength_change_pct': 12},
      });

      expect(insights.progressPoints.single.topWeight, 80);
      expect(insights.recentSessions.single.note, 'Felt strong today');
      expect(insights.recentSessions.single.bestSet?.rir, 2);
      expect(insights.personalRecords?.heaviestWeight?.value, 85);
      expect(insights.personalRecords?.bestSet?.reps, 5);
    });

    test('tolerates a response with no logged data yet', () {
      final insights = ExerciseInsights.fromJson(const {
        'progressPoints': [],
        'recentSessions': [],
        'personalRecords': null,
      });
      expect(insights.progressPoints, isEmpty);
      expect(insights.recentSessions, isEmpty);
      expect(insights.personalRecords, isNull);
    });
  });
}
