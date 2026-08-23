import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_controller.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/unread/unread_indicators.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/collapsible_note.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/pill_tabs.dart';
import '../../l10n/generated/app_localizations.dart';
import '../access/restricted_view.dart';
import '../../shared/models/food_diary.dart';
import '../../shared/models/nutrition_plan.dart';
import '../../shared/utils/format_amount.dart';
import '../../shared/utils/localization.dart';
import '../../shared/utils/nutrition_calc.dart';
import 'food_diary_controller.dart';
import 'food_swap_repository.dart';
import 'nutrition_repository.dart';
import 'widgets/food_diary_amount_editor.dart';
import 'widgets/food_swap_modal.dart';
import 'widgets/macros_donut.dart';
import 'widgets/shopping_list_sheet.dart';

/// How much of [mealItemId] today's diary snapshot says was eaten — 0
/// (untracked) if the diary hasn't loaded yet, or this item's id isn't in
/// the snapshot (most likely: the coach edited the plan after today's diary
/// was already created — the snapshot is deliberately frozen for the day,
/// same tradeoff workout_logs makes).
double diaryAmountEatenFor(FoodDiaryEntry? diary, String mealItemId) {
  for (final item in diary?.items ?? const <FoodDiaryItem>[]) {
    if (item.mealItemId == mealItemId) return item.amountEaten;
  }
  return 0;
}

/// The client's active nutrition plan. Parity port of the web portal nutrition
/// page: macros donut, cycle tabs, collapsible coach notes, expandable meals
/// with checkable items + alternatives, and a shopping-list sheet.
class NutritionPage extends ConsumerStatefulWidget {
  const NutritionPage({super.key});

  @override
  ConsumerState<NutritionPage> createState() => _NutritionPageState();
}

class _NutritionPageState extends ConsumerState<NutritionPage> {
  @override
  void initState() {
    super.initState();
    // fireImmediately: ref.listen (used in build()) only fires on a state
    // *transition* — it never fires for a value the provider already holds
    // when the listener registers. Since the shell keeps this provider warm
    // (it watches the unread flags on every tab), the plan is often already
    // loaded by the time this page mounts, so a build()-scoped ref.listen
    // never marks it seen. listenManual + fireImmediately fixes that, and
    // keeps listening for the plan's lifetime so a new plan published while
    // this tab is already active (kept alive by the IndexedStack) still
    // clears the dot correctly. The mutation itself is deferred a microtask
    // — Riverpod forbids modifying provider state while the widget tree is
    // still building, which fireImmediately's synchronous initState call is.
    if (ref.read(clientAccessProvider).canViewNutrition) {
      ref.listenManual<AsyncValue<NutritionPlan?>>(
        activeNutritionPlanProvider,
        (_, next) {
          final loaded = next.asData?.value;
          if (loaded != null) {
            unawaited(Future.microtask(() {
              ref
                  .read(nutritionPlanSeenProvider.notifier)
                  .markSeen('${loaded.id}|${loaded.activatedAt ?? ''}');
            }));
          }
        },
        fireImmediately: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (!ref.watch(clientAccessProvider).canViewNutrition) {
      return RestrictedView(message: l10n.restrictedNutrition);
    }

    final plan = ref.watch(activeNutritionPlanProvider);

    return AsyncValueWidget<NutritionPlan?>(
      value: plan,
      onRetry: () => ref.invalidate(activeNutritionPlanProvider),
      data: (plan) {
        if (plan == null || plan.cycles.isEmpty) {
          return EmptyState(
            icon: Icons.restaurant_menu_outlined,
            title: l10n.nutritionNoActivePlan,
            hint: l10n.nutritionNoActivePlanHint,
          );
        }
        return _NutritionView(plan: plan);
      },
    );
  }
}

class _NutritionView extends ConsumerStatefulWidget {
  const _NutritionView({required this.plan});

  final NutritionPlan plan;

  @override
  ConsumerState<_NutritionView> createState() => _NutritionViewState();
}

class _NutritionViewState extends ConsumerState<_NutritionView> {
  int _activeCycle = 0;
  final _expandedMeals = <String>{};
  String? _resettingItemId;

  Future<void> _toggleItem(NutritionMealItem item, FoodDiaryEntry? diary) {
    final prescribed = item.amount;
    final eaten = diaryAmountEatenFor(diary, item.id);
    final isFullyEaten = prescribed > 0 && eaten >= prescribed;
    return ref.read(foodDiaryControllerProvider.notifier).setAmountEaten(
          item.id,
          isFullyEaten ? 0 : prescribed,
          cycleId: widget.plan.cycles[_activeCycle].id,
        );
  }

  Future<void> _editAmount(NutritionMealItem item, FoodDiaryEntry? diary) async {
    final amount = await FoodDiaryAmountEditor.show(
      context,
      initialAmount: diaryAmountEatenFor(diary, item.id),
      prescribedAmount: item.amount,
      servingUnit: item.servingUnit,
    );
    if (amount == null || !mounted) return;
    await ref.read(foodDiaryControllerProvider.notifier).setAmountEaten(
          item.id,
          amount,
          cycleId: widget.plan.cycles[_activeCycle].id,
        );
  }

  Future<void> _openSwapModal(NutritionMealItem item, String locale) async {
    final name = localizedField(
        base: item.name, arabic: item.nameAr, localeCode: locale);
    final swapped = await FoodSwapModal.show(
      context,
      mealItemId: item.id,
      currentFoodName: name,
    );
    if (swapped == true) {
      ref.invalidate(activeNutritionPlanProvider);
    }
  }

  Future<void> _resetSwap(String itemId) async {
    setState(() => _resettingItemId = itemId);
    try {
      await ref.read(foodSwapRepositoryProvider).reset(itemId);
      ref.invalidate(activeNutritionPlanProvider);
    } catch (_) {
      // Swallowed — matches web: the item simply stays swapped and the
      // client can retry the reset button.
    } finally {
      if (mounted) setState(() => _resettingItemId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final canSwapFood = ref.watch(clientAccessProvider).canSwapFood;
    final diary = ref.watch(foodDiaryControllerProvider).asData?.value;
    final plan = widget.plan;
    final cycle = plan.cycles[_activeCycle.clamp(0, plan.cycles.length - 1)];
    final totals = calcCycle(cycle);

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 96),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    plan.name.isEmpty ? l10n.nutritionTitle : plan.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
                Tooltip(
                  message: l10n.nutritionFoodDiaryViewHistory,
                  child: InkWell(
                    onTap: () => context.push(AppRoutes.nutritionDiary),
                    customBorder: const CircleBorder(),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: context.appColors.border),
                      ),
                      child: Icon(Icons.history,
                          size: 20, color: context.appColors.mutedForeground),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Macros donut (hidden when the cycle has no macro data)
            if (totals.macroCalories > 0) ...[
              MacrosDonut(
                totals: totals,
                labels: MacroLabels(
                  carbs: l10n.nutritionCarbs,
                  fat: l10n.nutritionFat,
                  protein: l10n.nutritionProtein,
                  kcal: l10n.nutritionKcal,
                ),
              ),
              const SizedBox(height: 16),
            ] else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  l10n.nutritionNoData,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.appColors.mutedForeground),
                ),
              ),

            // Cycle tabs
            if (plan.cycles.length > 1) ...[
              PillTabs(
                labels: [for (final c in plan.cycles) c.name],
                selectedIndex: _activeCycle,
                onSelected: (i) => setState(() => _activeCycle = i),
              ),
              const SizedBox(height: 16),
            ],

            // Coach note
            if ((cycle.note ?? '').trim().isNotEmpty) ...[
              CollapsibleNote(
                  label: l10n.nutritionCoachNote, body: cycle.note!),
              const SizedBox(height: 12),
            ],

            // Meals
            if (cycle.meals.isEmpty)
              _InfoCard(text: l10n.nutritionNoMeals)
            else ...[
              _SectionSeparator(label: l10n.nutritionMeals),
              const SizedBox(height: 12),
              for (final meal in cycle.meals) ...[
                _MealCard(
                  meal: meal,
                  locale: locale,
                  expanded: _expandedMeals.contains(meal.id),
                  diary: diary,
                  onToggleMeal: () => setState(() {
                    _expandedMeals.contains(meal.id)
                        ? _expandedMeals.remove(meal.id)
                        : _expandedMeals.add(meal.id);
                  }),
                  onToggleItem: (item) => _toggleItem(item, diary),
                  onEditAmount: (item) => _editAmount(item, diary),
                  canSwapFood: canSwapFood,
                  resettingItemId: _resettingItemId,
                  onSwap: (item) => _openSwapModal(item, locale),
                  onReset: _resetSwap,
                ),
                const SizedBox(height: 12),
              ],
            ],
          ],
        ),

        // Floating shopping-list trigger
        Positioned(
          left: 0,
          right: 0,
          bottom: 16,
          child: Center(
            child: FilledButton.icon(
              onPressed: () => ShoppingListSheet.show(context, plan),
              icon: const Icon(Icons.shopping_cart, size: 18),
              label: Text(l10n.shoppingButton),
            ),
          ),
        ),
      ],
    );
  }
}

class _MealCard extends StatelessWidget {
  const _MealCard({
    required this.meal,
    required this.locale,
    required this.expanded,
    required this.diary,
    required this.onToggleMeal,
    required this.onToggleItem,
    required this.onEditAmount,
    required this.canSwapFood,
    required this.resettingItemId,
    required this.onSwap,
    required this.onReset,
  });

  final NutritionMeal meal;
  final String locale;
  final bool expanded;
  final FoodDiaryEntry? diary;
  final VoidCallback onToggleMeal;
  final ValueChanged<NutritionMealItem> onToggleItem;
  final ValueChanged<NutritionMealItem> onEditAmount;
  final bool canSwapFood;
  final String? resettingItemId;
  final ValueChanged<NutritionMealItem> onSwap;
  final ValueChanged<String> onReset;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final totals = calcMeal(meal);

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onToggleMeal,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          meal.name,
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ),
                      if (!expanded)
                        Text(
                          '${meal.items.length} ${meal.items.length == 1 ? l10n.nutritionItem : l10n.nutritionItems}',
                          style: TextStyle(fontSize: 10, color: muted),
                        ),
                      AnimatedRotation(
                        turns: expanded ? 0.5 : 0,
                        duration: const Duration(milliseconds: 200),
                        child: Icon(Icons.keyboard_arrow_down,
                            size: 18, color: muted),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  _macroRow(context, totals),
                ],
              ),
            ),
          ),
          if (expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
              child: Column(
                children: [
                  for (final item in meal.items)
                    _ItemRow(
                      item: item,
                      locale: locale,
                      eaten: diaryAmountEatenFor(diary, item.id),
                      diaryReady: diary != null,
                      onToggle: () => onToggleItem(item),
                      onEditAmount: () => onEditAmount(item),
                      canSwapFood: canSwapFood,
                      resetting: resettingItemId == item.id,
                      onSwap: () => onSwap(item),
                      onReset: () => onReset(item.id),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _macroRow(BuildContext context, Macros m) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Row(
        children: [
          Text('${m.calories.round()} ${l10n.nutritionKcal}',
              style: TextStyle(fontSize: 11, color: muted)),
          const SizedBox(width: 8),
          Text('${l10n.nutritionCarbsAbbr} ${m.carbs.round()}g',
              style: const TextStyle(fontSize: 11, color: Color(0xFF159BFF))),
          const SizedBox(width: 8),
          Text('${l10n.nutritionFatAbbr} ${m.fats.round()}g',
              style: const TextStyle(fontSize: 11, color: Color(0xFFF59E0B))),
          const SizedBox(width: 8),
          Text('${l10n.nutritionProteinAbbr} ${m.protein.round()}g',
              style: const TextStyle(fontSize: 11, color: Color(0xFFF97316))),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({
    required this.item,
    required this.locale,
    required this.eaten,
    required this.diaryReady,
    required this.onToggle,
    required this.onEditAmount,
    required this.canSwapFood,
    required this.resetting,
    required this.onSwap,
    required this.onReset,
  });

  final NutritionMealItem item;
  final String locale;

  /// How much of this item today's diary says was eaten.
  final double eaten;

  /// False until today's diary entry has loaded — the checkbox and amount
  /// editor stay disabled until then (matches web: `disabled={!diaryEntry}`).
  final bool diaryReady;
  final VoidCallback onToggle;
  final VoidCallback onEditAmount;
  final bool canSwapFood;
  final bool resetting;
  final VoidCallback onSwap;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final macros = calcItem(item);
    final name = localizedField(
        base: item.name, arabic: item.nameAr, localeCode: locale);
    final prescribed = item.amount;
    final checked = prescribed > 0 && eaten >= prescribed;
    final isPartial = eaten > 0 && !checked;

    return Opacity(
      opacity: checked ? 0.4 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _checkbox(context, checked: checked, isPartial: isPartial),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          decoration:
                              checked ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      InkWell(
                        onTap: diaryReady ? onEditAmount : null,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              isPartial
                                  ? '${prettyAmount(eaten)}/${prettyAmount(item.amount)}${item.servingUnit}'
                                  : '${prettyAmount(item.amount)}${item.servingUnit}',
                              style: TextStyle(fontSize: 11, color: muted),
                            ),
                            const SizedBox(width: 3),
                            Icon(Icons.edit, size: 10, color: muted.withValues(alpha: 0.5)),
                          ],
                        ),
                      ),
                      if (item.isSwapped)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.swap_horiz,
                                  size: 10,
                                  color: Theme.of(context).colorScheme.primary),
                              const SizedBox(width: 3),
                              Flexible(
                                child: Text(
                                  l10n.nutritionSwappedFrom(localizedField(
                                    base: item.originalFoodName ?? '',
                                    arabic: item.originalFoodNameAr,
                                    localeCode: locale,
                                  )),
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Theme.of(context).colorScheme.primary,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${macros.calories.round()} ${l10n.nutritionKcal}',
                          style: TextStyle(fontSize: 11, color: muted)),
                      Row(
                        children: [
                          Text(
                              '${l10n.nutritionCarbsAbbr}${macros.carbs.round()}',
                              style: const TextStyle(
                                  fontSize: 11, color: Color(0xFF159BFF))),
                          const SizedBox(width: 4),
                          Text('${l10n.nutritionFatAbbr}${macros.fats.round()}',
                              style: const TextStyle(
                                  fontSize: 11, color: Color(0xFFF59E0B))),
                          const SizedBox(width: 4),
                          Text(
                              '${l10n.nutritionProteinAbbr}${macros.protein.round()}',
                              style: const TextStyle(
                                  fontSize: 11, color: Color(0xFFF97316))),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (canSwapFood)
              Padding(
                padding: const EdgeInsetsDirectional.only(start: 26, top: 4),
                child: Row(
                  children: [
                    InkWell(
                      onTap: onSwap,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.swap_horiz,
                              size: 11,
                              color: Theme.of(context).colorScheme.primary),
                          const SizedBox(width: 3),
                          Text(
                            l10n.nutritionSwapFood,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (item.isSwapped) ...[
                      const SizedBox(width: 12),
                      InkWell(
                        onTap: resetting ? null : onReset,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.undo, size: 11, color: muted),
                            const SizedBox(width: 3),
                            Text(
                              l10n.nutritionResetToCoachPlan,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            if (item.alternatives.isNotEmpty)
              Padding(
                padding: const EdgeInsetsDirectional.only(start: 28, top: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.nutritionAlternatives,
                      style: TextStyle(fontSize: 10, color: muted),
                    ),
                    for (final alt in item.alternatives)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '${localizedField(base: alt.name, arabic: alt.nameAr, localeCode: locale)} · ${prettyAmount(alt.amount)}${alt.servingUnit}',
                          style: const TextStyle(fontSize: 12),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _checkbox(BuildContext context,
      {required bool checked, required bool isPartial}) {
    final primary = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      key: Key('food_diary_checkbox_${item.id}'),
      onTap: diaryReady ? onToggle : null,
      child: Container(
        width: 18,
        height: 18,
        margin: const EdgeInsets.only(top: 1),
        decoration: BoxDecoration(
          color: checked ? primary : Colors.transparent,
          border: Border.all(
              color: checked || isPartial ? primary : context.appColors.border),
          borderRadius: BorderRadius.circular(4),
        ),
        child: checked
            ? Icon(Icons.check,
                size: 12, color: Theme.of(context).colorScheme.onPrimary)
            : isPartial
                ? Center(
                    child: Container(
                      width: 6,
                      height: 6,
                      decoration:
                          BoxDecoration(color: primary, shape: BoxShape.circle),
                    ),
                  )
                : null,
      ),
    );
  }
}

class _SectionSeparator extends StatelessWidget {
  const _SectionSeparator({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final muted = context.appColors.mutedForeground;
    return Row(
      children: [
        Expanded(child: Divider(color: context.appColors.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 2,
              color: muted.withValues(alpha: 0.5),
            ),
          ),
        ),
        Expanded(child: Divider(color: context.appColors.border)),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
        child: Center(
          child: Text(
            text,
            style: TextStyle(color: context.appColors.mutedForeground),
          ),
        ),
      ),
    );
  }
}
