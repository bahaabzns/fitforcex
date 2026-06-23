import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/models/nutrition_plan.dart';

/// Bottom sheet that aggregates plan items into a shopping list, scaled by a
/// per-cycle "days" multiplier. Port of the web `ShoppingListDrawer`.
class ShoppingListSheet extends StatefulWidget {
  const ShoppingListSheet({super.key, required this.plan});

  final NutritionPlan plan;

  static Future<void> show(BuildContext context, NutritionPlan plan) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => ShoppingListSheet(plan: plan),
    );
  }

  @override
  State<ShoppingListSheet> createState() => _ShoppingListSheetState();
}

class _ShoppingListItem {
  _ShoppingListItem(this.name, this.servingUnit);
  final String name;
  final String servingUnit;
  double amount = 0;
}

class _ShoppingListSheetState extends State<ShoppingListSheet> {
  late final Map<String, int> _cycleDays = {
    for (final c in widget.plan.cycles) c.id: 1,
  };

  void _adjust(String cycleId, int delta) {
    setState(() {
      final next = (_cycleDays[cycleId] ?? 1) + delta;
      _cycleDays[cycleId] = next.clamp(0, 14);
    });
  }

  List<_ShoppingListItem> _build() {
    final totals = <String, _ShoppingListItem>{};
    for (final cycle in widget.plan.cycles) {
      final days = _cycleDays[cycle.id] ?? 0;
      if (days == 0) continue;
      for (final meal in cycle.meals) {
        for (final item in meal.items) {
          final key = '${item.name}||${item.servingUnit}';
          final entry = totals.putIfAbsent(
              key, () => _ShoppingListItem(item.name, item.servingUnit));
          entry.amount += item.amount * days;
        }
      }
    }
    final list = totals.values.toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final items = _build();

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Row(
                children: [
                  Icon(Icons.shopping_cart,
                      size: 20, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Text(
                    l10n.shoppingTitle,
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Flexible(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                children: [
                  _sectionLabel(l10n.shoppingCyclesTitle, muted),
                  const SizedBox(height: 8),
                  for (final cycle in widget.plan.cycles)
                    _cycleRow(cycle, l10n, muted),
                  const SizedBox(height: 24),
                  _sectionLabel(l10n.shoppingItemsTitle, muted),
                  const SizedBox(height: 8),
                  if (items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Center(
                        child: Text(
                          l10n.shoppingEmpty,
                          style: TextStyle(fontSize: 14, color: muted),
                        ),
                      ),
                    )
                  else
                    for (final item in items) _itemRow(item, context),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text, Color muted) => Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.5,
          color: muted.withValues(alpha: 0.7),
        ),
      );

  Widget _cycleRow(NutritionCycle cycle, AppLocalizations l10n, Color muted) {
    final days = _cycleDays[cycle.id] ?? 1;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              cycle.name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              children: [
                _stepBtn(Icons.remove,
                    days == 0 ? null : () => _adjust(cycle.id, -1)),
                SizedBox(
                  width: 28,
                  child: Text(
                    '$days',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                ),
                _stepBtn(
                    Icons.add, days >= 14 ? null : () => _adjust(cycle.id, 1)),
                const SizedBox(width: 6),
                Text(l10n.shoppingDays,
                    style: TextStyle(fontSize: 12, color: muted)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stepBtn(IconData icon, VoidCallback? onTap) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: context.appColors.border),
        ),
        child: Icon(
          icon,
          size: 14,
          color: onTap == null
              ? context.appColors.mutedForeground.withValues(alpha: 0.3)
              : context.appColors.mutedForeground,
        ),
      ),
    );
  }

  Widget _itemRow(_ShoppingListItem item, BuildContext context) {
    final display = double.parse(item.amount.toStringAsFixed(1));
    final pretty = display == display.roundToDouble()
        ? display.toInt().toString()
        : display.toString();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
              child: Text(item.name, style: const TextStyle(fontSize: 14))),
          Text(
            '$pretty${item.servingUnit}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }
}
