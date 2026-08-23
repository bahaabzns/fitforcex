import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fitforce_x/core/access/access_controller.dart';
import 'package:fitforce_x/core/access/client_access.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/nutrition/food_diary_repository.dart';
import 'package:fitforce_x/features/nutrition/nutrition_page.dart';
import 'package:fitforce_x/features/nutrition/nutrition_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/food_diary.dart';
import 'package:fitforce_x/shared/models/nutrition_plan.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

NutritionPlan _planWithOneItem() => const NutritionPlan(
      id: 'plan-1',
      name: 'Cutting Plan',
      cycles: [
        NutritionCycle(
          id: 'cycle-1',
          name: 'Training Day',
          meals: [
            NutritionMeal(
              id: 'meal-1',
              name: 'Breakfast',
              items: [
                NutritionMealItem(
                  id: 'item-1',
                  name: 'Oatmeal',
                  amount: 100,
                  servingUnit: 'g',
                  servingSize: 100,
                  caloriesPerServing: 350,
                ),
              ],
            ),
          ],
        ),
      ],
    );

class _FakeNutritionRepository extends NutritionRepository {
  _FakeNutritionRepository(this._plan) : super(Dio());
  final NutritionPlan? _plan;

  @override
  Future<NutritionPlan?> fetchActivePlan() async => _plan;
}

class _FakeFoodDiaryRepository extends FoodDiaryRepository {
  _FakeFoodDiaryRepository({this.today}) : super(Dio());
  FoodDiaryEntry? today;
  final List<({String mealItemId, double amountEaten})> updates = [];

  @override
  Future<FoodDiaryEntry?> fetchToday({String? cycleId}) async => today;

  @override
  Future<FoodDiaryEntry> updateItem({
    required String mealItemId,
    required double amountEaten,
    String? cycleId,
  }) async {
    updates.add((mealItemId: mealItemId, amountEaten: amountEaten));
    today = today!.copyWith(
      items: [
        for (final item in today!.items)
          if (item.mealItemId == mealItemId)
            item.copyWith(amountEaten: amountEaten)
          else
            item,
      ],
    );
    return today!;
  }
}

Future<_FakeFoodDiaryRepository> _pumpNutritionPage(
  WidgetTester tester, {
  required FoodDiaryEntry? today,
}) async {
  final diaryRepo = _FakeFoodDiaryRepository(today: today);
  final container = ProviderContainer(overrides: [
    nutritionRepositoryProvider
        .overrideWithValue(_FakeNutritionRepository(_planWithOneItem())),
    foodDiaryRepositoryProvider.overrideWithValue(diaryRepo),
    clientAccessProvider.overrideWithValue(ClientAccess.allAllowed()),
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
        home: const Scaffold(body: NutritionPage()),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return diaryRepo;
}

FoodDiaryEntry _entryWith({double amountEaten = 0}) => FoodDiaryEntry(
      id: 'entry-1',
      date: '2026-08-20',
      items: [
        FoodDiaryItem(
          mealItemId: 'item-1',
          amountEaten: amountEaten,
          prescribedAmount: 100,
          servingUnit: 'g',
          servingSize: 100,
        ),
      ],
    );

void main() {
  testWidgets('tapping the checkbox marks the item fully eaten',
      (tester) async {
    final diaryRepo = await _pumpNutritionPage(tester, today: _entryWith());

    // Expand the meal to reveal the item row.
    await tester.tap(find.text('Breakfast'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('food_diary_checkbox_item-1')));
    await tester.pumpAndSettle();

    expect(diaryRepo.updates.single.mealItemId, 'item-1');
    expect(diaryRepo.updates.single.amountEaten, 100);
  });

  testWidgets('tapping a fully-eaten checkbox un-marks it (back to 0)',
      (tester) async {
    final diaryRepo =
        await _pumpNutritionPage(tester, today: _entryWith(amountEaten: 100));

    await tester.tap(find.text('Breakfast'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('food_diary_checkbox_item-1')));
    await tester.pumpAndSettle();

    expect(diaryRepo.updates.single.amountEaten, 0);
  });

  testWidgets(
      'the amount editor lets a partial amount be saved and reflects it as eaten/prescribed',
      (tester) async {
    final diaryRepo = await _pumpNutritionPage(tester, today: _entryWith());

    await tester.tap(find.text('Breakfast'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('100g'));
    await tester.pumpAndSettle();

    expect(find.text('How much of this did you eat?'), findsOneWidget);

    // Increment once from 0 -> 1, then save.
    await tester.tap(find.byIcon(Icons.add_circle_outline));
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();

    expect(diaryRepo.updates.single.mealItemId, 'item-1');
    expect(diaryRepo.updates.single.amountEaten, 1);
    expect(find.text('1/100g'), findsOneWidget);
  });

  testWidgets('the checkbox is disabled until the diary has loaded',
      (tester) async {
    // A repository whose fetchToday never resolves — diary stays "loading"
    // for the life of the test.
    final diaryRepo = _FakeFoodDiaryRepositoryNeverResolves();
    final container = ProviderContainer(overrides: [
      nutritionRepositoryProvider
          .overrideWithValue(_FakeNutritionRepository(_planWithOneItem())),
      foodDiaryRepositoryProvider.overrideWithValue(diaryRepo),
      clientAccessProvider.overrideWithValue(ClientAccess.allAllowed()),
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
          home: const Scaffold(body: NutritionPage()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Breakfast'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('food_diary_checkbox_item-1')));
    await tester.pumpAndSettle();

    expect(diaryRepo.updateCalled, isFalse);
  });
}

class _FakeFoodDiaryRepositoryNeverResolves extends FoodDiaryRepository {
  _FakeFoodDiaryRepositoryNeverResolves() : super(Dio());
  bool updateCalled = false;

  @override
  Future<FoodDiaryEntry?> fetchToday({String? cycleId}) {
    return Completer<FoodDiaryEntry?>().future;
  }

  @override
  Future<FoodDiaryEntry> updateItem({
    required String mealItemId,
    required double amountEaten,
    String? cycleId,
  }) async {
    updateCalled = true;
    throw UnimplementedError();
  }
}
