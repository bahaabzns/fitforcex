import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_controller.dart';
import '../../core/config/providers.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/training_plan.dart';
import '../../shared/models/workout_log.dart';
import '../../shared/models/workout_session.dart';
import '../../shared/utils/media_url.dart';
import '../../shared/utils/workout.dart';
import '../access/restricted_view.dart';
import 'session_store.dart';
import 'training_repository.dart';
import 'widgets/exercise_log_card.dart';
import 'widgets/rest_timer_bar.dart';
import 'workout_repository.dart';

const _defaultRest = 90;

/// Training Mode: live set logging with a rest timer, resumable across restarts
/// (shared_preferences draft). Port of the web training/session page.
class SessionPage extends ConsumerStatefulWidget {
  const SessionPage({super.key, required this.dayIndex});

  final int dayIndex;

  @override
  ConsumerState<SessionPage> createState() => _SessionPageState();
}

class _SessionPageState extends ConsumerState<SessionPage> {
  WorkoutSession? _session;
  Map<String, List<PreviousSet>> _previous = {};
  Map<String, String?> _videoUrls = {}; // exerciseId -> resolved video_path url
  bool _loading = true;
  bool _saving = false;

  Timer? _ticker;
  int _nowMs = DateTime.now().millisecondsSinceEpoch;

  int? _restStartMs;
  int _restTarget = 0;
  ({int exIdx, int setIdx, int atMs})? _lastCompletion;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _nowMs = DateTime.now().millisecondsSinceEpoch;
        // Rest panel is the single source of truth for rest — once the
        // countdown reaches zero it collapses itself instead of waiting
        // for the client to tap Skip.
        if (_restStartMs != null &&
            _restTarget - (_nowMs - _restStartMs!) / 1000 <= 0) {
          _restStartMs = null;
        }
      });
    });
    unawaited(_load());
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final baseUrl = ref.read(appConfigProvider).apiBaseUrl;
    try {
      final plan = await ref.read(trainingRepositoryProvider).fetchActivePlan();
      final day = (plan != null && widget.dayIndex < plan.days.length)
          ? plan.days[widget.dayIndex]
          : null;
      if (day == null || day.exercises.isEmpty) {
        _exit();
        return;
      }

      _previous =
          await ref.read(workoutRepositoryProvider).fetchPrevious(day.id);
      _videoUrls = {
        for (final ex in day.exercises)
          ex.id: resolveMediaUrl(ex.videoPath, baseUrl),
      };

      final saved = await ref.read(sessionStoreProvider).read();
      final session =
          (saved != null && saved.dayId == day.id) ? saved : _build(plan!, day);

      if (mounted) {
        setState(() {
          _session = session;
          _loading = false;
        });
      }
    } catch (_) {
      _exit();
    }
  }

  void _exit() {
    if (mounted) context.go(AppRoutes.training);
  }

  WorkoutSession _build(TrainingPlan plan, TrainingDay day) {
    return WorkoutSession(
      planId: plan.id,
      dayId: day.id,
      dayIndex: widget.dayIndex,
      dayName: day.name,
      startedAt: DateTime.now().toUtc().toIso8601String(),
      exercises: [
        for (final ex in day.exercises)
          SessionExercise(
            exerciseId: ex.id,
            exerciseLibraryId: ex.exerciseLibraryId,
            name: ex.name,
            thumbnailPath: ex.thumbnailPath,
            youtubeUrl: ex.youtubeUrl,
            videoPath: ex.videoPath,
            muscleGroup: ex.muscleGroup,
            equipment: ex.equipment,
            instructionsEn: ex.instructionsEn,
            instructionsAr: ex.instructionsAr,
            prescribed: [
              for (final s in ex.sets)
                PrescribedSet(
                  reps: s.reps,
                  restSeconds: s.restSeconds,
                  rir: s.rir?.toString(),
                  tempo: s.tempo,
                ),
            ],
            sets: List.generate(
              ex.sets.isEmpty ? 1 : ex.sets.length,
              (i) => SessionSet(setOrder: i + 1),
            ),
          ),
      ],
    );
  }

  void _persist() {
    final s = _session;
    if (s != null) unawaited(ref.read(sessionStoreProvider).write(s));
  }

  void _updateExercise(int exIdx, SessionExercise Function(SessionExercise) f) {
    final s = _session!;
    final exercises = [...s.exercises];
    exercises[exIdx] = f(exercises[exIdx]);
    setState(() => _session = s.copyWith(exercises: exercises));
    _persist();
  }

  void _changeSet(int exIdx, int setIdx, String field, String value) {
    _updateExercise(exIdx, (ex) {
      final sets = [...ex.sets];
      final cur = sets[setIdx];
      sets[setIdx] = switch (field) {
        'weight' => cur.copyWith(weight: value),
        'reps' => cur.copyWith(reps: value),
        'rir' => cur.copyWith(rir: value),
        _ => cur,
      };
      return ex.copyWith(sets: sets);
    });
  }

  void _toggleSet(int exIdx, int setIdx) {
    final wasCompleted = _session!.exercises[exIdx].sets[setIdx].completed;
    final nowMs = DateTime.now().millisecondsSinceEpoch;

    _updateExercise(exIdx, (ex) {
      final sets = [...ex.sets];
      sets[setIdx] = sets[setIdx].copyWith(completed: !sets[setIdx].completed);
      return ex.copyWith(sets: sets);
    });

    if (wasCompleted) {
      // Un-checking: stop any rest tied to this set.
      final last = _lastCompletion;
      if (last != null && last.exIdx == exIdx && last.setIdx == setIdx) {
        _lastCompletion = null;
        setState(() => _restStartMs = null);
      }
      return;
    }

    // Completing: measure rest taken since the previous set of this exercise.
    final prev = _lastCompletion;
    if (prev != null && prev.exIdx == exIdx && prev.setIdx == setIdx - 1) {
      final measured = ((nowMs - prev.atMs) / 1000).round();
      _updateExercise(exIdx, (ex) {
        final sets = [...ex.sets];
        sets[setIdx - 1] = sets[setIdx - 1].copyWith(restSeconds: measured);
        return ex.copyWith(sets: sets);
      });
    }
    _lastCompletion = (exIdx: exIdx, setIdx: setIdx, atMs: nowMs);

    final prescribed = _session!.exercises[exIdx].prescribed;
    final target =
        (setIdx < prescribed.length ? prescribed[setIdx].restSeconds : null) ??
            _defaultRest;
    setState(() {
      _restStartMs = nowMs;
      _restTarget = target;
    });
  }

  void _changeNote(int exIdx, String value) {
    _updateExercise(exIdx, (ex) => ex.copyWith(note: value));
  }

  Future<void> _discard() async {
    final l10n = AppLocalizations.of(context);
    final ok =
        await _confirm(l10n.trainingDiscardConfirm, l10n.trainingDiscard);
    if (ok != true) return;
    await ref.read(sessionStoreProvider).clear();
    _exit();
  }

  Future<void> _finish() async {
    final l10n = AppLocalizations.of(context);
    final session = _session!;
    if (completedSetCount(session.exercises) == 0) {
      final ok =
          await _confirm(l10n.trainingFinishEmptyConfirm, l10n.trainingFinish);
      if (ok != true) return;
    }

    setState(() => _saving = true);
    final payload = {
      'plan_id': session.planId,
      'day_id': session.dayId,
      'day_index': session.dayIndex,
      'notes': null,
      'started_at': session.startedAt,
      'ended_at': DateTime.now().toUtc().toIso8601String(),
      'exercises': [
        for (final ex in session.exercises)
          {
            'exercise_id': ex.exerciseId,
            'exercise_library_id': ex.exerciseLibraryId,
            'name': ex.name,
            'note': ex.note.trim().isEmpty ? null : ex.note.trim(),
            'sets': [
              for (final s in ex.sets)
                {
                  'set_order': s.setOrder,
                  'weight': toNumber(s.weight),
                  'reps': toNumber(s.reps),
                  'rir': toNumber(s.rir),
                  'rest_seconds': s.restSeconds,
                  'completed': s.completed,
                },
            ],
          },
      ],
    };

    try {
      await ref.read(workoutRepositoryProvider).createLog(payload);
      await ref.read(sessionStoreProvider).clear();
      ref.invalidate(workoutLogsProvider);
      if (mounted) context.go(AppRoutes.trainingHistory);
    } catch (_) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.trainingSaveFailed)),
        );
      }
    }
  }

  Future<bool?> _confirm(String message, String confirmLabel) {
    final l10n = AppLocalizations.of(context);
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    // Logging a session requires training-plan access; guard direct/deep-link entry.
    if (!ref.watch(clientAccessProvider).canViewTraining) {
      return Scaffold(
        appBar: AppBar(leading: BackButton(onPressed: () => context.pop())),
        body: RestrictedView(message: l10n.restrictedTraining),
      );
    }

    if (_loading || _session == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final session = _session!;
    final elapsed =
        ((_nowMs - DateTime.parse(session.startedAt).millisecondsSinceEpoch) /
                1000)
            .floor();
    final restRemaining = _restStartMs != null
        ? (_restTarget - (_nowMs - _restStartMs!) / 1000).ceil()
        : null;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.delete_outline),
          tooltip: l10n.trainingDiscard,
          onPressed: _discard,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(session.dayName,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            Text(
              '${formatDuration(elapsed)} · ${totalVolume(session.exercises)} ${l10n.trainingVolumeUnit}',
              style: TextStyle(
                  fontSize: 12, color: context.appColors.mutedForeground),
            ),
          ],
        ),
        centerTitle: false,
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 12),
            child: FilledButton.icon(
              onPressed: _saving ? null : _finish,
              // Override the global full-width min size so the button fits the
              // app bar instead of being clipped.
              style: FilledButton.styleFrom(
                minimumSize: Size.zero,
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              icon: const Icon(Icons.flag, size: 16),
              label: Text(_saving ? l10n.trainingSaving : l10n.trainingFinish),
            ),
          ),
        ],
      ),
      // Flat, borderless list (Strong-style) — exercises are separated by
      // spacing and a hairline divider instead of individual card chrome.
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: session.exercises.length,
        separatorBuilder: (_, __) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Divider(
            height: 1,
            color: context.appColors.border.withValues(alpha: 0.5),
          ),
        ),
        itemBuilder: (context, i) => ExerciseLogCard(
          exercise: session.exercises[i],
          previous: _previous[session.exercises[i].exerciseId] ?? const [],
          videoUrl: _videoUrls[session.exercises[i].exerciseId],
          focusSetIndex: restRemaining != null && _lastCompletion?.exIdx == i
              ? _lastCompletion!.setIdx + 1
              : null,
          onChangeSet: (setIdx, field, value) =>
              _changeSet(i, setIdx, field, value),
          onToggleSet: (setIdx) => _toggleSet(i, setIdx),
          onChangeNote: (value) => _changeNote(i, value),
        ),
      ),
      bottomNavigationBar: restRemaining != null
          ? RestTimerBar(
              remaining: restRemaining,
              target: _restTarget,
              onAdd: (secs) => setState(() => _restTarget += secs),
              onSkip: () => setState(() => _restStartMs = null),
            )
          : null,
    );
  }
}
