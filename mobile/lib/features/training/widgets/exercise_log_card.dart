import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../../../shared/models/workout_log.dart';
import '../../../shared/models/workout_session.dart';

const _successColor = Color(0xFF22C55E);

/// One exercise within a Training Mode session: prescribed target shown faintly,
/// plus an editable grid of logged sets (previous · weight · reps · RIR · done).
/// Port of the web `ExerciseLogCard`.
class ExerciseLogCard extends StatelessWidget {
  const ExerciseLogCard({
    super.key,
    required this.exercise,
    required this.previous,
    required this.index,
    required this.onChangeSet,
    required this.onToggleSet,
    required this.onAddSet,
    required this.onRemoveSet,
    required this.onChangeNote,
    required this.thumbnailUrl,
  });

  final SessionExercise exercise;
  final List<PreviousSet> previous;
  final int index;
  final String? thumbnailUrl;
  final void Function(int setIndex, String field, String value) onChangeSet;
  final void Function(int setIndex) onToggleSet;
  final VoidCallback onAddSet;
  final void Function(int setIndex) onRemoveSet;
  final ValueChanged<String> onChangeNote;

  String? _previousFor(int setOrder) {
    for (final p in previous) {
      if (p.setOrder == setOrder && p.weight != null && p.reps != null) {
        return '${_n(p.weight!)}×${_n(p.reps!)}';
      }
    }
    return null;
  }

  static String _n(double v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final primary = Theme.of(context).colorScheme.primary;
    final guidance =
        exercise.prescribed.isNotEmpty ? exercise.prescribed.first : null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _thumb(context, primary),
                const SizedBox(width: 12),
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
                          if (guidance != null)
                            Text(
                              '${l10n.trainingTarget}: ${guidance.reps ?? '—'} ${l10n.trainingRepsShort}'
                              '${guidance.restSeconds != null ? ' · ${guidance.restSeconds}s ${l10n.trainingRest.toLowerCase()}' : ''}',
                              style: TextStyle(fontSize: 11, color: muted),
                            ),
                        ],
                      ),
                    ],
                  ),
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
                onChange: (field, value) => onChangeSet(i, field, value),
                onToggle: () => onToggleSet(i),
              ),

            const SizedBox(height: 8),
            Row(
              children: [
                TextButton.icon(
                  onPressed: onAddSet,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: Icon(Icons.add, size: 14, color: primary),
                  label: Text(l10n.trainingAddSet,
                      style: TextStyle(fontSize: 12, color: primary)),
                ),
                if (exercise.sets.length > 1) ...[
                  const SizedBox(width: 16),
                  TextButton.icon(
                    onPressed: () => onRemoveSet(exercise.sets.length - 1),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    icon: Icon(Icons.close, size: 14, color: muted),
                    label: Text(l10n.trainingRemoveSet,
                        style: TextStyle(fontSize: 12, color: muted)),
                  ),
                ],
              ],
            ),

            const SizedBox(height: 8),
            TextFormField(
              initialValue: exercise.note,
              onChanged: onChangeNote,
              style: const TextStyle(fontSize: 12),
              decoration: InputDecoration(
                isDense: true,
                hintText: l10n.trainingExerciseNotePlaceholder,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _thumb(BuildContext context, Color primary) {
    return Container(
      width: 48,
      height: 48,
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: context.appColors.secondary,
        borderRadius: BorderRadius.circular(12),
      ),
      child: thumbnailUrl == null
          ? Text('#${index + 1}',
              style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.bold, color: primary))
          : Image.network(
              thumbnailUrl!,
              fit: BoxFit.cover,
              width: 48,
              height: 48,
              errorBuilder: (_, __, ___) => Text('#${index + 1}',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: primary)),
            ),
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

/// A 6-column set row: # · previous · weight · reps · RIR · done.
class _SetRow extends StatelessWidget {
  const _SetRow({
    required this.index,
    required this.set,
    required this.previous,
    required this.onChange,
    required this.onToggle,
  })  : isHeader = false,
        l10n = null,
        muted = null;

  const _SetRow.header({required this.l10n, required this.muted})
      : isHeader = true,
        index = 0,
        set = null,
        previous = null,
        onChange = null,
        onToggle = null;

  final bool isHeader;
  final int index;
  final SessionSet? set;
  final String? previous;
  final void Function(String field, String value)? onChange;
  final VoidCallback? onToggle;
  final AppLocalizations? l10n;
  final Color? muted;

  @override
  Widget build(BuildContext context) {
    if (isHeader) {
      final style = TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
        color: muted!.withValues(alpha: 0.7),
      );
      return Row(
        children: [
          SizedBox(width: 24, child: Text(l10n!.trainingSet, style: style)),
          const SizedBox(width: 6),
          Expanded(child: Text(l10n!.trainingPrevious, style: style)),
          Expanded(child: Text(l10n!.trainingWeight, style: style)),
          Expanded(child: Text(l10n!.trainingRepsShort, style: style)),
          Expanded(child: Text(l10n!.trainingRir, style: style)),
          const SizedBox(width: 36),
        ],
      );
    }

    final s = set!;
    final mutedColor = context.appColors.mutedForeground;
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 3),
      padding: const EdgeInsets.symmetric(vertical: 2),
      decoration: BoxDecoration(
        color: s.completed ? _successColor.withValues(alpha: 0.1) : null,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            child: Text('${index + 1}',
                style: TextStyle(fontSize: 12, color: mutedColor)),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(previous ?? '—',
                style: TextStyle(
                    fontSize: 12, color: mutedColor.withValues(alpha: 0.7)),
                overflow: TextOverflow.ellipsis),
          ),
          Expanded(
              child: _input(context, s.weight, 'kg', 'weight', decimal: true)),
          Expanded(child: _input(context, s.reps, '—', 'reps')),
          Expanded(child: _input(context, s.rir, '—', 'rir')),
          SizedBox(
            width: 36,
            child: Center(child: _doneButton(context, s.completed)),
          ),
        ],
      ),
    );
  }

  Widget _input(BuildContext context, String value, String hint, String field,
      {bool decimal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: TextFormField(
        initialValue: value,
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
        ),
      ),
    );
  }

  Widget _doneButton(BuildContext context, bool completed) {
    return GestureDetector(
      onTap: onToggle,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: completed ? _successColor : Colors.transparent,
          border: Border.all(
              color: completed ? _successColor : context.appColors.border),
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
