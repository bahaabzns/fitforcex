import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/models/workout_log.dart';
import '../../../shared/models/workout_session.dart';
import 'coach_note_modal.dart';
import 'exercise_insights_modal.dart';
import 'exercise_notes_modal.dart';
import 'exercise_video.dart';

String _n(double v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// One exercise within a Training Mode session: a lazy video, per-set targets
/// shown alongside each row, and an editable grid of logged sets (previous ·
/// weight · reps · done). Set structure is fixed by the coach's plan — the
/// client logs the assigned workout only, matching the web `ExerciseLogCard`.
class ExerciseLogCard extends StatefulWidget {
  const ExerciseLogCard({
    super.key,
    required this.exercise,
    required this.previous,
    required this.onChangeSet,
    required this.onToggleSet,
    required this.onChangeNote,
    required this.videoUrl,
    this.focusSetIndex,
  });

  final SessionExercise exercise;
  final List<PreviousSet> previous;
  final String? videoUrl;

  /// Index of the set whose weight field should take keyboard focus once
  /// the set before it is marked done. Null outside of that moment.
  final int? focusSetIndex;
  final void Function(int setIndex, String field, String value) onChangeSet;
  final void Function(int setIndex) onToggleSet;
  final ValueChanged<String> onChangeNote;

  @override
  State<ExerciseLogCard> createState() => _ExerciseLogCardState();
}

class _ExerciseLogCardState extends State<ExerciseLogCard> {
  late List<FocusNode> _weightFocusNodes =
      List.generate(widget.exercise.sets.length, (_) => FocusNode());

  @override
  void didUpdateWidget(covariant ExerciseLogCard oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.exercise.sets.length != _weightFocusNodes.length) {
      for (final node in _weightFocusNodes) {
        node.dispose();
      }
      _weightFocusNodes =
          List.generate(widget.exercise.sets.length, (_) => FocusNode());
    }

    final target = widget.focusSetIndex;
    if (target != null &&
        target != oldWidget.focusSetIndex &&
        target >= 0 &&
        target < _weightFocusNodes.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _weightFocusNodes[target].requestFocus();
      });
    }
  }

  @override
  void dispose() {
    for (final node in _weightFocusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  PreviousSet? _previousFor(int setOrder) {
    for (final p in widget.previous) {
      if (p.setOrder == setOrder && p.weight != null && p.reps != null) {
        return p;
      }
    }
    return null;
  }

  bool get _hasVideo =>
      (widget.exercise.youtubeUrl ?? '').isNotEmpty ||
      (widget.videoUrl ?? '').isNotEmpty;

  bool get _hasNote => widget.exercise.note.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final exercise = widget.exercise;

    // Flat, borderless layout (Strong-style) — exercises are separated by the
    // list's own spacing/dividers rather than a card container, so the video,
    // header and table read as one continuous section.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_hasVideo) ...[
          ExerciseVideo(
            youtubeUrl: exercise.youtubeUrl,
            videoUrl: widget.videoUrl,
          ),
          const SizedBox(height: 12),
        ],

        // Header
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(exercise.name,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if ((exercise.muscleGroup ?? '').isNotEmpty)
                        _chip(context, exercise.muscleGroup!),
                      if ((exercise.equipment ?? '').isNotEmpty)
                        _chip(context, exercise.equipment!,
                            color: const Color(0xFF8B5CF6)),
                    ],
                  ),
                ],
              ),
            ),
            _IconAction(
              icon: Icons.show_chart,
              tooltip: l10n.trainingInsights,
              onTap: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                useSafeArea: true,
                builder: (_) => ExerciseInsightsModal(
                  exerciseLibraryId: exercise.exerciseLibraryId,
                  exerciseId: exercise.exerciseId,
                  exerciseName: exercise.name,
                ),
              ),
            ),
            _IconAction(
              icon: Icons.menu_book_outlined,
              tooltip: l10n.trainingCoachNote,
              onTap: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                useSafeArea: true,
                builder: (_) => CoachNoteModal(
                  instructionsEn: exercise.instructionsEn,
                  instructionsAr: exercise.instructionsAr,
                ),
              ),
            ),
            _IconAction(
              icon: Icons.edit_note,
              tooltip: l10n.trainingExerciseNote,
              highlighted: _hasNote,
              onTap: () async {
                final result = await showModalBottomSheet<String>(
                  context: context,
                  isScrollControlled: true,
                  useSafeArea: true,
                  builder: (_) =>
                      ExerciseNotesModal(initialValue: exercise.note),
                );
                if (result != null) widget.onChangeNote(result);
              },
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Column headers
        _SetRow.header(l10n: l10n, muted: muted),
        const SizedBox(height: 4),
        for (var i = 0; i < exercise.sets.length; i++)
          _SetRow(
            index: i,
            set: exercise.sets[i],
            previous: _previousFor(exercise.sets[i].setOrder),
            target:
                i < exercise.prescribed.length ? exercise.prescribed[i] : null,
            weightFocusNode: _weightFocusNodes[i],
            onChange: (field, value) => widget.onChangeSet(i, field, value),
            onToggle: () => widget.onToggleSet(i),
          ),
      ],
    );
  }

  Widget _chip(BuildContext context, String label, {Color? color}) {
    final c = color ?? context.appColors.mutedForeground;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: TextStyle(fontSize: 11, color: c)),
    );
  }
}

class _IconAction extends StatelessWidget {
  const _IconAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.highlighted = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final color = highlighted
        ? Theme.of(context).colorScheme.primary
        : context.appColors.mutedForeground;
    return Tooltip(
      message: tooltip,
      child: IconButton(
        onPressed: onTap,
        icon: Icon(icon, size: 18, color: color),
        visualDensity: VisualDensity.compact,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      ),
    );
  }
}

/// A 5-column set row: # · previous · weight · reps (target as hint) ·
/// RIR-target (read-only) · done. Rest lives entirely in the floating
/// [RestTimerBar] once a set completes — it never occupies table space.
class _SetRow extends StatelessWidget {
  const _SetRow({
    required this.index,
    required this.set,
    required this.previous,
    required this.target,
    required this.onChange,
    required this.onToggle,
    this.weightFocusNode,
  })  : isHeader = false,
        l10n = null,
        muted = null;

  const _SetRow.header({required this.l10n, required this.muted})
      : isHeader = true,
        index = 0,
        set = null,
        previous = null,
        target = null,
        onChange = null,
        onToggle = null,
        weightFocusNode = null;

  final bool isHeader;
  final int index;
  final SessionSet? set;
  final PreviousSet? previous;
  final PrescribedSet? target;
  final void Function(String field, String value)? onChange;
  final VoidCallback? onToggle;
  final AppLocalizations? l10n;
  final Color? muted;

  /// Takes keyboard focus once the previous set is marked done — the row
  /// itself carries no visual "next up" treatment, just the moved focus.
  final FocusNode? weightFocusNode;

  String? get _previousText => previous == null
      ? null
      : '${_n(previous!.weight!)}kg × ${_n(previous!.reps!)}';

  @override
  Widget build(BuildContext context) {
    if (isHeader) {
      final style = TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
        color: muted!.withValues(alpha: 0.7),
      );
      Widget header(String label, {int? flex, double? width}) {
        final text = Text(label.toUpperCase(),
            style: style, textAlign: TextAlign.center);
        return width != null
            ? SizedBox(width: width, child: text)
            : Expanded(flex: flex ?? 1, child: text);
      }

      return Row(
        children: [
          header(l10n!.trainingSet, width: 24),
          const SizedBox(width: 4),
          // Previous, Weight and Reps share the row equally.
          header(l10n!.trainingPreviousShort, flex: 1),
          header(l10n!.trainingWeight, flex: 1),
          header(l10n!.trainingRepsShort, flex: 1),
          header(l10n!.trainingRir, width: 32),
          SizedBox(
            width: 32,
            child: Icon(Icons.check, size: 14, color: style.color),
          ),
        ],
      );
    }

    final s = set!;
    final mutedColor = context.appColors.mutedForeground;
    final success = context.appColors.success;
    final weightHint = previous != null ? '${_n(previous!.weight!)}kg' : 'kg';
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      padding: const EdgeInsets.symmetric(vertical: 1),
      decoration: BoxDecoration(
        color: s.completed ? success.withValues(alpha: 0.1) : null,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            child: Text('${index + 1}',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: mutedColor)),
          ),
          const SizedBox(width: 4),
          Expanded(
            flex: 1,
            child: Text(_previousText ?? '—',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w400,
                    color: mutedColor.withValues(alpha: 0.6)),
                overflow: TextOverflow.ellipsis),
          ),
          Expanded(
              flex: 1,
              child: _input(context, s.weight, weightHint, 'weight',
                  decimal: true,
                  focusNode: weightFocusNode,
                  plain: s.completed)),
          Expanded(
              flex: 1,
              child: _input(context, s.reps, target?.reps ?? '—', 'reps',
                  plain: s.completed)),
          SizedBox(
            width: 32,
            child: Text(
              target?.rir ?? '—',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: mutedColor),
            ),
          ),
          SizedBox(
            width: 32,
            child: Center(child: _doneButton(context, s.completed, success)),
          ),
        ],
      ),
    );
  }

  Widget _input(BuildContext context, String value, String hint, String field,
      {bool decimal = false, FocusNode? focusNode, bool plain = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: TextFormField(
        initialValue: value,
        focusNode: focusNode,
        onChanged: (v) => onChange!(field, v),
        textAlign: TextAlign.center,
        keyboardType:
            TextInputType.numberWithOptions(decimal: decimal, signed: false),
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          isDense: true,
          hintText: hint,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          filled: !plain,
          border: plain ? InputBorder.none : null,
          enabledBorder: plain ? InputBorder.none : null,
          focusedBorder: plain ? InputBorder.none : null,
        ),
      ),
    );
  }

  Widget _doneButton(BuildContext context, bool completed, Color success) {
    return GestureDetector(
      onTap: onToggle,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: completed ? success : Colors.transparent,
          border: Border.all(
              color: completed ? success : context.appColors.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          Icons.check,
          size: 16,
          color: completed ? Colors.white : context.appColors.mutedForeground,
        ),
      ),
    );
  }
}
