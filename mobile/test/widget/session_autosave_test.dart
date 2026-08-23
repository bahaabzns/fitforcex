import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:fitforce_x/core/access/access_controller.dart';
import 'package:fitforce_x/core/access/client_access.dart';
import 'package:fitforce_x/core/config/app_config.dart';
import 'package:fitforce_x/core/config/providers.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/training/session_page.dart';
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

TrainingPlan _planWithOneExercise() => const TrainingPlan(
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
              sets: [TrainingSet(id: 'set-1', setOrder: 1, reps: '8-10')],
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

/// Captures every upsertLog call so tests can assert which session id an
/// autosave targeted and how many debounced calls actually fired.
class _FakeWorkoutRepository extends WorkoutRepository {
  _FakeWorkoutRepository({this.draft}) : super(Dio());
  final WorkoutDraft? draft;
  final List<String> upsertIds = [];
  final List<Map<String, dynamic>> upsertPayloads = [];

  @override
  Future<Map<String, List<PreviousSet>>> fetchPrevious(String dayId) async =>
      {};

  @override
  Future<WorkoutDraft?> fetchDraft(String dayId) async => draft;

  @override
  Future<void> upsertLog(String id, Map<String, dynamic> payload) async {
    upsertIds.add(id);
    upsertPayloads.add(payload);
  }

  @override
  Future<void> deleteLog(String id) async {}
}

Future<_FakeWorkoutRepository> _pumpSession(
  WidgetTester tester, {
  required _FakeTrainingRepository trainingRepo,
  required _FakeWorkoutRepository workoutRepo,
}) async {
  final container = ProviderContainer(overrides: [
    trainingRepositoryProvider.overrideWithValue(trainingRepo),
    workoutRepositoryProvider.overrideWithValue(workoutRepo),
    appConfigProvider.overrideWithValue(_testConfig),
    clientAccessProvider.overrideWithValue(ClientAccess.allAllowed()),
  ]);
  addTearDown(container.dispose);

  final router = GoRouter(
    initialLocation: '/training/session',
    routes: [
      GoRoute(
        path: '/training/session',
        builder: (_, __) => const SessionPage(dayIndex: 0),
      ),
      GoRoute(
        path: '/training',
        builder: (_, __) => const Scaffold(body: Text('training-tab')),
      ),
      GoRoute(
        path: '/training/history',
        builder: (_, __) => const Scaffold(body: Text('history-tab')),
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
  return workoutRepo;
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
      'resumes from the server draft when there is no local session, and '
      'autosaves under the resumed id', (tester) async {
    final workoutRepo = _FakeWorkoutRepository(
      draft: WorkoutDraft.fromJson({
        'id': 'draft-session-id',
        'started_at': '2026-08-01T10:00:00Z',
        'exercises': [
          {
            'exercise_id': 'ex-1',
            'note': 'felt strong',
            'sets': [
              {'set_order': 1, 'weight': '80', 'reps': '8'},
            ],
          },
        ],
      }),
    );

    await _pumpSession(
      tester,
      trainingRepo: _FakeTrainingRepository(_planWithOneExercise()),
      workoutRepo: workoutRepo,
    );

    // The restored weight from the server draft is pre-filled.
    final weightField =
        tester.widget<TextFormField>(find.byType(TextFormField).first);
    expect(weightField.initialValue, '80');

    await tester.enterText(find.byType(TextFormField).first, '82.5');
    await tester.pump(const Duration(milliseconds: 750));

    expect(workoutRepo.upsertIds, ['draft-session-id']);
    expect(workoutRepo.upsertPayloads.single['completed'], false);
  });

  testWidgets('a brand new session mints its own id and autosaves under it',
      (tester) async {
    final workoutRepo = _FakeWorkoutRepository();

    await _pumpSession(
      tester,
      trainingRepo: _FakeTrainingRepository(_planWithOneExercise()),
      workoutRepo: workoutRepo,
    );

    await tester.enterText(find.byType(TextFormField).first, '60');
    await tester.pump(const Duration(milliseconds: 750));

    expect(workoutRepo.upsertIds, hasLength(1));
    expect(workoutRepo.upsertIds.single, isNotEmpty);
  });

  testWidgets('debounces rapid edits into a single autosave call',
      (tester) async {
    final workoutRepo = _FakeWorkoutRepository();

    await _pumpSession(
      tester,
      trainingRepo: _FakeTrainingRepository(_planWithOneExercise()),
      workoutRepo: workoutRepo,
    );

    await tester.enterText(find.byType(TextFormField).first, '6');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.enterText(find.byType(TextFormField).first, '60');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.enterText(find.byType(TextFormField).first, '60.5');
    await tester.pump(const Duration(milliseconds: 750));

    expect(workoutRepo.upsertPayloads, hasLength(1));
  });

  testWidgets('resumes a locally-cached session under its own id',
      (tester) async {
    const localSession = WorkoutSession(
      id: 'local-session-id',
      planId: 'plan-1',
      dayId: 'day-1',
      dayIndex: 0,
      startedAt: '2026-08-01T09:00:00Z',
      exercises: [
        SessionExercise(
          exerciseId: 'ex-1',
          sets: [SessionSet(setOrder: 1, weight: '50')],
        ),
      ],
    );
    SharedPreferences.setMockInitialValues({
      'ff_training_session': jsonEncode(localSession.toJson()),
    });

    final workoutRepo = _FakeWorkoutRepository();

    await _pumpSession(
      tester,
      trainingRepo: _FakeTrainingRepository(_planWithOneExercise()),
      workoutRepo: workoutRepo,
    );

    final weightField =
        tester.widget<TextFormField>(find.byType(TextFormField).first);
    expect(weightField.initialValue, '50');

    await tester.enterText(find.byType(TextFormField).first, '55');
    await tester.pump(const Duration(milliseconds: 750));

    expect(workoutRepo.upsertIds, ['local-session-id']);
  });
}
