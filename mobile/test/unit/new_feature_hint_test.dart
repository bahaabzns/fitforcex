import 'package:fitforce_x/core/widgets/new_feature_hint.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('FeatureHintSeenController', () {
    test('starts null (loading), resolves to false when never dismissed',
        () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(featureHintSeenProvider('demo_hint')), isNull);

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(container.read(featureHintSeenProvider('demo_hint')), isFalse);
    });

    test('dismiss() persists true, visible to a fresh container', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      // Read the plain provider first so build() (and its background load)
      // is actually running before dismiss() races against it.
      container.read(featureHintSeenProvider('demo_hint'));

      await container
          .read(featureHintSeenProvider('demo_hint').notifier)
          .dismiss();
      expect(container.read(featureHintSeenProvider('demo_hint')), isTrue);

      final fresh = ProviderContainer();
      addTearDown(fresh.dispose);
      fresh.read(featureHintSeenProvider('demo_hint'));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(fresh.read(featureHintSeenProvider('demo_hint')), isTrue);
    });

    test('a pre-seeded seen flag resolves true on first load', () async {
      SharedPreferences.setMockInitialValues({
        'ff_seen_feature_hint_demo_hint': true,
      });
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(featureHintSeenProvider('demo_hint'));

      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(container.read(featureHintSeenProvider('demo_hint')), isTrue);
    });

    test('different featureKeys are independent', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(featureHintSeenProvider('hint_b'));

      await container
          .read(featureHintSeenProvider('hint_a').notifier)
          .dismiss();

      expect(container.read(featureHintSeenProvider('hint_a')), isTrue);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(container.read(featureHintSeenProvider('hint_b')), isFalse);
    });
  });
}
