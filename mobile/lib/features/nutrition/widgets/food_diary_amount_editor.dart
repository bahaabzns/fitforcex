import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';

/// "How much of this did you eat?" bottom sheet — a stepper + direct-entry
/// field plus a one-tap "All of it" shortcut, opened from the amount label
/// beside a food-diary checklist item. Local draft only; returns the chosen
/// amount via `Navigator.pop`, or null if dismissed without choosing.
class FoodDiaryAmountEditor extends StatefulWidget {
  const FoodDiaryAmountEditor({
    super.key,
    required this.initialAmount,
    required this.prescribedAmount,
    required this.servingUnit,
  });

  final double initialAmount;
  final double prescribedAmount;
  final String servingUnit;

  static Future<double?> show(
    BuildContext context, {
    required double initialAmount,
    required double prescribedAmount,
    required String servingUnit,
  }) {
    return showModalBottomSheet<double>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => FoodDiaryAmountEditor(
        initialAmount: initialAmount,
        prescribedAmount: prescribedAmount,
        servingUnit: servingUnit,
      ),
    );
  }

  @override
  State<FoodDiaryAmountEditor> createState() => _FoodDiaryAmountEditorState();
}

class _FoodDiaryAmountEditorState extends State<FoodDiaryAmountEditor> {
  late double _amount = widget.initialAmount;
  late final TextEditingController _controller =
      TextEditingController(text: _pretty(_amount));

  void _setAmount(double value) {
    final clamped = value < 0 ? 0.0 : value;
    setState(() {
      _amount = clamped;
      _controller.text = _pretty(clamped);
    });
  }

  static String _pretty(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return AnimatedPadding(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  l10n.nutritionFoodDiaryHowMuchEaten,
                  style: TextStyle(fontSize: 14, color: context.appColors.mutedForeground),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    IconButton(
                      onPressed: () => _setAmount(_amount - 1),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        autofocus: true,
                        textAlign: TextAlign.center,
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (v) => _amount = double.tryParse(v) ?? _amount,
                        onSubmitted: (v) => _setAmount(double.tryParse(v) ?? _amount),
                        decoration: InputDecoration(
                          suffixText: widget.servingUnit,
                          isDense: true,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => _setAmount(_amount + 1),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => _setAmount(widget.prescribedAmount),
                  child: Text(l10n.nutritionFoodDiaryFullAmount),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => Navigator.pop(
                    context,
                    double.tryParse(_controller.text) ?? _amount,
                  ),
                  child: Text(l10n.commonSave),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
