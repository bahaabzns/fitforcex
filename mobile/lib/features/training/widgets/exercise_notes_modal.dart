import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../workout_repository.dart';

/// Per-exercise note editor, opened from the `edit_note` icon on the logging
/// card. Local draft only — Cancel discards, Save pops the new value. Below
/// the input, "Previous Notes" lists notes from past sessions of this same
/// exercise — the same recent-sessions data the Insights modal charts,
/// filtered down to entries that actually have one.
///
/// Unlike [ExerciseInsightsModal] (a draggable, variable-height panel over
/// read-only content), this sheet holds a keyboard-driven text input, so it
/// deliberately sizes to its own content instead of a fixed screen fraction
/// and rides up with `viewInsets.bottom` as the keyboard opens/closes — the
/// same behavior as a chat app's message composer.
class ExerciseNotesModal extends ConsumerStatefulWidget {
  const ExerciseNotesModal({
    super.key,
    required this.initialValue,
    required this.exerciseLibraryId,
    required this.exerciseId,
  });

  final String initialValue;
  final String? exerciseLibraryId;
  final String exerciseId;

  @override
  ConsumerState<ExerciseNotesModal> createState() =>
      _ExerciseNotesModalState();
}

class _ExerciseNotesModalState extends ConsumerState<ExerciseNotesModal> {
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
              _PreviousNotes(
                exerciseLibraryId: widget.exerciseLibraryId,
                exerciseId: widget.exerciseId,
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

class _PreviousNotes extends ConsumerWidget {
  const _PreviousNotes({
    required this.exerciseLibraryId,
    required this.exerciseId,
  });

  final String? exerciseLibraryId;
  final String exerciseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final insights = ref.watch(
      exerciseInsightsProvider((libraryId: exerciseLibraryId, exerciseId: exerciseId)),
    );

    return insights.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Center(
            child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2))),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (data) {
        final notedSessions =
            data.recentSessions.where((s) => (s.note ?? '').trim().isNotEmpty).toList();
        if (notedSessions.isEmpty) return const SizedBox.shrink();

        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.trainingPreviousNotes.toUpperCase(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                  color: context.appColors.mutedForeground,
                ),
              ),
              const SizedBox(height: 4),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 180),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const ClampingScrollPhysics(),
                  itemCount: notedSessions.length,
                  separatorBuilder: (_, __) => Divider(
                      height: 1, color: context.appColors.border.withValues(alpha: 0.5)),
                  itemBuilder: (context, i) {
                    final session = notedSessions[i];
                    final date = DateTime.tryParse(session.date);
                    final locale = Localizations.localeOf(context).toString();
                    final dateLabel = date != null
                        ? DateFormat.yMMMd(locale).format(date)
                        : session.date;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(dateLabel,
                              style: TextStyle(
                                  fontSize: 11,
                                  color: context.appColors.mutedForeground
                                      .withValues(alpha: 0.7))),
                          const SizedBox(height: 2),
                          Text(session.note!, style: const TextStyle(fontSize: 13)),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
