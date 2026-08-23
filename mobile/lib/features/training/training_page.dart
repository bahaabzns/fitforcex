import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/access/access_controller.dart';
import '../../core/config/providers.dart';
import '../../core/router/app_routes.dart';
import '../../core/theme/app_theme.dart';
import '../../core/unread/unread_indicators.dart';
import '../../core/widgets/async_value_widget.dart';
import '../../core/widgets/collapsible_note.dart';
import '../../core/widgets/empty_state.dart';
import '../../core/widgets/pill_tabs.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../shared/models/training_plan.dart';
import '../../shared/models/workout_log.dart';
import '../../shared/models/workout_session.dart';
import '../../shared/utils/exercise_tracking_types.dart';
import '../../shared/utils/localization.dart';
import '../../shared/utils/media_url.dart';
import '../../shared/utils/workout.dart';
import '../access/restricted_view.dart';
import 'session_store.dart';
import 'training_repository.dart';
import 'widgets/exercise_insights_modal.dart';
import 'widgets/coach_note_modal.dart';
import 'widgets/exercise_video.dart';
import 'workout_repository.dart';

/// The client's active training plan. Parity port of the web portal training
/// page: day tabs, collapsible plan/day notes, and exercise cards sharing the
/// live session card's video player, chip styling and compact set grid — plus
/// a floating "Start"/"Continue {day}" trigger that picks up a session left
/// running in the background (see [session_store.dart]).
class TrainingPage extends ConsumerStatefulWidget {
  const TrainingPage({super.key});

  @override
  ConsumerState<TrainingPage> createState() => _TrainingPageState();
}

class _TrainingPageState extends ConsumerState<TrainingPage> {
  @override
  void initState() {
    super.initState();
    // fireImmediately: ref.listen (used in build()) only fires on a state
    // *transition* — it never fires for a value the provider already holds
    // when the listener registers. Since the shell keeps this provider warm
    // (it watches the unread flags on every tab), the plan is often already
    // loaded by the time this page mounts, so a build()-scoped ref.listen
    // never marks it seen. listenManual + fireImmediately fixes that, and
    // keeps listening for the plan's lifetime so a new plan published while
    // this tab is already active (kept alive by the IndexedStack) still
    // clears the dot correctly. The mutation itself is deferred a microtask
    // — Riverpod forbids modifying provider state while the widget tree is
    // still building, which fireImmediately's synchronous initState call is.
    if (ref.read(clientAccessProvider).canViewTraining) {
      ref.listenManual<AsyncValue<TrainingPlan?>>(
        activeTrainingPlanProvider,
        (_, next) {
          final loaded = next.asData?.value;
          if (loaded != null) {
            unawaited(Future.microtask(() {
              ref
                  .read(trainingPlanSeenProvider.notifier)
                  .markSeen('${loaded.id}|${loaded.activatedAt ?? ''}');
            }));
          }
        },
        fireImmediately: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (!ref.watch(clientAccessProvider).canViewTraining) {
      return RestrictedView(message: l10n.restrictedTraining);
    }

    final plan = ref.watch(activeTrainingPlanProvider);

    return AsyncValueWidget<TrainingPlan?>(
      value: plan,
      onRetry: () => ref.invalidate(activeTrainingPlanProvider),
      data: (plan) {
        if (plan == null || plan.days.isEmpty) {
          return EmptyState(
            icon: Icons.fitness_center_outlined,
            title: l10n.trainingNoActivePlan,
            hint: l10n.trainingNoActivePlanHint,
          );
        }
        return _TrainingView(plan: plan);
      },
    );
  }
}

class _TrainingView extends ConsumerStatefulWidget {
  const _TrainingView({required this.plan});

  final TrainingPlan plan;

  @override
  ConsumerState<_TrainingView> createState() => _TrainingViewState();
}

class _TrainingViewState extends ConsumerState<_TrainingView> {
  int _activeDay = 0;

  // A session minimized back to this page (or resumed from a killed app)
  // shows here as a live "Continue {day}" trigger instead of "Start" —
  // polled every tick rather than derived from push/pop navigation events,
  // since the plain read from shared_preferences is cheap and this covers
  // every way the client can land back on this page (pop, deep link, a
  // finish/discard that replaces the route) without relying on go_router's
  // future-resolution semantics for any of them.
  WorkoutSession? _activeSession;
  Timer? _ticker;
  int _nowMs = DateTime.now().millisecondsSinceEpoch;

  @override
  void initState() {
    super.initState();
    unawaited(_refreshActiveSession());
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _nowMs = DateTime.now().millisecondsSinceEpoch);
      unawaited(_refreshActiveSession());
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _refreshActiveSession() async {
    final saved = await ref.read(sessionStoreProvider).read();
    if (mounted && saved != _activeSession) {
      setState(() => _activeSession = saved);
    }
  }

  Future<void> _openSession(int dayIndex) async {
    await context.push('${AppRoutes.trainingSession}?day=$dayIndex');
    if (mounted) unawaited(_refreshActiveSession());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final baseUrl = ref.read(appConfigProvider).apiBaseUrl;
    final plan = widget.plan;
    final day = plan.days[_activeDay.clamp(0, plan.days.length - 1)];
    final hasExercises = day.exercises.isNotEmpty;
    final previous = hasExercises
        ? ref.watch(dayPreviousProvider(day.id)).asData?.value ?? const {}
        : const <String, List<PreviousSet>>{};

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 90),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    plan.name.isEmpty ? l10n.trainingTitle : plan.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
                if (hasExercises) ...[
                  _IconAction(
                    icon: Icons.history,
                    tooltip: l10n.trainingHistory,
                    onTap: () => context.push(AppRoutes.trainingHistory),
                  ),
                  const SizedBox(width: 8),
                  _IconAction(
                    icon: Icons.show_chart,
                    tooltip: l10n.trainingProgress,
                    onTap: () => context.push(AppRoutes.trainingProgress),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),

            if (plan.days.length > 1) ...[
              PillTabs(
                labels: [for (final d in plan.days) d.name],
                selectedIndex: _activeDay,
                onSelected: (i) => setState(() => _activeDay = i),
              ),
              const SizedBox(height: 16),
            ],

            // Plan-level coach note (amber)
            if ((plan.notes ?? '').trim().isNotEmpty) ...[
              CollapsibleNote(label: l10n.trainingCoachNote, body: plan.notes!),
              const SizedBox(height: 12),
            ],

            // Day note (primary)
            if ((day.notes ?? '').trim().isNotEmpty) ...[
              CollapsibleNote(
                label: l10n.trainingDayNote,
                body: day.notes!,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 12),
            ],

            if (!hasExercises)
              _InfoCard(title: day.name, text: l10n.trainingRestDayHint)
            else ...[
              _SectionSeparator(label: l10n.trainingExercises),
              const SizedBox(height: 12),
              for (var i = 0; i < day.exercises.length; i++) ...[
                if (i > 0) ...[
                  const SizedBox(height: 4),
                  Divider(color: context.appColors.border.withValues(alpha: 0.5)),
                  const SizedBox(height: 12),
                ],
                _ExerciseCard(
                  exercise: day.exercises[i],
                  index: i,
                  locale: locale,
                  baseUrl: baseUrl,
                  previous: previous[day.exercises[i].id] ?? const [],
                ),
              ],
            ],
          ],
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 16,
          child: SafeArea(
            top: false,
            child: Center(
              child: _activeSession != null
                  ? _ContinueTrigger(
                      session: _activeSession!,
                      nowMs: _nowMs,
                      onTap: () => _openSession(_activeSession!.dayIndex),
                    )
                  : (hasExercises
                      ? _StartTrigger(onTap: () => _openSession(_activeDay))
                      : const SizedBox.shrink()),
            ),
          ),
        ),
      ],
    );
  }
}

class _StartTrigger extends StatelessWidget {
  const _StartTrigger({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _FloatingPill(
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.play_arrow, size: 18),
          const SizedBox(width: 6),
          Text(l10n.trainingStart,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _ContinueTrigger extends StatelessWidget {
  const _ContinueTrigger({
    required this.session,
    required this.nowMs,
    required this.onTap,
  });

  final WorkoutSession session;
  final int nowMs;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final started = DateTime.tryParse(session.startedAt);
    final elapsed = started != null
        ? ((nowMs - started.millisecondsSinceEpoch) / 1000).floor()
        : 0;
    return _FloatingPill(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            l10n.trainingContinueDay(session.dayName),
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            formatDuration(elapsed),
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

class _FloatingPill extends StatelessWidget {
  const _FloatingPill({required this.child, required this.onTap});
  final Widget child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.primary,
      borderRadius: BorderRadius.circular(20),
      elevation: 4,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: DefaultTextStyle.merge(
            style: TextStyle(color: Theme.of(context).colorScheme.onPrimary),
            child: IconTheme.merge(
              data: IconThemeData(color: Theme.of(context).colorScheme.onPrimary),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class _ExerciseCard extends StatelessWidget {
  const _ExerciseCard({
    required this.exercise,
    required this.index,
    required this.locale,
    required this.baseUrl,
    required this.previous,
  });

  final TrainingExercise exercise;
  final int index;
  final String locale;
  final String baseUrl;
  final List<PreviousSet> previous;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final hasVideo = (exercise.youtubeUrl ?? '').isNotEmpty ||
        (exercise.videoPath ?? '').isNotEmpty;
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasVideo) ...[
          ExerciseVideo(
            youtubeUrl: exercise.youtubeUrl,
            videoUrl: resolveMediaUrl(exercise.videoPath, baseUrl),
          ),
          const SizedBox(height: 12),
        ],
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
                  if (muscleGroup.isNotEmpty || equipment.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (muscleGroup.isNotEmpty) _Chip(label: muscleGroup),
                        if (equipment.isNotEmpty)
                          _Chip(label: equipment, color: const Color(0xFF8B5CF6)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            _CompactIconAction(
              icon: Icons.show_chart,
              tooltip: l10n.trainingInsights,
              onTap: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                useSafeArea: true,
                builder: (_) => ExerciseInsightsModal(
                  exerciseLibraryId: exercise.exerciseLibraryId,
                  exerciseId: exercise.id,
                  exerciseName: exerciseName,
                ),
              ),
            ),
            _CompactIconAction(
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
          ],
        ),
        if ((exercise.notes ?? '').trim().isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsetsDirectional.only(start: 10),
            decoration: BoxDecoration(
              border: BorderDirectional(
                start: BorderSide(
                    color: context.appColors.warning.withValues(alpha: 0.6),
                    width: 2),
              ),
            ),
            child: Text(exercise.notes!,
                style: TextStyle(fontSize: 12, color: muted)),
          ),
        ],
        if (exercise.sets.isNotEmpty) ...[
          const SizedBox(height: 12),
          _SetsTable(
            sets: exercise.sets,
            trackingType: exercise.trackingType,
            trackedMetrics: exercise.trackedMetrics,
            previous: previous,
          ),
        ],
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, this.color});
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.appColors.mutedForeground;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 11, color: color ?? context.appColors.mutedForeground)),
    );
  }
}

/// Reads one named field off a [TrainingSet] by the tracking-config's field
/// name string. Used both for the read-only target columns (tempo/rir/rpe)
/// and the primary columns (reps, or duration/distance/incline/speed).
String? _trainingSetValue(TrainingSet set, String field) => switch (field) {
      'reps' => set.reps,
      'tempo' => set.tempo,
      'rir' => set.rir?.toString(),
      'rpe' => set.rpe?.toString(),
      'duration_seconds' => set.durationSeconds?.toString(),
      'distance_km' => set.distanceKm?.toString(),
      'incline_percent' => set.inclinePercent?.toString(),
      'speed_kmh' => set.speedKmh?.toString(),
      _ => null,
    };

String _fieldLabel(AppLocalizations l10n, String field) => switch (field) {
      'reps' => l10n.trainingReps,
      'tempo' => l10n.trainingTempo,
      'rir' => l10n.trainingRir,
      'rpe' => l10n.trainingRpe,
      'duration_seconds' => l10n.trainingDuration,
      'distance_km' => l10n.trainingDistance,
      'incline_percent' => l10n.trainingIncline,
      'speed_kmh' => l10n.trainingSpeed,
      _ => field,
    };

String _formatFieldValue(String field, String? value) {
  if (value == null || value.isEmpty) return '—';
  if (field == 'duration_seconds') {
    final secs = int.tryParse(value);
    return secs != null ? formatClock(secs) : value;
  }
  return value;
}

class _SetsTable extends StatelessWidget {
  const _SetsTable({
    required this.sets,
    required this.trackingType,
    required this.trackedMetrics,
    required this.previous,
  });

  final List<TrainingSet> sets;
  final String? trackingType;
  final List<String>? trackedMetrics;
  final List<PreviousSet> previous;

  PreviousSet? _previousFor(int setOrder) {
    for (final p in previous) {
      if (p.setOrder == setOrder) return p;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final header = TextStyle(
      fontSize: 10,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.5,
      color: muted.withValues(alpha: 0.7),
    );

    final category = categoryOf(trackingType);
    // rest_seconds is prescribed but never a displayed column here (matches
    // the live session log card).
    final fields = prescribedFieldsFor(trackingType, trackedMetrics)
        .where((f) => f != 'rest_seconds')
        .toList();
    final primaryFields =
        category == setsReps ? fields.where((f) => f == 'reps').toList() : fields;
    var targetFields = category == setsReps
        ? fields.where((f) => f != 'reps').toList()
        : const <String>[];

    if (category == setsReps) {
      // Tempo/RIR are per-exercise coach choices — hide the column entirely
      // when the coach never filled it in for any set, including the
      // builder's "-" placeholder for tempo.
      final showTempo = sets.any((s) => hasTempoValue(s.tempo));
      final showRir = sets.any((s) => hasRirValue(s.rir));
      targetFields = targetFields.where((f) {
        if (f == 'tempo') return showTempo;
        if (f == 'rir') return showRir;
        return true;
      }).toList();
    }

    Widget cell(String text, TextStyle? style) => Expanded(
        child: Text(text,
            style: style, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis));

    return Column(
      children: [
        Row(
          children: [
            cell(l10n.trainingSet.toUpperCase(), header),
            cell(l10n.trainingPreviousShort.toUpperCase(), header),
            for (final field in [...primaryFields, ...targetFields])
              cell(_fieldLabel(l10n, field).toUpperCase(), header),
          ],
        ),
        const SizedBox(height: 4),
        for (var i = 0; i < sets.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                cell('${i + 1}', TextStyle(fontSize: 12, color: muted)),
                cell(
                  previousSetLabel(_previousFor(sets[i].setOrder), category) ?? '—',
                  TextStyle(fontSize: 10, color: muted.withValues(alpha: 0.6)),
                ),
                for (final field in [...primaryFields, ...targetFields])
                  cell(
                    _formatFieldValue(field, _trainingSetValue(sets[i], field)),
                    const TextStyle(fontSize: 13),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _CompactIconAction extends StatelessWidget {
  const _CompactIconAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: IconButton(
        onPressed: onTap,
        icon: Icon(icon, size: 18, color: context.appColors.mutedForeground),
        visualDensity: VisualDensity.compact,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
      ),
    );
  }
}

class _IconAction extends StatelessWidget {
  const _IconAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: context.appColors.border),
          ),
          child: Icon(icon, size: 20, color: context.appColors.mutedForeground),
        ),
      ),
    );
  }
}

class _SectionSeparator extends StatelessWidget {
  const _SectionSeparator({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final muted = context.appColors.mutedForeground;
    return Row(
      children: [
        Expanded(child: Divider(color: context.appColors.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 2,
              color: muted.withValues(alpha: 0.5),
            ),
          ),
        ),
        Expanded(child: Divider(color: context.appColors.border)),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({this.title, required this.text});
  final String? title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (title != null && title!.isNotEmpty) ...[
                Text(title!,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
              ],
              Text(text,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: context.appColors.mutedForeground)),
            ],
          ),
        ),
      ),
    );
  }
}
