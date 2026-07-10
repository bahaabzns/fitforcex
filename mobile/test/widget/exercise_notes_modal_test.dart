import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/training/widgets/exercise_log_card.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/workout_log.dart';
import 'package:fitforce_x/shared/models/workout_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: Scaffold(body: child),
    );

SessionExercise _exercise({String note = ''}) => SessionExercise(
      exerciseId: 'ex-1',
      name: 'Bench Press',
      note: note,
      sets: const [SessionSet(setOrder: 1)],
    );

/// The note sheet's own field, scoped away from the card's per-set
/// weight/reps inputs (which stay mounted underneath the sheet).
final _noteField = find.byWidgetPredicate((w) => w is TextField && w.maxLines == 10);

void main() {
  testWidgets(
      'tapping the note icon opens a bottom sheet with title, field and actions visible',
      (tester) async {
    String? saved;
    await tester.pumpWidget(_wrap(ExerciseLogCard(
      exercise: _exercise(),
      previous: const <PreviousSet>[],
      videoUrl: null,
      onChangeSet: (_, __, ___) {},
      onToggleSet: (_) {},
      onChangeNote: (value) => saved = value,
    )));

    await tester.tap(find.byIcon(Icons.edit_note));
    await tester.pumpAndSettle();

    expect(find.text('Exercise Notes'), findsOneWidget);
    expect(_noteField, findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Cancel'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Save'), findsOneWidget);

    await tester.enterText(_noteField, 'Felt heavy today');
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();

    expect(saved, 'Felt heavy today');
    expect(find.text('Exercise Notes'), findsNothing);
  });

  testWidgets('reopening the modal shows the previously saved note',
      (tester) async {
    await tester.pumpWidget(_wrap(ExerciseLogCard(
      exercise: _exercise(note: 'Previous note text'),
      previous: const <PreviousSet>[],
      videoUrl: null,
      onChangeSet: (_, __, ___) {},
      onToggleSet: (_) {},
      onChangeNote: (_) {},
    )));

    await tester.tap(find.byIcon(Icons.edit_note));
    await tester.pumpAndSettle();

    expect(find.text('Previous note text'), findsOneWidget);
  });

  testWidgets('cancel discards the draft and does not call onChangeNote',
      (tester) async {
    var called = false;
    await tester.pumpWidget(_wrap(ExerciseLogCard(
      exercise: _exercise(),
      previous: const <PreviousSet>[],
      videoUrl: null,
      onChangeSet: (_, __, ___) {},
      onToggleSet: (_) {},
      onChangeNote: (_) => called = true,
    )));

    await tester.tap(find.byIcon(Icons.edit_note));
    await tester.pumpAndSettle();

    await tester.enterText(_noteField, 'Discard me');
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();

    expect(called, isFalse);
    expect(find.text('Exercise Notes'), findsNothing);
  });

  testWidgets(
      'keyboard opening on a small device keeps the field and Save button above it',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);

    // A small Android phone (e.g. a 5" 360x640 device) in logical pixels.
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(_wrap(ExerciseLogCard(
      exercise: _exercise(),
      previous: const <PreviousSet>[],
      videoUrl: null,
      onChangeSet: (_, __, ___) {},
      onToggleSet: (_) {},
      onChangeNote: (_) {},
    )));

    await tester.tap(find.byIcon(Icons.edit_note));
    await tester.pumpAndSettle();

    // Simulate the on-screen keyboard opening and the sheet's
    // AnimatedPadding tracking it to completion.
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    await tester.pumpAndSettle();

    final screenBottom = tester.view.physicalSize.height /
        tester.view.devicePixelRatio;
    final keyboardTop = screenBottom - 300;

    final fieldRect = tester.getRect(_noteField);
    final saveRect =
        tester.getRect(find.widgetWithText(FilledButton, 'Save'));

    expect(fieldRect.bottom, lessThanOrEqualTo(keyboardTop));
    expect(saveRect.bottom, lessThanOrEqualTo(keyboardTop));

    // Keyboard closes — the sheet settles back to its resting position.
    tester.view.viewInsets = FakeViewPadding.zero;
    await tester.pumpAndSettle();

    expect(find.text('Exercise Notes'), findsOneWidget);
  });
}
