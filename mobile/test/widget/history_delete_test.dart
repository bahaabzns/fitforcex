import 'package:dio/dio.dart';
import 'package:fitforce_x/core/access/access_controller.dart';
import 'package:fitforce_x/core/access/client_access.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/insights/insights_repository.dart';
import 'package:fitforce_x/features/training/history_page.dart';
import 'package:fitforce_x/features/training/workout_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/insight_prompt.dart';
import 'package:fitforce_x/shared/models/workout_log.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeWorkoutRepository extends WorkoutRepository {
  _FakeWorkoutRepository(this._logs) : super(Dio());
  final List<WorkoutLogSummary> _logs;
  bool deleteThrows = false;
  String? lastDeletedId;

  @override
  Future<List<WorkoutLogSummary>> fetchLogs() async => List.of(_logs);

  @override
  Future<void> deleteLog(String id) async {
    if (deleteThrows) throw Exception('boom');
    lastDeletedId = id;
    _logs.removeWhere((l) => l.id == id);
  }
}

/// The history page now mounts a TriggerInsightBannerGroup at its top —
/// stub it out so the test never attempts a real network call.
class _FakeInsightsRepository extends InsightsRepository {
  _FakeInsightsRepository() : super(Dio());

  @override
  Future<InsightPrompt?> fetchPromptForTrigger(String event) async => null;
}

Future<void> _pumpHistoryPage(
  WidgetTester tester,
  ProviderContainer container,
) async {
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('ar')],
        theme: AppTheme.light,
        home: const HistoryPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
      'confirming delete removes the log and calls the repository',
      (tester) async {
    final logs = [
      const WorkoutLogSummary(id: 'log-1', date: '2026-08-01', dayName: 'Push Day'),
    ];
    final fakeRepo = _FakeWorkoutRepository(logs);
    final container = ProviderContainer(overrides: [
      workoutRepositoryProvider.overrideWithValue(fakeRepo),
      clientAccessProvider.overrideWithValue(ClientAccess.allAllowed()),
      insightsRepositoryProvider.overrideWithValue(_FakeInsightsRepository()),
    ]);
    addTearDown(container.dispose);

    await _pumpHistoryPage(tester, container);

    expect(find.text('Push Day'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pumpAndSettle();

    expect(find.text("Delete this workout log? This can't be undone."),
        findsOneWidget);

    await tester.tap(find.text('Delete workout').last);
    await tester.pumpAndSettle();

    expect(fakeRepo.lastDeletedId, 'log-1');
    expect(find.text('Push Day'), findsNothing);
  });

  testWidgets('a failed delete shows an error and keeps the log',
      (tester) async {
    final logs = [
      const WorkoutLogSummary(id: 'log-1', date: '2026-08-01', dayName: 'Push Day'),
    ];
    final fakeRepo = _FakeWorkoutRepository(logs)..deleteThrows = true;
    final container = ProviderContainer(overrides: [
      workoutRepositoryProvider.overrideWithValue(fakeRepo),
      clientAccessProvider.overrideWithValue(ClientAccess.allAllowed()),
      insightsRepositoryProvider.overrideWithValue(_FakeInsightsRepository()),
    ]);
    addTearDown(container.dispose);

    await _pumpHistoryPage(tester, container);

    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete workout').last);
    await tester.pumpAndSettle();

    expect(
        find.text('Could not delete — check your connection and try again.'),
        findsOneWidget);
    expect(find.text('Push Day'), findsOneWidget);
  });
}
