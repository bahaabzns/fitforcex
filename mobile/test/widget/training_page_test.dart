import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:fitforce_x/core/access/access_controller.dart';
import 'package:fitforce_x/core/access/client_access.dart';
import 'package:fitforce_x/core/config/app_config.dart';
import 'package:fitforce_x/core/config/providers.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/training/training_page.dart';
import 'package:fitforce_x/features/training/training_repository.dart';
import 'package:fitforce_x/features/training/workout_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/training_plan.dart';
import 'package:fitforce_x/shared/models/workout_log.dart';
import 'package:fitforce_x/shared/models/workout_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _testConfig = AppConfig(
  apiBaseUrl: 'http://test.local',
  flavor: Flavor.dev,
  defaultWorkspaceSlug: '',
);

TrainingPlan _twoDayPlan() => const TrainingPlan(
      id: 'plan-1',
      name: 'Push Pull Legs',
      days: [
        TrainingDay(
          id: 'day-1',
          name: 'Push Day',
          exercises: [
            TrainingExercise(
              id: 'ex-1',
              name: 'Bench Press',
              // Both metrics are tracked for this exercise, but never
              // actually filled in — tempo "-" is the builder's blank
              // placeholder and rir is null on every set — so both columns
              // should still hide entirely.
              trackedMetrics: ['tempo', 'rir'],
              sets: [
                TrainingSet(id: 'set-1', setOrder: 1, reps: '8-10', tempo: '-'),
                TrainingSet(id: 'set-2', setOrder: 2, reps: '8-10'),
              ],
            ),
          ],
        ),
        TrainingDay(
          id: 'day-2',
          name: 'Pull Day',
          exercises: [
            TrainingExercise(
              id: 'ex-2',
              name: 'Row',
              trackedMetrics: ['tempo', 'rir'],
              sets: [
                TrainingSet(id: 'set-3', setOrder: 1, reps: '10', tempo: '3-1-1', rir: 2),
              ],
            ),
          ],
        ),
      ],
    );

class _FakeTrainingRepository extends TrainingRepository {
  _FakeTrainingRepository(this._plan) : super(Dio());
  final TrainingPlan? _plan;

  @override
  Future<TrainingPlan?> fetchActivePlan() async => _plan;
}

class _FakeWorkoutRepository extends WorkoutRepository {
  _FakeWorkoutRepository({this.previous = const {}}) : super(Dio());
  final Map<String, List<PreviousSet>> previous;

  @override
  Future<Map<String, List<PreviousSet>>> fetchPrevious(String dayId) async =>
      previous;
}

Future<void> _pumpTrainingPage(
  WidgetTester tester, {
  required TrainingPlan? plan,
  Map<String, List<PreviousSet>> previous = const {},
}) async {
  final container = ProviderContainer(overrides: [
    trainingRepositoryProvider.overrideWithValue(_FakeTrainingRepository(plan)),
    workoutRepositoryProvider
        .overrideWithValue(_FakeWorkoutRepository(previous: previous)),
    appConfigProvider.overrideWithValue(_testConfig),
    clientAccessProvider.overrideWithValue(ClientAccess.allAllowed()),
  ]);
  addTearDown(container.dispose);

  final router = GoRouter(
    initialLocation: '/training',
    routes: [
      GoRoute(
        path: '/training',
        builder: (_, __) => const Scaffold(body: TrainingPage()),
      ),
      GoRoute(
        path: '/training/session',
        builder: (context, state) => Scaffold(
          body: Text('session day=${state.uri.queryParameters['day']}'),
        ),
      ),
      GoRoute(
        path: '/training/history',
        builder: (_, __) => const Scaffold(body: Text('history-tab')),
      ),
      GoRoute(
        path: '/training/progress',
        builder: (_, __) => const Scaffold(body: Text('progress-tab')),
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
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('shows a Start trigger when there is no active session',
      (tester) async {
    await _pumpTrainingPage(tester, plan: _twoDayPlan());

    expect(find.text('Start Training'), findsOneWidget);
  });

  testWidgets('tapping Start opens the session for the currently active day',
      (tester) async {
    await _pumpTrainingPage(tester, plan: _twoDayPlan());

    await tester.tap(find.text('Pull Day'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start Training'));
    await tester.pumpAndSettle();

    expect(find.text('session day=1'), findsOneWidget);
  });

  testWidgets(
      'a session left running shows Continue for its own day regardless of the selected tab',
      (tester) async {
    const active = WorkoutSession(
      id: 'session-1',
      planId: 'plan-1',
      dayId: 'day-2',
      dayIndex: 1,
      dayName: 'Pull Day',
      startedAt: '2026-08-01T10:00:00.000Z',
      exercises: [],
    );
    SharedPreferences.setMockInitialValues({
      'ff_training_session': jsonEncode(active.toJson()),
    });

    // Day tab 0 (Push Day) is selected by default, but the active session
    // belongs to day 1 (Pull Day) — Continue should reflect the session,
    // not the tab, and Start should not be shown at all.
    await _pumpTrainingPage(tester, plan: _twoDayPlan());

    expect(find.textContaining('Continue'), findsOneWidget);
    expect(find.text('Pull Day'),
        findsWidgets); // once as the tab pill, once in the trigger label
    expect(find.text('Start Training'), findsNothing);

    await tester.tap(find.textContaining('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('session day=1'), findsOneWidget);
  });

  testWidgets('hides the Tempo/RIR columns entirely when no set has a value',
      (tester) async {
    await _pumpTrainingPage(tester, plan: _twoDayPlan());

    // Push Day's only exercise has tempo "-" (the builder's blank
    // placeholder) and no rir on either set.
    expect(find.text('TEMPO'), findsNothing);
    expect(find.text('RIR'), findsNothing);
  });

  testWidgets('shows the Tempo/RIR columns when at least one set has a value',
      (tester) async {
    await _pumpTrainingPage(tester, plan: _twoDayPlan());

    await tester.tap(find.text('Pull Day'));
    await tester.pumpAndSettle();

    expect(find.text('TEMPO'), findsOneWidget);
    expect(find.text('RIR'), findsOneWidget);
  });

  testWidgets('shows fetched previous-set data in the Previous column',
      (tester) async {
    await _pumpTrainingPage(
      tester,
      plan: _twoDayPlan(),
      previous: {
        'ex-1': [
          const PreviousSet(setOrder: 1, weight: 80, reps: 8),
        ],
      },
    );

    expect(find.text('80kg × 8'), findsOneWidget);
  });
}
