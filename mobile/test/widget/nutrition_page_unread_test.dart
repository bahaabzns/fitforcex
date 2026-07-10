import 'package:dio/dio.dart';
import 'package:fitforce_x/core/access/access_controller.dart';
import 'package:fitforce_x/core/access/client_access.dart';
import 'package:fitforce_x/core/theme/app_theme.dart';
import 'package:fitforce_x/core/unread/last_seen_store.dart';
import 'package:fitforce_x/core/unread/unread_indicators.dart';
import 'package:fitforce_x/features/nutrition/nutrition_page.dart';
import 'package:fitforce_x/features/nutrition/nutrition_repository.dart';
import 'package:fitforce_x/l10n/generated/app_localizations.dart';
import 'package:fitforce_x/shared/models/nutrition_plan.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeNutritionRepository extends NutritionRepository {
  _FakeNutritionRepository(this._plan) : super(Dio());
  final NutritionPlan? _plan;

  @override
  Future<NutritionPlan?> fetchActivePlan() async => _plan;
}

/// In-memory only — avoids the shared_preferences platform channel in tests.
class _FakeLastSeenStore extends LastSeenStore {
  final Map<String, String> _planKeys = {};

  @override
  Future<String?> getPlanKey(String module) async => _planKeys[module];

  @override
  Future<void> setPlanKey(String module, String key) async {
    _planKeys[module] = key;
  }
}

/// Mirrors the app's real IndexedStack shell: toggles between a stand-in for
/// ShellPage (which pre-warms `activeNutritionPlanProvider` just by watching
/// the unread flag, exactly like the real shell does) and NutritionPage
/// itself, without ever recreating the ProviderScope — so provider state
/// (and the bug's timing) carries over exactly like real navigation does.
class _ShellStandIn extends ConsumerStatefulWidget {
  const _ShellStandIn();
  @override
  ConsumerState<_ShellStandIn> createState() => _ShellStandInState();
}

class _ShellStandInState extends ConsumerState<_ShellStandIn> {
  bool onNutritionTab = false;

  void switchToNutritionTab() => setState(() => onNutritionTab = true);

  @override
  Widget build(BuildContext context) {
    if (onNutritionTab) return const NutritionPage();
    // Stand-in for ShellPage: watches the unread flag, which transitively
    // resolves (and keeps warm) activeNutritionPlanProvider before the
    // Nutrition tab is ever opened.
    ref.watch(nutritionUnreadProvider);
    return const SizedBox.shrink();
  }
}

void main() {
  testWidgets(
      'opening Nutrition marks an already-loaded plan seen, clearing the unread dot',
      (tester) async {
    final plan = const NutritionPlan(id: 'plan-1', activatedAt: '2026-01-01T00:00:00Z');
    final container = ProviderContainer(overrides: [
      nutritionRepositoryProvider.overrideWithValue(_FakeNutritionRepository(plan)),
      lastSeenStoreProvider.overrideWithValue(_FakeLastSeenStore()),
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
          home: const _ShellStandIn(),
        ),
      ),
    );

    // Let the shell stand-in resolve the plan first — the dot should be lit,
    // and the plan is now fully cached (AsyncData), same as real navigation
    // after time spent on another tab.
    await tester.pumpAndSettle();
    expect(container.read(nutritionUnreadProvider), isTrue,
        reason: 'a freshly-activated plan should show the dot before it has been opened');

    // Now "navigate" to the Nutrition tab — NutritionPage mounts fresh into
    // an already-resolved provider. A build()-scoped ref.listen would never
    // fire here (no further transition ever occurs); this is the exact bug.
    final shellState = tester.state<_ShellStandInState>(find.byType(_ShellStandIn));
    shellState.switchToNutritionTab();
    await tester.pumpAndSettle();

    expect(container.read(nutritionUnreadProvider), isFalse,
        reason: 'opening the tab should mark the already-loaded plan seen and clear the dot');
  });
}
