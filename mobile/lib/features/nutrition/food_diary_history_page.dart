import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' hide TextDirection;

import '../../core/theme/app_theme.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/empty_state.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/food_diary.dart';
import '../../shared/utils/adherence.dart';
import '../../shared/utils/format_amount.dart';
import '../../shared/utils/localization.dart';
import 'food_diary_repository.dart';

/// Every day's food-diary snapshot, most recent first — expand a day to see
/// its macro totals against that day's goals and which items were eaten.
/// Port of the web `nutrition/diary` page.
class FoodDiaryHistoryPage extends ConsumerWidget {
  const FoodDiaryHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final history = ref.watch(foodDiaryHistoryProvider);

    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.pop()),
        title: Text(l10n.nutritionFoodDiaryHistoryTitle),
      ),
      body: AsyncValueWidget<List<FoodDiaryEntry>>(
        value: history,
        onRetry: () => ref.invalidate(foodDiaryHistoryProvider),
        data: (entries) {
          if (entries.isEmpty) {
            return EmptyState(
              icon: Icons.menu_book_outlined,
              title: l10n.nutritionFoodDiaryNoEntries,
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(24),
            itemCount: entries.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) => _EntryTile(entry: entries[i]),
          );
        },
      ),
    );
  }
}

class _EntryTile extends StatefulWidget {
  const _EntryTile({required this.entry});
  final FoodDiaryEntry entry;

  @override
  State<_EntryTile> createState() => _EntryTileState();
}

class _EntryTileState extends State<_EntryTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final muted = context.appColors.mutedForeground;
    final entry = widget.entry;
    final date = DateTime.tryParse(entry.date);
    final dateLabel =
        date != null ? DateFormat.yMMMEd(locale).format(date) : entry.date;

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(dateLabel,
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Directionality(
                          textDirection: TextDirection.ltr,
                          child: Text(
                            '${entry.totalCalories.round()} ${l10n.nutritionFoodDiaryCalories}',
                            style: TextStyle(fontSize: 11, color: muted),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    entry.adherence != null
                        ? '${entry.adherence}%'
                        : l10n.nutritionFoodDiaryNoGoalSet,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: adherenceColor(context, entry.adherence),
                    ),
                  ),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(Icons.keyboard_arrow_down, size: 18, color: muted),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Divider(color: context.appColors.border),
                  const SizedBox(height: 8),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Row(
                      children: [
                        Expanded(
                          child: _Macro(
                            label: l10n.nutritionFoodDiaryCalories,
                            value: entry.totalCalories,
                            goal: entry.goalCalories,
                          ),
                        ),
                        Expanded(
                          child: _Macro(
                            label: l10n.nutritionProtein,
                            value: entry.totalProtein,
                            goal: entry.goalProtein,
                          ),
                        ),
                        Expanded(
                          child: _Macro(
                            label: l10n.nutritionCarbs,
                            value: entry.totalCarbs,
                            goal: entry.goalCarbs,
                          ),
                        ),
                        Expanded(
                          child: _Macro(
                            label: l10n.nutritionFat,
                            value: entry.totalFats,
                            goal: entry.goalFats,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  for (final item in entry.items)
                    Opacity(
                      opacity: item.prescribedAmount > 0 &&
                              item.amountEaten >= item.prescribedAmount
                          ? 1
                          : 0.5,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                localizedField(
                                  base: item.nameEn ?? '',
                                  arabic: item.nameAr,
                                  localeCode: locale,
                                ),
                                style: const TextStyle(fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Directionality(
                              textDirection: TextDirection.ltr,
                              child: Text(
                                '${prettyAmount(item.amountEaten)}/${prettyAmount(item.prescribedAmount)}${item.servingUnit ?? ''}',
                                style: TextStyle(fontSize: 11, color: muted),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Macro extends StatelessWidget {
  const _Macro({required this.label, required this.value, this.goal});

  final String label;
  final double value;
  final double? goal;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final valueText = value.round().toString();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: TextStyle(fontSize: 9, color: muted.withValues(alpha: 0.7))),
        Text(
          goal != null
              ? l10n.nutritionFoodDiaryGoalOf(valueText, goal!.round().toString())
              : valueText,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}
