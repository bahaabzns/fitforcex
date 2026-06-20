import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The portal's collapsible coach/day note card: a colored, rounded container
/// with a tappable header (label + first-line preview) that expands the body.
class CollapsibleNote extends StatefulWidget {
  const CollapsibleNote({
    super.key,
    required this.label,
    required this.body,
    this.color,
  });

  final String label;
  final String body;

  /// Defaults to the warning/amber accent (coach note). Pass primary for day note.
  final Color? color;

  @override
  State<CollapsibleNote> createState() => _CollapsibleNoteState();
}

class _CollapsibleNoteState extends State<CollapsibleNote> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final accent = widget.color ?? context.appColors.warning;
    final firstLine = widget.body.split('\n').first;

    return Container(
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.10),
        border: Border.all(color: accent.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(24),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.label.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: accent,
                          ),
                        ),
                        if (!_expanded)
                          Text(
                            firstLine,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12,
                              color: accent.withValues(alpha: 0.7),
                            ),
                          ),
                      ],
                    ),
                  ),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(Icons.keyboard_arrow_down, size: 18, color: accent),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text(
                widget.body,
                style: TextStyle(fontSize: 14, color: accent),
              ),
            ),
        ],
      ),
    );
  }
}
