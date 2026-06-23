import 'package:fitforce_x/shared/models/workout_session.dart';
import 'package:fitforce_x/shared/utils/workout.dart';
import 'package:flutter_test/flutter_test.dart';

SessionExercise _ex(List<SessionSet> sets) =>
    SessionExercise(exerciseId: 'e', sets: sets);

void main() {
  group('toNumber', () {
    test('parses numeric text, null for blank/invalid', () {
      expect(toNumber('42.5'), 42.5);
      expect(toNumber('  10 '), 10);
      expect(toNumber(''), isNull);
      expect(toNumber('abc'), isNull);
    });
  });

  group('estimatedOneRepMax', () {
    test('Epley formula rounded to 1 decimal', () {
      expect(estimatedOneRepMax(100, 10), 133.3); // 100*(1+10/30)=133.33
    });
    test('0 when not computable', () {
      expect(estimatedOneRepMax(null, 5), 0);
      expect(estimatedOneRepMax(100, 0), 0);
    });
  });

  group('totalVolume / completedSetCount', () {
    test('only counts completed sets with weight and reps', () {
      final exercises = [
        _ex([
          const SessionSet(
              setOrder: 1, weight: '100', reps: '10', completed: true),
          const SessionSet(
              setOrder: 2, weight: '80', reps: '8', completed: false),
          const SessionSet(setOrder: 3, weight: '', reps: '5', completed: true),
        ]),
      ];
      expect(totalVolume(exercises), 1000); // only the first set
      expect(completedSetCount(exercises), 2);
    });
  });

  group('formatDuration', () {
    test('formats hours, minutes, seconds', () {
      expect(formatDuration(3900), '1h 05m');
      expect(formatDuration(125), '2m 05s');
      expect(formatDuration(42), '42s');
      expect(formatDuration(null), '—');
    });
  });

  group('formatClock', () {
    test('MM:SS, clamps negatives', () {
      expect(formatClock(75), '1:15');
      expect(formatClock(5), '0:05');
      expect(formatClock(-3), '0:00');
    });
  });
}
