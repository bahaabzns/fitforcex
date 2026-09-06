import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/core/widgets/new_feature_hint.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Regression coverage for the anchored-popover port of web's
/// `NewFeatureTooltip`. The mobile port originally shipped as a SnackBar
/// because an early Overlay/LayerLink attempt intercepted taps meant for
/// other controls, including the very control it was anchored to (see
/// `new_feature_hint.dart`'s doc comment and commit `f73765a`) — these tests
/// exist to catch that exact failure mode if it comes back.
Future<void> _pump(
  WidgetTester tester, {
  required Widget child,
  Alignment align = Alignment.center,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Align(alignment: align, child: child),
        ),
      ),
    ),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('renders the child even when the hint is inactive',
      (tester) async {
    await _pump(
      tester,
      child: const NewFeatureHint(
        featureKey: 'inactive_hint',
        active: false,
        message: 'msg',
        dismissLabel: 'Got it',
        badgeLabel: 'New',
        child: Text('Trigger'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Trigger'), findsOneWidget);
    expect(find.text('msg'), findsNothing);
  });

  testWidgets('shows the anchored bubble once active and unseen',
      (tester) async {
    await _pump(
      tester,
      child: const NewFeatureHint(
        featureKey: 'visible_hint',
        active: true,
        message: 'Here is a new thing',
        dismissLabel: 'Got it',
        badgeLabel: 'New',
        child: Text('Trigger'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Trigger'), findsOneWidget);
    expect(find.text('Here is a new thing'), findsOneWidget);
    expect(find.text('Got it'), findsOneWidget);
  });

  testWidgets(
      'tapping the anchored trigger still fires its own onTap while the hint is showing',
      (tester) async {
    var tapped = 0;
    await _pump(
      tester,
      align: Alignment.bottomCenter,
      child: NewFeatureHint(
        featureKey: 'resume_session_hint',
        active: true,
        message: 'Tap to resume where you left off',
        dismissLabel: 'Got it',
        badgeLabel: 'New',
        child: ElevatedButton(
          onPressed: () => tapped++,
          child: const Text('Continue'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The exact regression: the popover this widget spawns must never sit
    // between the user and the control it's pointing at.
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(tapped, 1);
  });

  testWidgets('does not intercept taps meant for an unrelated sibling control',
      (tester) async {
    var siblingTapped = 0;
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: Stack(
              children: [
                const Positioned(
                  top: 24,
                  left: 24,
                  child: NewFeatureHint(
                    featureKey: 'top_hint',
                    active: true,
                    message: 'A hint up here',
                    dismissLabel: 'Got it',
                    badgeLabel: 'New',
                    child: Text('Trigger'),
                  ),
                ),
                Positioned(
                  bottom: 24,
                  right: 24,
                  child: ElevatedButton(
                    onPressed: () => siblingTapped++,
                    child: const Text('Sibling'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Sibling'));
    await tester.pump();
    expect(siblingTapped, 1);
  });

  testWidgets('the dismiss button hides the bubble and persists the flag',
      (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: Center(
              child: NewFeatureHint(
                featureKey: 'dismiss_hint',
                active: true,
                message: 'Dismiss me',
                dismissLabel: 'Got it',
                badgeLabel: 'New',
                child: Text('Trigger'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Dismiss me'), findsOneWidget);

    await tester.tap(find.text('Got it'));
    await tester.pumpAndSettle();

    expect(find.text('Dismiss me'), findsNothing);
    expect(find.text('Trigger'), findsOneWidget);
    expect(container.read(featureHintSeenProvider('dismiss_hint')), isTrue);
  });

  testWidgets('a previously-dismissed hint never shows again', (tester) async {
    SharedPreferences.setMockInitialValues({
      'ff_seen_feature_hint_seen_already': true,
    });

    await _pump(
      tester,
      child: const NewFeatureHint(
        featureKey: 'seen_already',
        active: true,
        message: 'Should not appear',
        dismissLabel: 'Got it',
        badgeLabel: 'New',
        child: Text('Trigger'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Should not appear'), findsNothing);
  });

  testWidgets(
      'a target pinned to a screen corner, under a notch/status-bar inset, never overflows',
      (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          builder: (context, child) => MediaQuery(
            // Simulate a status bar / notch and a gesture nav bar — the
            // bubble must clamp to the space *inside* these, not the raw
            // screen edges.
            data: MediaQuery.of(context).copyWith(
              padding: const EdgeInsets.only(top: 40, bottom: 32),
            ),
            child: child!,
          ),
          home: const Scaffold(
            body: Stack(
              children: [
                Positioned(
                  top: 0,
                  right: 0,
                  child: NewFeatureHint(
                    featureKey: 'corner_hint',
                    active: true,
                    // A message long enough to need real height, right in
                    // the corner with the least room to give it.
                    message:
                        'This is a deliberately long hint message meant to '
                        'exercise the vertical clamp and internal scrolling '
                        'when a target sits right in a tight screen corner.',
                    dismissLabel: 'Got it',
                    badgeLabel: 'New',
                    child: SizedBox(width: 24, height: 24),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // A RenderFlex/box overflow throws during layout and is recorded here
    // rather than as a normal test failure — this is the actual assertion.
    expect(tester.takeException(), isNull);
  });
}
