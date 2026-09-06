import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_controller.dart';
import '../../core/config/providers.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/new_feature_hint.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/training_plan.dart';
import '../../shared/models/workout_log.dart';
import '../../shared/models/workout_session.dart';
import '../../shared/utils/exercise_tracking_types.dart';
import '../../shared/utils/format_amount.dart';
import '../../shared/utils/media_url.dart';
import '../../shared/utils/workout.dart';
import '../access/restricted_view.dart';
import 'session_store.dart';
import 'training_repository.dart';
import 'widgets/exercise_log_card.dart';
import 'widgets/rest_timer_bar.dart';
import 'workout_repository.dart';

const _defaultRest = 90;

/// Minted client-side (not server-generated) the moment a session starts, so
/// every debounced autosave and the final Finish both target the same
/// workout_logs row via upsert (PUT /workout-logs/:id) instead of Finish
/// creating a second one. Any sufficiently-unique string works — the server
/// never validates the format, just stores it as the row's id.
String _newSessionId() {
  final rand = Random.secure();
  final bytes = List<int>.generate(16, (_) => rand.nextInt(256));
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}';
}

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
  bool _minimizeHintShown = false;
  bool _instructionsHintShown = false;

  Timer? _ticker;
  int _nowMs = DateTime.now().millisecondsSinceEpoch;

  int? _restStartMs;
  int _restTarget = 0;
  ({int exIdx, int setIdx, int atMs})? _lastCompletion;

  // Instant Save — debounced background autosave of the whole session while
  // the client is still working, so weights/reps typed mid-workout survive a
  // closed app/crash/lost connection without waiting for Finish.
  Timer? _autosaveDebounce;
  String _autosaveState = 'idle'; // idle | saving | saved | error
  // Discards a stale autosave response if a newer one has since fired.
  int _autosaveRequestId = 0;
  // "error" only after several *consecutive* failures — a transient blip on
  // one save isn't worth interrupting anyone.
  int _autosaveFailStreak = 0;
  // The in-flight autosave PUT, if any — Discard awaits this before deleting
  // the row (see _discard) so the delete is always the last write to land,
  // never raced by a PUT that was already on the wire.
  Future<void>? _pendingAutosave;
  // Set the instant Finish/Discard is tapped so any autosave already queued
  // behind the debounce timer skips firing — Finish's/Discard's own action
  // supersedes it. A request already in flight isn't cancelled: the server's
  // own check (a completed row is never mutated again) covers that narrower
  // race for Finish; Discard instead waits for it via _pendingAutosave.
  bool _finishing = false;

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
    _autosaveDebounce?.cancel();
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
        await ref.read(sessionStoreProvider).clear();
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
      WorkoutSession session;
      if (saved != null && saved.dayId == day.id) {
        // Pre-existing saved sessions (from before Instant Save shipped)
        // won't have an id yet — mint one rather than losing the ability
        // to autosave.
        session = _resumeSession(
          plan!,
          day,
          id: saved.id ?? _newSessionId(),
          startedAt: saved.startedAt,
          restoredByExerciseId: {
            for (final ex in saved.exercises)
              ex.exerciseId: (note: ex.note, sets: ex.sets),
          },
        );
      } else {
        // No local draft (cleared storage, app killed, or a fresh device) —
        // check the server for one before giving up and starting blank. A
        // nice-to-have: never let its failure block starting the session.
        final draft =
            await ref.read(workoutRepositoryProvider).fetchDraft(day.id);
        session = draft != null
            ? _resumeSession(
                plan!,
                day,
                id: draft.id,
                startedAt: draft.startedAt,
                restoredByExerciseId: draft.exercisesById,
              )
            : _build(plan!, day);
      }

      if (mounted) {
        setState(() {
          _session = session;
          _loading = false;
        });
      }
    } catch (_) {
      await ref.read(sessionStoreProvider).clear();
      _exit();
    }
  }

  void _exit() {
    if (mounted) context.go(AppRoutes.training);
  }

  WorkoutSession _build(TrainingPlan plan, TrainingDay day) {
    return WorkoutSession(
      id: _newSessionId(),
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
            libraryNameEn: ex.libraryNameEn,
            libraryNameAr: ex.libraryNameAr,
            thumbnailPath: ex.thumbnailPath,
            youtubeUrl: ex.youtubeUrl,
            videoPath: ex.videoPath,
            muscleGroup: ex.muscleGroup,
            muscleGroupAr: ex.muscleGroupAr,
            equipment: ex.equipment,
            equipmentAr: ex.equipmentAr,
            instructionsEn: ex.instructionsEn,
            instructionsAr: ex.instructionsAr,
            trackingType: categoryOf(ex.trackingType),
            trackedMetrics: trackedMetricsOf(ex.trackingType, ex.trackedMetrics),
            prescribed: [
              for (final s in ex.sets)
                PrescribedSet(
                  reps: s.reps,
                  restSeconds: s.restSeconds,
                  rir: s.rir?.toString(),
                  tempo: s.tempo,
                  rpe: s.rpe != null ? prettyAmount(s.rpe!) : null,
                  durationSeconds: s.durationSeconds?.toString(),
                  distanceKm: s.distanceKm != null ? prettyAmount(s.distanceKm!) : null,
                  inclinePercent: s.inclinePercent != null ? prettyAmount(s.inclinePercent!) : null,
                  speedKmh: s.speedKmh != null ? prettyAmount(s.speedKmh!) : null,
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

  /// Re-derives all exercise metadata (name, video, thumbnail, prescribed
  /// targets, tracking config) from the *current* plan — in case a coach
  /// edited it since the draft was cached — and only carries over the
  /// client's own entered values (per-exercise note + sets) and identity
  /// (id, started_at). Shared by both the local-storage-restored and the
  /// server-draft-restored paths so they behave identically.
  WorkoutSession _resumeSession(
    TrainingPlan plan,
    TrainingDay day, {
    required String id,
    required String startedAt,
    required Map<String, ({String note, List<SessionSet> sets})>
        restoredByExerciseId,
  }) {
    final fresh = _build(plan, day);
    return fresh.copyWith(
      id: id,
      startedAt: startedAt,
      exercises: [
        for (final ex in fresh.exercises)
          if (restoredByExerciseId[ex.exerciseId] case final restored?)
            ex.copyWith(note: restored.note, sets: restored.sets)
          else
            ex,
      ],
    );
  }

  void _persist() {
    final s = _session;
    if (s == null) return;
    unawaited(ref.read(sessionStoreProvider).write(s));

    // Debounces the server autosave (700ms) so it doesn't fire on every
    // keystroke. Independent of the local write above, which happens
    // immediately on every edit.
    _autosaveDebounce?.cancel();
    _autosaveDebounce =
        Timer(const Duration(milliseconds: 700), () => unawaited(_autosave()));
  }

  Map<String, dynamic> _serializeExercise(SessionExercise ex) => {
        'exercise_id': ex.exerciseId,
        'exercise_library_id': ex.exerciseLibraryId,
        'name': ex.name,
        'library_name_en': ex.libraryNameEn,
        'library_name_ar': ex.libraryNameAr,
        'note': ex.note.trim().isEmpty ? null : ex.note.trim(),
        'tracking_type': ex.trackingType,
        'tracked_metrics': ex.trackedMetrics,
        'sets': [
          for (final s in ex.sets)
            {
              'set_order': s.setOrder,
              'weight': toNumber(s.weight),
              'reps': toNumber(s.reps),
              'rest_seconds': s.restSeconds,
              'duration_seconds': toNumber(s.durationSeconds)?.round(),
              'distance_km': toNumber(s.distanceKm),
              'incline_percent': toNumber(s.inclinePercent),
              'speed_kmh': toNumber(s.speedKmh),
              'completed': s.completed,
            },
        ],
      };

  /// The actual server autosave — fires on every real edit, independent of
  /// the local shared_preferences write. Data already reaches the server
  /// here; Finish only flips `completed` to true on the same row.
  Future<void> _autosave() async {
    final session = _session;
    if (session == null || session.id == null) return;
    if (_finishing) return;

    final requestId = ++_autosaveRequestId;
    setState(() => _autosaveState = 'saving');
    final request = ref.read(workoutRepositoryProvider).upsertLog(session.id!, {
      'plan_id': session.planId,
      'day_id': session.dayId,
      'day_index': session.dayIndex,
      'notes': null,
      'started_at': session.startedAt,
      'ended_at': DateTime.now().toUtc().toIso8601String(),
      'exercises': [for (final ex in session.exercises) _serializeExercise(ex)],
      'completed': false,
    });
    _pendingAutosave = request.then((_) {}, onError: (_) {});
    try {
      await request;
      if (requestId != _autosaveRequestId || !mounted) return;
      _autosaveFailStreak = 0;
      setState(() => _autosaveState = 'saved');
    } catch (_) {
      if (requestId != _autosaveRequestId || !mounted) return;
      _autosaveFailStreak++;
      // A background save failing on every flaky-connection blip would be a
      // worse experience than staying silent — only surface something after
      // a sustained run of failures.
      setState(
          () => _autosaveState = _autosaveFailStreak >= 3 ? 'error' : 'saving');
    }
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
        'duration_seconds' => cur.copyWith(durationSeconds: value),
        'distance_km' => cur.copyWith(distanceKm: value),
        'incline_percent' => cur.copyWith(inclinePercent: value),
        'speed_kmh' => cur.copyWith(speedKmh: value),
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

  /// Leaves the session running in the background instead of discarding it —
  /// the autosaved draft (local + server) is what makes this safe: there's
  /// no separate "minimized" state to set, just navigating away. The training
  /// day-preview page picks it up as a live "Continue {day}" indicator.
  void _minimize() {
    if (context.canPop()) {
      context.pop();
    } else {
      _exit();
    }
  }

  Future<void> _discard() async {
    final l10n = AppLocalizations.of(context);
    final ok =
        await _confirm(l10n.trainingDiscardConfirm, l10n.trainingDiscard);
    if (ok != true) return;
    // Stop any queued autosave from resurrecting the row we're about to
    // delete. A PUT already on the wire can't be cancelled, so wait for it
    // to land first — the delete below then always runs strictly after,
    // instead of racing it and risking the PUT's response resurrecting the
    // row moments after it's deleted.
    _finishing = true;
    _autosaveDebounce?.cancel();
    await _pendingAutosave;
    final id = _session?.id;
    await ref.read(sessionStoreProvider).clear();
    // Best-effort — an explicit discard should remove the autosaved draft
    // too, not just the local cache, but a failed cleanup call is no reason
    // to block leaving.
    if (id != null) {
      unawaited(ref.read(workoutRepositoryProvider).deleteLog(id).catchError((_) {}));
    }
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

    // Stops any autosave still queued behind the debounce timer from firing
    // after this — Finish's own save (below) is the authoritative final
    // write, targeting the exact same row by id.
    _finishing = true;
    _autosaveDebounce?.cancel();
    setState(() => _saving = true);
    final payload = {
      'plan_id': session.planId,
      'day_id': session.dayId,
      'day_index': session.dayIndex,
      'notes': null,
      'started_at': session.startedAt,
      'ended_at': DateTime.now().toUtc().toIso8601String(),
      'exercises': [for (final ex in session.exercises) _serializeExercise(ex)],
      'completed': true,
    };

    try {
      final result =
          await ref.read(workoutRepositoryProvider).upsertLog(session.id!, payload);
      await ref.read(sessionStoreProvider).clear();
      ref.invalidate(workoutLogsProvider);
      if (mounted) {
        final query = Uri(queryParameters: {
          'dayName': session.dayName,
          if (result?['duration_seconds'] != null)
            'duration': '${result!['duration_seconds']}',
          if (result?['total_volume'] != null) 'volume': '${result!['total_volume']}',
          if (result?['total_sets'] != null) 'sets': '${result!['total_sets']}',
        }).query;
        context.go('${AppRoutes.trainingSessionComplete}?$query');
      }
    } catch (_) {
      if (mounted) {
        _finishing = false; // let autosave resume if the client keeps editing and retries
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

    _minimizeHintShown = maybeShowFeatureHint(
      context,
      ref,
      featureKey: 'minimize_session_hint',
      active: true,
      alreadyShown: _minimizeHintShown,
      message: l10n.trainingMinimizeSessionHint,
      dismissLabel: l10n.trainingMinimizeSessionHintDismiss,
      badgeLabel: l10n.trainingMinimizeSessionNewFeature,
    );
    _instructionsHintShown = maybeShowFeatureHint(
      context,
      ref,
      featureKey: 'exercise_instructions_hint',
      active: session.exercises.isNotEmpty,
      alreadyShown: _instructionsHintShown,
      message: l10n.trainingInstructionsHint,
      dismissLabel: l10n.trainingInstructionsHintDismiss,
      badgeLabel: l10n.trainingInstructionsNewFeature,
    );

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.keyboard_arrow_down),
          tooltip: l10n.trainingMinimizeSession,
          onPressed: _minimize,
        ),
        title: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              formatDuration(elapsed),
              style: const TextStyle(
                  fontSize: 20, fontWeight: FontWeight.bold, height: 1.1),
            ),
            if (_autosaveState == 'error')
              Text(
                l10n.trainingNotSaved,
                style: TextStyle(
                    fontSize: 11, color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
        centerTitle: true,
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
      // Discard lives at the very bottom, scrolling with the content, so
      // it's never one accidental tap away like the old header icon was.
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        itemCount: session.exercises.length + 2,
        separatorBuilder: (context, i) {
          if (i == 0 || i == session.exercises.length) {
            return const SizedBox(height: 20);
          }
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Divider(
              height: 1,
              color: context.appColors.border.withValues(alpha: 0.5),
            ),
          );
        },
        itemBuilder: (context, i) {
          if (i == 0) {
            return Text(session.dayName,
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.bold));
          }
          if (i == session.exercises.length + 1) {
            return OutlinedButton.icon(
              onPressed: _discard,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                foregroundColor: Theme.of(context).colorScheme.error,
                side: BorderSide(color: Theme.of(context).colorScheme.error),
              ),
              icon: const Icon(Icons.delete_outline, size: 18),
              label: Text(l10n.trainingDiscard),
            );
          }
          final exIdx = i - 1;
          return ExerciseLogCard(
            exercise: session.exercises[exIdx],
            previous: _previous[session.exercises[exIdx].exerciseId] ?? const [],
            videoUrl: _videoUrls[session.exercises[exIdx].exerciseId],
            focusSetIndex:
                restRemaining != null && _lastCompletion?.exIdx == exIdx
                    ? _lastCompletion!.setIdx + 1
                    : null,
            onChangeSet: (setIdx, field, value) =>
                _changeSet(exIdx, setIdx, field, value),
            onToggleSet: (setIdx) => _toggleSet(exIdx, setIdx),
            onChangeNote: (value) => _changeNote(exIdx, value),
          );
        },
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
