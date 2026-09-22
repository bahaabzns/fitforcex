import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/training/widgets/exercise_log_card.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/workout_log.dart';
import 'package:fitforce_x/shared/models/workout_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

// ExerciseLogCard's Instructions icon carries a NewFeatureHint (Riverpod
// state under the hood, for the "seen this hint before?" flag) even when
// dormant, so — like the app's real root — this needs a ProviderScope.
Widget _wrap(Widget child, {Locale locale = const Locale('en')}) => ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light,
        locale: locale,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('ar')],
        home: Scaffold(body: child),
      ),
    );

SessionExercise _exercise({String? instructionsEn, String? instructionsAr}) =>
    SessionExercise(
      exerciseId: 'ex-1',
      name: 'Bench Press',
      instructionsEn: instructionsEn,
      instructionsAr: instructionsAr,
      sets: const [SessionSet(setOrder: 1)],
    );

Widget _card(SessionExercise exercise) => ExerciseLogCard(
      exercise: exercise,
      previous: const <PreviousSet>[],
      videoUrl: null,
      onChangeSet: (_, __, ___) {},
      onToggleSet: (_) {},
      onChangeNote: (_) {},
    );

void main() {
  testWidgets(
      'tapping Coach Note opens a sheet showing the English instructions',
      (tester) async {
    await tester.pumpWidget(_wrap(_card(_exercise(
      instructionsEn: 'Keep your elbows tucked and drive through your feet.',
      instructionsAr: 'أبقِ مرفقيك للداخل وادفع من خلال قدميك.',
    ))));

    await tester.tap(find.byIcon(Icons.menu_book_outlined));
    await tester.pumpAndSettle();

    expect(find.text('Coach Note'), findsOneWidget);
    expect(find.text('Coach Instructions'), findsOneWidget);
    expect(
      find.text('Keep your elbows tucked and drive through your feet.'),
      findsOneWidget,
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Close'));
    await tester.pumpAndSettle();
    expect(find.text('Coach Note'), findsNothing);
  });

  testWidgets('under Arabic locale, the Arabic instructions are shown',
      (tester) async {
    await tester.pumpWidget(_wrap(
      _card(_exercise(
        instructionsEn: 'Keep your elbows tucked.',
        instructionsAr: 'أبقِ مرفقيك للداخل.',
      )),
      locale: const Locale('ar'),
    ));

    await tester.tap(find.byIcon(Icons.menu_book_outlined));
    await tester.pumpAndSettle();

    expect(find.text('أبقِ مرفقيك للداخل.'), findsOneWidget);
    expect(find.text('Keep your elbows tucked.'), findsNothing);
  });

  testWidgets(
      'falls back to the English instructions under Arabic locale when no Arabic translation exists',
      (tester) async {
    await tester.pumpWidget(_wrap(
      _card(_exercise(instructionsEn: 'English only note.')),
      locale: const Locale('ar'),
    ));

    await tester.tap(find.byIcon(Icons.menu_book_outlined));
    await tester.pumpAndSettle();

    expect(find.text('English only note.'), findsOneWidget);
  });

  testWidgets('shows a friendly empty state instead of a blank sheet',
      (tester) async {
    await tester.pumpWidget(_wrap(_card(_exercise())));

    await tester.tap(find.byIcon(Icons.menu_book_outlined));
    await tester.pumpAndSettle();

    expect(find.text('Coach Note'), findsOneWidget);
    expect(
      find.text('No coaching note available for this exercise.'),
      findsOneWidget,
    );
    expect(find.text('Coach Instructions'), findsNothing);
  });

  testWidgets('a long note renders inside a scrollable without overflowing',
      (tester) async {
    final longNote = List.generate(
      80,
      (i) => 'Coaching line number $i with some extra detail to add length.',
    ).join('\n');

    await tester.pumpWidget(_wrap(_card(_exercise(instructionsEn: longNote))));

    await tester.tap(find.byIcon(Icons.menu_book_outlined));
    await tester.pumpAndSettle();

    expect(find.text('Coach Instructions'), findsOneWidget);
    expect(find.byType(ListView), findsOneWidget);

    // No RenderFlex overflow / layout exceptions were thrown by the pump
    // above — that's the meaningful assertion for "long notes scroll
    // correctly" in a widget test.
    expect(tester.takeException(), isNull);
  });
}
