import 'package:dio/dio.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/nutrition/food_diary_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/features/nutrition/food_diary_history_page.dart';
import 'package:fitforce_x/shared/models/food_diary.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeFoodDiaryRepository extends FoodDiaryRepository {
  _FakeFoodDiaryRepository(this._entries) : super(Dio());
  final List<FoodDiaryEntry> _entries;

  @override
  Future<List<FoodDiaryEntry>> fetchHistory() async => _entries;
}

Future<void> _pumpHistoryPage(
  WidgetTester tester, {
  required List<FoodDiaryEntry> entries,
}) async {
  final container = ProviderContainer(overrides: [
    foodDiaryRepositoryProvider
        .overrideWithValue(_FakeFoodDiaryRepository(entries)),
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
        home: const FoodDiaryHistoryPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows an empty state with no entries', (tester) async {
    await _pumpHistoryPage(tester, entries: const []);

    expect(
      find.text(
          'No food diary entries yet — check off food items on your Nutrition page to start tracking.'),
      findsOneWidget,
    );
  });

  testWidgets('lists entries with adherence, expands to show macros and items',
      (tester) async {
    await _pumpHistoryPage(tester, entries: [
      const FoodDiaryEntry(
        id: 'entry-1',
        date: '2026-08-20',
        totalCalories: 1800,
        totalProtein: 120,
        totalCarbs: 200,
        totalFats: 50,
        goalCalories: 2000,
        adherence: 90,
        items: [
          FoodDiaryItem(
            mealItemId: 'item-1',
            nameEn: 'Oatmeal',
            amountEaten: 100,
            prescribedAmount: 100,
            servingUnit: 'g',
          ),
        ],
      ),
    ]);

    expect(find.text('90%'), findsOneWidget);
    expect(find.text('1800 Calories'), findsOneWidget);

    // Expand.
    await tester.tap(find.text('1800 Calories'));
    await tester.pumpAndSettle();

    expect(find.text('Oatmeal'), findsOneWidget);
    expect(find.text('100/100g'), findsOneWidget);
    expect(find.text('1800 / 2000'), findsOneWidget);
  });

  testWidgets('shows "No goal set" when adherence is null', (tester) async {
    await _pumpHistoryPage(tester, entries: const [
      FoodDiaryEntry(id: 'entry-1', date: '2026-08-20', totalCalories: 500),
    ]);

    expect(find.text('No goal set'), findsOneWidget);
  });
}
