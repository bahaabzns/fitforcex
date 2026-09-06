import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/models/workout_log.dart';
import '../../../shared/models/workout_session.dart';
import '../../../shared/utils/exercise_tracking_types.dart' as tracking;
import '../../../shared/utils/format_amount.dart';
import '../../../shared/utils/localization.dart';
import '../../../shared/utils/workout.dart';
import 'coach_note_modal.dart';
import 'exercise_insights_modal.dart';
import 'exercise_notes_modal.dart';
import 'exercise_video.dart';

/// Reads one named field off a [PrescribedSet] — the coach's target, shown
/// either as a read-only column (tempo/rir/rpe) or as an editable field's
/// placeholder (duration/distance/incline/speed, reps).
String? _prescribedValue(PrescribedSet? target, String field) {
  if (target == null) return null;
  return switch (field) {
    'reps' => target.reps,
    'tempo' => target.tempo,
    'rir' => target.rir,
    'rpe' => target.rpe,
    'duration_seconds' => target.durationSeconds,
    'distance_km' => target.distanceKm,
    'incline_percent' => target.inclinePercent,
    'speed_kmh' => target.speedKmh,
    _ => null,
  };
}

/// Reads one named editable field off a [SessionSet] being logged.
String _setValue(SessionSet set, String field) => switch (field) {
      'weight' => set.weight,
      'reps' => set.reps,
      'duration_seconds' => set.durationSeconds,
      'distance_km' => set.distanceKm,
      'incline_percent' => set.inclinePercent,
      'speed_kmh' => set.speedKmh,
      _ => '',
    };

/// Weight has no prescribed counterpart — its placeholder stays "what the
/// client did last time". Every other editable field IS something the coach
/// set a target for on this set, so showing that target as the placeholder
/// tells the client what to aim for.
String _placeholderFor(
  String field,
  PrescribedSet? target,
  PreviousSet? previous,
) {
  if (field == 'weight') {
    return previous?.weight != null ? '${prettyAmount(previous!.weight!)}kg' : 'kg';
  }
  final raw = _prescribedValue(target, field);
  if (raw == null || raw.isEmpty) return '—';
  if (field == 'duration_seconds') {
    final secs = int.tryParse(raw);
    return secs != null ? formatClock(secs) : raw;
  }
  if (field == 'distance_km') return '${raw}km';
  if (field == 'incline_percent') return '$raw%';
  if (field == 'speed_kmh') return '${raw}km/h';
  return raw;
}

/// One exercise within a Training Mode session: a lazy video, per-set targets
/// shown alongside each row, and an editable grid of logged sets (previous ·
/// [logged fields] · [target fields] · done). Which fields are editable vs.
/// read-only targets is entirely the coach's choice (tracking_type +
/// tracked_metrics) — see shared/utils/exercise_tracking_types.dart.
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

  /// Index of the set whose first editable field should take keyboard focus
  /// once the set before it is marked done. Null outside of that moment.
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

  bool get _hasVideo =>
      (widget.exercise.youtubeUrl ?? '').isNotEmpty ||
      (widget.videoUrl ?? '').isNotEmpty;

  bool get _hasNote => widget.exercise.note.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final exercise = widget.exercise;
    final locale = Localizations.localeOf(context).languageCode;
    final exerciseName = localizedField(
      base: exercise.libraryNameEn ?? exercise.name,
      arabic: exercise.libraryNameAr,
      localeCode: locale,
    );
    final muscleGroup = localizedField(
      base: exercise.muscleGroup ?? '',
      arabic: exercise.muscleGroupAr,
      localeCode: locale,
    );
    final equipment = localizedField(
      base: exercise.equipment ?? '',
      arabic: exercise.equipmentAr,
      localeCode: locale,
    );

    final category = tracking.categoryOf(exercise.trackingType);
    // rest_seconds is prescribed (a base field, always) but never a
    // displayed column — it drives the rest timer, not a table cell.
    final editableFields = tracking
        .loggedFieldsFor(exercise.trackingType, exercise.trackedMetrics);
    final targetFields = tracking
        .targetOnlyFieldsFor(exercise.trackingType, exercise.trackedMetrics)
        .where((f) => f != 'rest_seconds')
        .toList();

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
                  Text(exerciseName,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (muscleGroup.isNotEmpty) _chip(context, muscleGroup),
                      if (equipment.isNotEmpty)
                        _chip(context, equipment,
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
                  exerciseName: exerciseName,
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
                  builder: (_) => ExerciseNotesModal(
                    initialValue: exercise.note,
                    exerciseLibraryId: exercise.exerciseLibraryId,
                    exerciseId: exercise.exerciseId,
                  ),
                );
                if (result != null) widget.onChangeNote(result);
              },
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Column headers
        _SetRow.header(
          l10n: l10n,
          muted: muted,
          editableFields: editableFields,
          targetFields: targetFields,
        ),
        const SizedBox(height: 4),
        for (var i = 0; i < exercise.sets.length; i++)
          _SetRow(
            index: i,
            set: exercise.sets[i],
            previous: previousSetFor(widget.previous, exercise.sets[i].setOrder),
            target:
                i < exercise.prescribed.length ? exercise.prescribed[i] : null,
            category: category,
            editableFields: editableFields,
            targetFields: targetFields,
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

/// A dynamic set row: # · previous · [editable logged fields] · [read-only
/// target fields] · done. Column set is entirely the coach's choice
/// (tracked_metrics), not whether a particular set happens to have a value.
/// Rest lives entirely in the floating [RestTimerBar] once a set completes —
/// it never occupies table space.
class _SetRow extends StatelessWidget {
  const _SetRow({
    required this.index,
    required this.set,
    required this.previous,
    required this.target,
    required this.category,
    required this.editableFields,
    required this.targetFields,
    required this.onChange,
    required this.onToggle,
    this.weightFocusNode,
  })  : isHeader = false,
        l10n = null,
        muted = null;

  const _SetRow.header({
    required this.l10n,
    required this.muted,
    required this.editableFields,
    required this.targetFields,
  })  : isHeader = true,
        index = 0,
        set = null,
        previous = null,
        target = null,
        category = tracking.setsReps,
        onChange = null,
        onToggle = null,
        weightFocusNode = null;

  final bool isHeader;
  final int index;
  final SessionSet? set;
  final PreviousSet? previous;
  final PrescribedSet? target;
  final String category;
  final List<String> editableFields;
  final List<String> targetFields;
  final void Function(String field, String value)? onChange;
  final VoidCallback? onToggle;
  final AppLocalizations? l10n;
  final Color? muted;

  /// Takes keyboard focus once the previous set is marked done — the row
  /// itself carries no visual "next up" treatment, just the moved focus.
  final FocusNode? weightFocusNode;

  @override
  Widget build(BuildContext context) {
    if (isHeader) {
      final style = TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
        color: muted!.withValues(alpha: 0.7),
      );
      Widget header(String label, {double? width}) {
        final text = Text(label.toUpperCase(),
            style: style, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis);
        return width != null
            ? SizedBox(width: width, child: text)
            : Expanded(child: text);
      }

      return Row(
        children: [
          header(l10n!.trainingSet, width: 24),
          const SizedBox(width: 4),
          header(l10n!.trainingPreviousShort),
          for (final field in editableFields)
            header(tracking.fieldLabel(l10n!, field)),
          for (final field in targetFields)
            header(tracking.fieldLabel(l10n!, field), width: 34),
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
    final previousText = previousSetLabel(previous, category);

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
            child: Text(previousText ?? '—',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w400,
                    color: mutedColor.withValues(alpha: 0.6)),
                overflow: TextOverflow.ellipsis),
          ),
          for (var i = 0; i < editableFields.length; i++)
            Expanded(
              child: _input(
                context,
                _setValue(s, editableFields[i]),
                _placeholderFor(editableFields[i], target, previous),
                editableFields[i],
                decimal: editableFields[i] != 'reps' &&
                    editableFields[i] != 'duration_seconds',
                focusNode: i == 0 ? weightFocusNode : null,
                plain: s.completed,
              ),
            ),
          for (final field in targetFields)
            SizedBox(
              width: 34,
              child: Text(
                _prescribedValue(target, field) ?? '—',
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
        keyboardType: TextInputType.numberWithOptions(
            decimal: decimal, signed: false),
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
