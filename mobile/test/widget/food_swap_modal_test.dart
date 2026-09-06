import 'package:dio/dio.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/features/nutrition/food_swap_repository.dart';
import 'package:fitforce_x/features/nutrition/widgets/food_swap_modal.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/food_swap.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeFoodSwapRepository extends FoodSwapRepository {
  _FakeFoodSwapRepository(this._results) : super(Dio());
  final List<FoodSwapAlternative> _results;
  String? lastSwappedTo;
  bool swapThrows = false;

  @override
  Future<List<FoodSwapAlternative>> search(String mealItemId,
      {String? query}) async {
    return _results;
  }

  @override
  Future<void> swap(String mealItemId, String alternativeFoodId) async {
    if (swapThrows) throw Exception('boom');
    lastSwappedTo = alternativeFoodId;
  }
}

Future<_FakeFoodSwapRepository> _pumpModal(
  WidgetTester tester, {
  List<FoodSwapAlternative> results = const [],
  bool swapThrows = false,
}) async {
  final fake = _FakeFoodSwapRepository(results)..swapThrows = swapThrows;
  final container = ProviderContainer(overrides: [
    foodSwapRepositoryProvider.overrideWithValue(fake),
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
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => FoodSwapModal.show(
                  context,
                  mealItemId: 'item-1',
                  currentFoodName: 'Rice',
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return fake;
}

void main() {
  testWidgets('shows search results and the swap title', (tester) async {
    await _pumpModal(tester, results: const [
      FoodSwapAlternative(
        foodItemId: 'food-2',
        name: 'Chicken Breast',
        servingUnit: 'g',
        calculatedAmount: 120,
        calories: 200,
      ),
    ]);

    expect(find.text('Swap Rice'), findsOneWidget);
    expect(find.text('Chicken Breast'), findsOneWidget);
  });

  testWidgets('shows an empty state when there are no alternatives',
      (tester) async {
    await _pumpModal(tester, results: const []);
    expect(find.text('No matching foods found.'), findsOneWidget);
  });

  testWidgets(
      'selecting an alternative shows the equivalent preview and confirms the swap',
      (tester) async {
    final fake = await _pumpModal(tester, results: const [
      FoodSwapAlternative(
        foodItemId: 'food-2',
        name: 'Chicken Breast',
        servingUnit: 'g',
        calculatedAmount: 120,
        calories: 200,
      ),
    ]);

    await tester.tap(find.text('Chicken Breast'));
    await tester.pumpAndSettle();

    expect(find.text('EQUIVALENT TO YOUR MEAL'), findsOneWidget);

    await tester.tap(find.text('Confirm Swap'));
    await tester.pumpAndSettle();

    expect(fake.lastSwappedTo, 'food-2');
  });

  testWidgets('a failed swap shows an error and keeps the modal open',
      (tester) async {
    await _pumpModal(tester, swapThrows: true, results: const [
      FoodSwapAlternative(
        foodItemId: 'food-2',
        name: 'Chicken Breast',
        servingUnit: 'g',
        calculatedAmount: 120,
        calories: 200,
      ),
    ]);

    await tester.tap(find.text('Chicken Breast'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirm Swap'));
    await tester.pumpAndSettle();

    expect(find.text("Couldn't complete the swap. Try again."),
        findsOneWidget);
    expect(find.text('Chicken Breast'), findsOneWidget);
  });
}
