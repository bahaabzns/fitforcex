import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Horizontally scrollable pill tabs — the portal's cycle/day/filter selector.
/// RTL is handled automatically by the surrounding [Directionality].
class PillTabs extends StatelessWidget {
  const PillTabs({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
    this.center = true,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  /// Center the row when it fits; left-align (scroll) when it overflows.
  final bool center;

  @override
  Widget build(BuildContext context) {
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          _Pill(
            label: labels[i],
            selected: i == selectedIndex,
            onTap: () => onSelected(i),
          ),
        ],
      ],
    );

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: center
          ? ConstrainedBox(
              constraints: BoxConstraints(
                minWidth: MediaQuery.sizeOf(context).width - 8,
              ),
              child: Center(child: row),
            )
          : row,
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = context.appColors.mutedForeground;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? scheme.primary : Colors.transparent,
          border: Border.all(
            color: selected ? scheme.primary : context.appColors.border,
          ),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: selected ? scheme.onPrimary : muted,
          ),
        ),
      ),
    );
  }
}
