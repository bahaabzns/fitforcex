import 'package:flutter/material.dart';

import '../../../l10n/generated/app_localizations.dart';

/// Per-exercise note editor, opened from the `edit_note` icon on the logging
/// card. Local draft only — Cancel discards, Save pops the new value.
///
/// Unlike [ExerciseInsightsModal] (a draggable, variable-height panel over
/// read-only content), this sheet holds a keyboard-driven text input, so it
/// deliberately sizes to its own content instead of a fixed screen fraction
/// and rides up with `viewInsets.bottom` as the keyboard opens/closes — the
/// same behavior as a chat app's message composer.
class ExerciseNotesModal extends StatefulWidget {
  const ExerciseNotesModal({super.key, required this.initialValue});

  final String initialValue;

  @override
  State<ExerciseNotesModal> createState() => _ExerciseNotesModalState();
}

class _ExerciseNotesModalState extends State<ExerciseNotesModal> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialValue);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    // The sheet's own height comes from its content (Column + mainAxisSize.min
    // below), so — unlike DraggableScrollableSheet — there's no separate
    // internal height animation for the keyboard inset to fight with. Only
    // the route's slide-up transition moves this widget, and that transition
    // doesn't change the field's position relative to its own Scrollable, so
    // plain `autofocus: true` is safe here.
    return AnimatedPadding(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        l10n.trainingExerciseNote,
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
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  minLines: 5,
                  maxLines: 10,
                  textInputAction: TextInputAction.newline,
                  decoration: InputDecoration(
                    hintText: l10n.trainingExerciseNotePlaceholder,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: Text(l10n.commonCancel),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () =>
                          Navigator.pop(context, _controller.text),
                      style: FilledButton.styleFrom(minimumSize: Size.zero),
                      child: Text(l10n.commonSave),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
