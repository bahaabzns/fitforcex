import 'package:flutter/material.dart';

/// The rounded, elevated, primary-colored pill used for a screen's single
/// floating call-to-action (Training's Start/Continue, Nutrition's shopping
/// list). One shared shape so every such button is guaranteed the same size
/// — hand-matching padding/border-radius across screens drifts silently.
class FloatingPill extends StatelessWidget {
  const FloatingPill({super.key, required this.child, required this.onTap});

  final Widget child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: DefaultTextStyle.merge(
        style: TextStyle(color: Theme.of(context).colorScheme.onPrimary),
        child: IconTheme.merge(
          data: IconThemeData(color: Theme.of(context).colorScheme.onPrimary),
          child: child,
        ),
      ),
    );
    return Material(
      color: Theme.of(context).colorScheme.primary,
      borderRadius: BorderRadius.circular(20),
      elevation: 4,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: content,
      ),
    );
  }
}

/// The `Row(icon + label)` content shape shared by every single-line
/// [FloatingPill] (as opposed to Training's two-line Continue trigger,
/// which builds its own child directly).
class FloatingPillLabel extends StatelessWidget {
  const FloatingPillLabel({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
