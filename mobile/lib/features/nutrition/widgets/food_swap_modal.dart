import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/models/food_swap.dart';
import '../../../shared/utils/localization.dart';
import '../food_swap_repository.dart';

String _prettyAmount(double v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// Client-facing food swap: search is backend-driven and every candidate
/// arrives with its equivalent grams + macros already computed server-side.
/// Port of the web `FoodSwapModal.js`.
class FoodSwapModal extends ConsumerStatefulWidget {
  const FoodSwapModal({
    super.key,
    required this.mealItemId,
    required this.currentFoodName,
  });

  final String mealItemId;
  final String currentFoodName;

  static Future<bool?> show(
    BuildContext context, {
    required String mealItemId,
    required String currentFoodName,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => FoodSwapModal(
        mealItemId: mealItemId,
        currentFoodName: currentFoodName,
      ),
    );
  }

  @override
  ConsumerState<FoodSwapModal> createState() => _FoodSwapModalState();
}

class _FoodSwapModalState extends ConsumerState<FoodSwapModal> {
  final _queryController = TextEditingController();
  Timer? _debounce;
  List<FoodSwapAlternative> _alternatives = [];
  bool _loading = false;
  String? _searchError;
  FoodSwapAlternative? _selected;
  bool _confirming = false;
  String? _confirmError;

  @override
  void initState() {
    super.initState();
    unawaited(_search(''));
    _queryController.addListener(() {
      _debounce?.cancel();
      _debounce = Timer(
          const Duration(milliseconds: 300), () => _search(_queryController.text));
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    setState(() {
      _loading = true;
      _searchError = null;
    });
    try {
      final results = await ref
          .read(foodSwapRepositoryProvider)
          .search(widget.mealItemId, query: query);
      if (mounted) setState(() => _alternatives = results);
    } catch (e) {
      if (mounted) {
        final l10n = AppLocalizations.of(context);
        setState(() {
          _searchError =
              e is ApiException ? e.message : l10n.nutritionSwapSearchFailed;
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirm() async {
    final selected = _selected;
    if (selected == null) return;
    final l10n = AppLocalizations.of(context);
    setState(() {
      _confirming = true;
      _confirmError = null;
    });
    try {
      await ref
          .read(foodSwapRepositoryProvider)
          .swap(widget.mealItemId, selected.foodItemId);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _confirming = false;
          _confirmError =
              e is ApiException ? e.message : l10n.nutritionSwapFailed;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final muted = context.appColors.mutedForeground;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.nutritionSwapTitle(widget.currentFoodName),
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _queryController,
                autofocus: true,
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search, size: 20),
                  hintText: l10n.nutritionSwapSearchPlaceholder,
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 320),
                child: _loading
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                            child: Text(l10n.nutritionSwapSearching,
                                style: TextStyle(color: muted))),
                      )
                    : _searchError != null
                        ? Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24),
                            child: Center(
                              child: Text(_searchError!,
                                  style: TextStyle(
                                      color:
                                          Theme.of(context).colorScheme.error)),
                            ),
                          )
                        : _alternatives.isEmpty
                            ? Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 24),
                                child: Center(
                                    child: Text(l10n.nutritionSwapNoResults,
                                        style: TextStyle(color: muted))),
                              )
                            : ListView.separated(
                                shrinkWrap: true,
                                itemCount: _alternatives.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (_, i) => _AlternativeTile(
                                  alternative: _alternatives[i],
                                  locale: locale,
                                  selected:
                                      _selected?.foodItemId == _alternatives[i].foodItemId,
                                  onTap: () =>
                                      setState(() => _selected = _alternatives[i]),
                                ),
                              ),
              ),
              if (_selected != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: Theme.of(context)
                        .colorScheme
                        .primary
                        .withValues(alpha: 0.06),
                    border: Border.all(
                        color: Theme.of(context)
                            .colorScheme
                            .primary
                            .withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.nutritionSwapEquivalentTo.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${localizedField(base: _selected!.name, arabic: _selected!.nameAr, localeCode: locale)} — ${_prettyAmount(_selected!.calculatedAmount)}${_selected!.servingUnit}',
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ],
              if (_confirmError != null) ...[
                const SizedBox(height: 8),
                Text(_confirmError!,
                    style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed:
                        _confirming ? null : () => Navigator.pop(context),
                    child: Text(l10n.commonCancel),
                  ),
                  const SizedBox(width: 4),
                  FilledButton(
                    style:
                        FilledButton.styleFrom(minimumSize: const Size(64, 40)),
                    onPressed: (_selected == null || _confirming)
                        ? null
                        : _confirm,
                    child: Text(_confirming
                        ? l10n.nutritionSwapConfirming
                        : l10n.nutritionSwapConfirm),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AlternativeTile extends StatelessWidget {
  const _AlternativeTile({
    required this.alternative,
    required this.locale,
    required this.selected,
    required this.onTap,
  });

  final FoodSwapAlternative alternative;
  final String locale;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final primary = Theme.of(context).colorScheme.primary;
    final name = localizedField(
        base: alternative.name, arabic: alternative.nameAr, localeCode: locale);
    final category = alternative.foodCategory == null
        ? null
        : localizedField(
            base: alternative.foodCategory!,
            arabic: alternative.foodCategoryAr,
            localeCode: locale,
          );

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: selected ? primary : context.appColors.border),
          color: selected ? primary.withValues(alpha: 0.05) : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(name,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w500)),
                ),
                if (category != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: context.appColors.secondary,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(category,
                        style: TextStyle(fontSize: 10, color: muted)),
                  ),
              ],
            ),
            if (!alternative.isCalorieMatched)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(l10n.nutritionSwapNotCalorieMatched,
                    style: TextStyle(
                        fontSize: 10, color: context.appColors.warning)),
              ),
            const SizedBox(height: 4),
            Directionality(
              textDirection: TextDirection.ltr,
              child: Wrap(
                spacing: 10,
                children: [
                  Text(
                      '${_prettyAmount(alternative.calculatedAmount)}${alternative.servingUnit}',
                      style: TextStyle(fontSize: 11, color: muted)),
                  Text('${alternative.calories.round()} ${l10n.nutritionKcal}',
                      style: TextStyle(fontSize: 11, color: muted)),
                  Text(
                      '${l10n.nutritionProteinAbbr} ${alternative.protein.round()}g',
                      style: TextStyle(fontSize: 11, color: muted)),
                  Text('${l10n.nutritionCarbsAbbr} ${alternative.carbs.round()}g',
                      style: TextStyle(fontSize: 11, color: muted)),
                  Text('${l10n.nutritionFatAbbr} ${alternative.fat.round()}g',
                      style: TextStyle(fontSize: 11, color: muted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
