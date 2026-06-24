import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/access/access_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/collapsible_note.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/pill_tabs.dart';
import '../../l10n/generated/app_localizations.dart';
import '../access/restricted_view.dart';
import '../../shared/models/nutrition_plan.dart';
import '../../shared/utils/localization.dart';
import '../../shared/utils/nutrition_calc.dart';
import 'nutrition_repository.dart';
import 'widgets/macros_donut.dart';
import 'widgets/shopping_list_sheet.dart';

/// The client's active nutrition plan. Parity port of the web portal nutrition
/// page: macros donut, cycle tabs, collapsible coach notes, expandable meals
/// with checkable items + alternatives, and a shopping-list sheet.
class NutritionPage extends ConsumerWidget {
  const NutritionPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
  final _checkedItems = <String>{};

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final plan = widget.plan;
    final cycle = plan.cycles[_activeCycle.clamp(0, plan.cycles.length - 1)];
    final totals = calcCycle(cycle);

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 96),
          children: [
            Text(
              plan.name.isEmpty ? l10n.nutritionTitle : plan.name,
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
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
                  checkedItems: _checkedItems,
                  onToggleMeal: () => setState(() {
                    _expandedMeals.contains(meal.id)
                        ? _expandedMeals.remove(meal.id)
                        : _expandedMeals.add(meal.id);
                  }),
                  onToggleItem: (id) => setState(() {
                    _checkedItems.contains(id)
                        ? _checkedItems.remove(id)
                        : _checkedItems.add(id);
                  }),
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
    required this.checkedItems,
    required this.onToggleMeal,
    required this.onToggleItem,
  });

  final NutritionMeal meal;
  final String locale;
  final bool expanded;
  final Set<String> checkedItems;
  final VoidCallback onToggleMeal;
  final ValueChanged<String> onToggleItem;

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
                      checked: checkedItems.contains(item.id),
                      onToggle: () => onToggleItem(item.id),
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
    required this.checked,
    required this.onToggle,
  });

  final NutritionMealItem item;
  final String locale;
  final bool checked;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final macros = calcItem(item);
    final name = localizedField(
        base: item.name, arabic: item.nameAr, localeCode: locale);

    return Opacity(
      opacity: checked ? 0.4 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _checkbox(context),
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
                      Text(
                        '${_pretty(item.amount)}${item.servingUnit}',
                        style: TextStyle(fontSize: 11, color: muted),
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
                          '${localizedField(base: alt.name, arabic: alt.nameAr, localeCode: locale)} · ${_pretty(alt.amount)}${alt.servingUnit}',
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

  Widget _checkbox(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: onToggle,
      child: Container(
        width: 18,
        height: 18,
        margin: const EdgeInsets.only(top: 1),
        decoration: BoxDecoration(
          color: checked ? primary : Colors.transparent,
          border:
              Border.all(color: checked ? primary : context.appColors.border),
          borderRadius: BorderRadius.circular(4),
        ),
        child: checked
            ? Icon(Icons.check,
                size: 12, color: Theme.of(context).colorScheme.onPrimary)
            : null,
      ),
    );
  }

  String _pretty(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();
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
