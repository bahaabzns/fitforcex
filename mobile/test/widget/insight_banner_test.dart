import 'package:dio/dio.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/insights/insights_repository.dart';
import 'package:fitforce_x/features/insights/widgets/insight_banner.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/insight_prompt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeInsightsRepository extends InsightsRepository {
  _FakeInsightsRepository(this._prompt) : super(Dio());
  final InsightPrompt? _prompt;
  String? respondedPromptId;
  int? respondedRating;
  String? lastDismissedId;
  bool respondThrows = false;

  @override
  Future<InsightPrompt?> fetchActivePrompt() async => _prompt;

  @override
  Future<void> respondToPrompt(String promptId,
      {int? ratingValue, String? selectedOption, String? textValue}) async {
    if (respondThrows) throw Exception('boom');
    respondedPromptId = promptId;
    respondedRating = ratingValue;
  }

  @override
  Future<void> dismissPrompt(String promptId) async {
    lastDismissedId = promptId;
  }

  @override
  Future<void> markPromptStarted(String promptId) async {}
}

Future<_FakeInsightsRepository> _pumpBanner(
  WidgetTester tester, {
  required InsightPrompt? prompt,
  bool respondThrows = false,
}) async {
  final fake = _FakeInsightsRepository(prompt)..respondThrows = respondThrows;
  final container = ProviderContainer(overrides: [
    insightsRepositoryProvider.overrideWithValue(fake),
  ]);
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('ar')],
        home: const Scaffold(body: InsightBanner()),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return fake;
}

void main() {
  testWidgets('renders nothing when there is no active prompt',
      (tester) async {
    await _pumpBanner(tester, prompt: null);
    expect(find.text('QUICK QUESTION'), findsNothing);
  });

  testWidgets('rating prompt: picking a value and submitting responds and thanks',
      (tester) async {
    const prompt = InsightPrompt(
      id: 'prompt-1',
      questionEn: 'How likely are you to recommend us?',
      responseType: 'rating',
      scaleMax: 10,
    );
    final fake = await _pumpBanner(tester, prompt: prompt);

    expect(find.text('How likely are you to recommend us?'), findsOneWidget);

    await tester.tap(find.text('9'));
    await tester.pump();
    await tester.tap(find.text('Send'));
    await tester.pumpAndSettle();

    expect(fake.respondedPromptId, 'prompt-1');
    expect(fake.respondedRating, 9);
    expect(find.text('Thanks for the feedback!'), findsOneWidget);

    // Auto-hides ~1.8s after answering.
    await tester.pump(const Duration(milliseconds: 1900));
    expect(find.text('Thanks for the feedback!'), findsNothing);
  });

  testWidgets('dismiss hides the banner without responding', (tester) async {
    const prompt = InsightPrompt(
      id: 'prompt-1',
      questionEn: 'Quick one?',
      responseType: 'text',
    );
    final fake = await _pumpBanner(tester, prompt: prompt);

    expect(find.text('Quick one?'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();

    expect(find.text('Quick one?'), findsNothing);
    expect(fake.respondedPromptId, isNull);
  });
}
