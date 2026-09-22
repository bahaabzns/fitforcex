import 'package:fitforce_x/shared/utils/exercise_tracking_types.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('categoryOf', () {
    test('returns the given category when valid', () {
      expect(categoryOf('time_based'), 'time_based');
    });
    test('falls back to sets_reps for null/unknown', () {
      expect(categoryOf(null), 'sets_reps');
      expect(categoryOf('bogus'), 'sets_reps');
    });
  });

  group('trackedMetricsOf', () {
    test('filters to only the category\'s selectable metrics, in order', () {
      expect(
        trackedMetricsOf('sets_reps', ['rir', 'rpe', 'distance_km']),
        ['rir', 'rpe'],
      );
    });
    test('null trackedMetrics yields an empty list', () {
      expect(trackedMetricsOf('sets_reps', null), isEmpty);
    });
  });

  group('prescribedFieldsFor — sets_reps', () {
    test('always includes reps + rest_seconds even with no metrics', () {
      expect(prescribedFieldsFor('sets_reps', []),
          ['reps', 'rest_seconds']);
    });
    test('adds selected metrics in canonical order', () {
      expect(
        prescribedFieldsFor('sets_reps', ['rpe', 'tempo']),
        ['reps', 'rest_seconds', 'tempo', 'rpe'],
      );
    });
  });

  group('prescribedFieldsFor — time_based', () {
    test('always includes rest_seconds even with no metrics', () {
      expect(prescribedFieldsFor('time_based', []), ['rest_seconds']);
    });
    test('adds selected metrics in canonical order', () {
      expect(
        prescribedFieldsFor('time_based', ['speed_kmh', 'duration_seconds']),
        ['duration_seconds', 'speed_kmh', 'rest_seconds'],
      );
    });
  });

  group('loggedFieldsFor', () {
    test('sets_reps is always just weight + reps, metrics never loggable', () {
      expect(loggedFieldsFor('sets_reps', ['tempo', 'rir', 'rpe']),
          ['weight', 'reps']);
    });
    test('time_based has no base fields, only selected metrics', () {
      expect(loggedFieldsFor('time_based', []), isEmpty);
      expect(
        loggedFieldsFor('time_based', ['distance_km', 'duration_seconds']),
        ['duration_seconds', 'distance_km'],
      );
    });
  });

  group('targetOnlyFieldsFor', () {
    test('sets_reps: prescribed but not loggable (tempo/rir/rpe), never reps', () {
      expect(
        targetOnlyFieldsFor('sets_reps', ['tempo', 'rir', 'rpe']),
        ['rest_seconds', 'tempo', 'rir', 'rpe'],
      );
    });
    test('time_based: selected metrics are loggable, so no targets beyond rest', () {
      expect(
        targetOnlyFieldsFor('time_based', ['distance_km', 'speed_kmh']),
        ['rest_seconds'],
      );
    });
  });
}
