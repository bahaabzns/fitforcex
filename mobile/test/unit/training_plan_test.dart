import 'package:fitforce_x/shared/models/training_plan.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('TrainingPlan.fromJson', () {
    test('parses the nested plan hierarchy with snake_case keys', () {
      final plan = TrainingPlan.fromJson(const {
        'id': 'p1',
        'name': 'Hypertrophy',
        'notes': 'Push hard',
        'days': [
          {
            'id': 'd1',
            'name': 'Day A',
            'day_order': 0,
            'notes': 'Chest focus',
            'exercises': [
              {
                'id': 'e1',
                'name': 'Bench Press',
                'exercise_order': 0,
                'muscle_group': 'Chest',
                'equipment': 'Barbell',
                'thumbnail_path': '/uploads/bench.png',
                'youtube_url': 'https://youtu.be/abc',
                'sets': [
                  {
                    'id': 's1',
                    'set_order': 0,
                    'reps': '8-12',
                    'rest_seconds': 90,
                    'rir': 2
                  },
                  {'id': 's2', 'set_order': 1, 'reps': 10, 'rest_seconds': 60},
                ],
                'alternatives': [
                  {
                    'id': 'a1',
                    'alt_order': 0,
                    'name_en': 'Dumbbell Press',
                    'name_ar': 'ضغط دمبل'
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(plan.name, 'Hypertrophy');
      final ex = plan.days.single.exercises.single;
      expect(ex.name, 'Bench Press');
      expect(ex.muscleGroup, 'Chest');
      expect(ex.sets.length, 2);
      // reps coerces a numeric value to a string.
      expect(ex.sets[1].reps, '10');
      expect(ex.sets[0].restSeconds, 90);
      expect(ex.alternatives.single.nameAr, 'ضغط دمبل');
    });

    test('defaults collections to empty when absent', () {
      final plan = TrainingPlan.fromJson(const {'id': 'p1'});
      expect(plan.days, isEmpty);
      expect(plan.name, '');
    });
  });
}
