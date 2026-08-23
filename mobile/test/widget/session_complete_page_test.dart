import 'package:dio/dio.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/insights/insights_repository.dart';
import 'package:fitforce_x/features/training/session_complete_page.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/insight_prompt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _FakeInsightsRepository extends InsightsRepository {
  _FakeInsightsRepository({this.prompt}) : super(Dio());
  final InsightPrompt? prompt;
  final List<({String promptId, int? rating, String? text})> responses = [];

  @override
  Future<InsightPrompt?> fetchPostSessionPrompt() async => prompt;

  @override
  Future<void> respondToPrompt(
    String promptId, {
    int? ratingValue,
    String? selectedOption,
    String? textValue,
  }) async {
    responses.add((promptId: promptId, rating: ratingValue, text: textValue));
  }
}

Future<void> _pumpCompletePage(
  WidgetTester tester, {
  required _FakeInsightsRepository insightsRepo,
  String? dayName,
  int? durationSeconds,
  String? volume,
  int? sets,
}) async {
  final container = ProviderContainer(overrides: [
    insightsRepositoryProvider.overrideWithValue(insightsRepo),
  ]);
  addTearDown(container.dispose);

  final router = GoRouter(
    initialLocation: '/complete',
    routes: [
      GoRoute(
        path: '/complete',
        builder: (_, __) => SessionCompletePage(
          dayName: dayName,
          durationSeconds: durationSeconds,
          volume: volume,
          sets: sets,
        ),
      ),
      GoRoute(
        path: '/training',
        builder: (_, __) => const Scaffold(body: Text('training-tab')),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: AppTheme.light,
        routerConfig: router,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('ar')],
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows the celebration title, day name and stats',
      (tester) async {
    await _pumpCompletePage(
      tester,
      insightsRepo: _FakeInsightsRepository(),
      dayName: 'Push Day',
      durationSeconds: 3725,
      volume: '450.5',
      sets: 12,
    );

    expect(find.text('Workout Complete!'), findsOneWidget);
    expect(find.text('Push Day'), findsOneWidget);
    expect(find.text('1h 02m'), findsOneWidget);
    expect(find.text('450.5 kg'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
  });

  testWidgets('no rating section when there is no post-session prompt',
      (tester) async {
    await _pumpCompletePage(tester, insightsRepo: _FakeInsightsRepository());

    expect(find.byType(TextField), findsNothing);
    expect(find.byIcon(Icons.star_border), findsNothing);
  });

  testWidgets(
      'Send is disabled until a star is picked, then submits the rating and text',
      (tester) async {
    const prompt = InsightPrompt(
      id: 'prompt-1',
      questionEn: 'How was this session?',
      scaleMax: 5,
    );
    final insightsRepo = _FakeInsightsRepository(prompt: prompt);

    await _pumpCompletePage(tester, insightsRepo: insightsRepo);

    expect(find.text('How was this session?'), findsOneWidget);
    expect(find.byIcon(Icons.star_border), findsNWidgets(5));

    final sendButton =
        tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Send'));
    expect(sendButton.onPressed, isNull);

    await tester.enterText(find.byType(TextField), 'Felt great');
    await tester.tap(find.byIcon(Icons.star_border).at(3));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Send'));
    await tester.pumpAndSettle();

    expect(insightsRepo.responses.single.promptId, 'prompt-1');
    expect(insightsRepo.responses.single.rating, 4);
    expect(insightsRepo.responses.single.text, 'Felt great');
    expect(find.text('training-tab'), findsOneWidget);
  });

  testWidgets('Skip leaves without submitting a rating', (tester) async {
    const prompt =
        InsightPrompt(id: 'prompt-1', questionEn: 'How was this session?');
    final insightsRepo = _FakeInsightsRepository(prompt: prompt);

    await _pumpCompletePage(tester, insightsRepo: insightsRepo);

    await tester.tap(find.widgetWithText(TextButton, 'Skip'));
    await tester.pumpAndSettle();

    expect(insightsRepo.responses, isEmpty);
    expect(find.text('training-tab'), findsOneWidget);
  });

  testWidgets('the close action always leaves, even if the prompt fails to load',
      (tester) async {
    final insightsRepo = _FakeInsightsRepository();

    await _pumpCompletePage(tester, insightsRepo: insightsRepo);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();

    expect(find.text('training-tab'), findsOneWidget);
  });
}
