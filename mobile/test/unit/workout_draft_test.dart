import 'package:fitforce_x/features/training/workout_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('WorkoutDraft.fromJson', () {
    test('parses id, started_at, and per-exercise notes/sets', () {
      final draft = WorkoutDraft.fromJson({
        'id': 'draft-1',
        'started_at': '2026-08-01T10:00:00Z',
        'exercises': [
          {
            'exercise_id': 'ex-1',
            'note': 'felt strong',
            'sets': [
              {
                'set_order': 1,
                'weight': 80,
                'reps': 8,
                'rest_seconds': 90,
                'completed': true,
              },
              {'set_order': 2, 'weight': '82.5', 'reps': '6'},
            ],
          },
        ],
      });

      expect(draft, isNotNull);
      expect(draft!.id, 'draft-1');
      expect(draft.startedAt, '2026-08-01T10:00:00Z');
      final ex = draft.exercisesById['ex-1']!;
      expect(ex.note, 'felt strong');
      expect(ex.sets, hasLength(2));
      expect(ex.sets[0].weight, '80');
      expect(ex.sets[0].reps, '8');
      expect(ex.sets[0].restSeconds, 90);
      expect(ex.sets[0].completed, isTrue);
      expect(ex.sets[1].weight, '82.5');
      expect(ex.sets[1].completed, isFalse);
    });

    test('returns null for a null payload (no draft on the server)', () {
      expect(WorkoutDraft.fromJson(null), isNull);
    });

    test('defaults note to empty and sets to empty when absent', () {
      final draft = WorkoutDraft.fromJson({
        'id': 'draft-2',
        'exercises': [
          {'exercise_id': 'ex-1'},
        ],
      });

      final ex = draft!.exercisesById['ex-1']!;
      expect(ex.note, '');
      expect(ex.sets, isEmpty);
    });

    test('defaults started_at to now when absent', () {
      final before = DateTime.now().toUtc();
      final draft = WorkoutDraft.fromJson({
        'id': 'draft-3',
        'exercises': <Map<String, dynamic>>[],
      });
      final after = DateTime.now().toUtc();

      final parsed = DateTime.parse(draft!.startedAt);
      expect(parsed.isBefore(before.add(const Duration(seconds: 1))), isTrue);
      expect(parsed.isAfter(before.subtract(const Duration(seconds: 5))),
          isTrue);
      expect(parsed.isBefore(after.add(const Duration(seconds: 1))), isTrue);
    });

    test('exercisesById is empty when exercises is absent', () {
      final draft = WorkoutDraft.fromJson({'id': 'draft-4'});
      expect(draft!.exercisesById, isEmpty);
    });
  });
}
