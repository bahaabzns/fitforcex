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
import '../../shared/utils/localization.dart';
import '../../shared/utils/media_url.dart';
import '../access/restricted_view.dart';
import 'training_repository.dart';
import 'widgets/exercise_video.dart';

/// The client's active training plan. Parity port of the web portal training
/// page: day tabs, collapsible plan/day notes, exercise cards with thumbnail,
/// muscle/equipment chips, sets grid, alternatives, and inline video.
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
  String? _openVideoId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).languageCode;
    final baseUrl = ref.read(appConfigProvider).apiBaseUrl;
    final plan = widget.plan;
    final day = plan.days[_activeDay.clamp(0, plan.days.length - 1)];
    final hasExercises = day.exercises.isNotEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
      children: [
        Text(
          plan.name.isEmpty ? l10n.trainingTitle : plan.name,
          textAlign: TextAlign.center,
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),

        if (plan.days.length > 1) ...[
          PillTabs(
            labels: [for (final d in plan.days) d.name],
            selectedIndex: _activeDay,
            onSelected: (i) => setState(() {
              _activeDay = i;
              _openVideoId = null;
            }),
          ),
          const SizedBox(height: 16),
        ],

        // Training Mode actions (session/history/progress land in Phase 4)
        if (hasExercises) ...[
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => context.push(
                    '${AppRoutes.trainingSession}?day=$_activeDay',
                  ),
                  icon: const Icon(Icons.play_arrow, size: 18),
                  label: Text(l10n.trainingStart),
                ),
              ),
              const SizedBox(width: 8),
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
            _ExerciseCard(
              exercise: day.exercises[i],
              index: i,
              locale: locale,
              baseUrl: baseUrl,
              videoOpen: _openVideoId == day.exercises[i].id,
              onToggleVideo: () => setState(() {
                _openVideoId = _openVideoId == day.exercises[i].id
                    ? null
                    : day.exercises[i].id;
              }),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ],
    );
  }
}

class _ExerciseCard extends StatelessWidget {
  const _ExerciseCard({
    required this.exercise,
    required this.index,
    required this.locale,
    required this.baseUrl,
    required this.videoOpen,
    required this.onToggleVideo,
  });

  final TrainingExercise exercise;
  final int index;
  final String locale;
  final String baseUrl;
  final bool videoOpen;
  final VoidCallback onToggleVideo;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;
    final primary = Theme.of(context).colorScheme.primary;
    final hasVideo = (exercise.youtubeUrl ?? '').isNotEmpty ||
        (exercise.videoPath ?? '').isNotEmpty;
    final instructions = localizedField(
      base: exercise.instructionsEn ?? '',
      arabic: exercise.instructionsAr,
      localeCode: locale,
    );
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Thumbnail(
                    url: resolveMediaUrl(exercise.thumbnailPath, baseUrl)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text('#${index + 1}',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: primary)),
                          Text(exerciseName,
                              style: const TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w600)),
                          if (hasVideo)
                            _VideoToggle(
                              open: videoOpen,
                              onTap: onToggleVideo,
                              openLabel: l10n.trainingHideVideo,
                              closedLabel: l10n.trainingWatchVideo,
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          if (muscleGroup.isNotEmpty) _Chip(label: muscleGroup),
                          if (equipment.isNotEmpty)
                            _Chip(
                              label: equipment,
                              color: const Color(0xFF8B5CF6),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (videoOpen && hasVideo) ...[
              const SizedBox(height: 12),
              ExerciseVideo(
                youtubeUrl: exercise.youtubeUrl,
                videoUrl: resolveMediaUrl(exercise.videoPath, baseUrl),
              ),
            ],
            if ((exercise.notes ?? '').isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(exercise.notes!,
                  style: TextStyle(
                      fontSize: 12, fontStyle: FontStyle.italic, color: muted)),
            ],
            if (instructions.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(instructions, style: TextStyle(fontSize: 12, color: muted)),
            ],
            if (exercise.sets.isNotEmpty) ...[
              const SizedBox(height: 12),
              _SetsTable(sets: exercise.sets),
            ],
            if (exercise.alternatives.isNotEmpty) ...[
              const SizedBox(height: 12),
              _Alternatives(
                alternatives: exercise.alternatives,
                locale: locale,
                baseUrl: baseUrl,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({this.url});
  final String? url;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: context.appColors.secondary,
        borderRadius: BorderRadius.circular(12),
      ),
      child: url == null
          ? Icon(Icons.fitness_center,
              color: context.appColors.mutedForeground.withValues(alpha: 0.4))
          : Image.network(
              url!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Icon(
                Icons.fitness_center,
                color: context.appColors.mutedForeground.withValues(alpha: 0.4),
              ),
            ),
    );
  }
}

class _VideoToggle extends StatelessWidget {
  const _VideoToggle({
    required this.open,
    required this.onTap,
    required this.openLabel,
    required this.closedLabel,
  });

  final bool open;
  final VoidCallback onTap;
  final String openLabel;
  final String closedLabel;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: open ? primary : Colors.transparent,
          border: Border.all(color: open ? primary : context.appColors.border),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.play_arrow,
                size: 12,
                color: open
                    ? Theme.of(context).colorScheme.onPrimary
                    : context.appColors.mutedForeground),
            const SizedBox(width: 2),
            Text(
              open ? openLabel : closedLabel,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: open
                    ? Theme.of(context).colorScheme.onPrimary
                    : context.appColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
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

class _SetsTable extends StatelessWidget {
  const _SetsTable({required this.sets});
  final List<TrainingSet> sets;

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

    Widget cell(String text, TextStyle? style) =>
        Expanded(child: Text(text, style: style));

    return Column(
      children: [
        Row(
          children: [
            cell(l10n.trainingSet.toUpperCase(), header),
            cell(l10n.trainingReps.toUpperCase(), header),
            cell(l10n.trainingRest.toUpperCase(), header),
            cell(l10n.trainingTempo.toUpperCase(), header),
            cell(l10n.trainingRir.toUpperCase(), header),
          ],
        ),
        const SizedBox(height: 4),
        for (var i = 0; i < sets.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                cell('${i + 1}', TextStyle(fontSize: 12, color: muted)),
                cell(sets[i].reps ?? '—', const TextStyle(fontSize: 13)),
                cell(
                    sets[i].restSeconds != null
                        ? '${sets[i].restSeconds}s'
                        : '—',
                    const TextStyle(fontSize: 13)),
                cell(sets[i].tempo ?? '—', const TextStyle(fontSize: 13)),
                cell(sets[i].rir?.toString() ?? '—',
                    const TextStyle(fontSize: 13)),
              ],
            ),
          ),
      ],
    );
  }
}

class _Alternatives extends StatelessWidget {
  const _Alternatives({
    required this.alternatives,
    required this.locale,
    required this.baseUrl,
  });

  final List<TrainingAlternative> alternatives;
  final String locale;
  final String baseUrl;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final muted = context.appColors.mutedForeground;

    return Container(
      padding: const EdgeInsetsDirectional.only(start: 12),
      decoration: BoxDecoration(
        border: BorderDirectional(
          start: BorderSide(color: context.appColors.border, width: 2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.trainingAlternatives,
              style: TextStyle(fontSize: 10, color: muted)),
          const SizedBox(height: 6),
          for (final alt in alternatives)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Row(
                children: [
                  if (resolveMediaUrl(alt.thumbnailPath, baseUrl) != null) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        resolveMediaUrl(alt.thumbnailPath, baseUrl)!,
                        width: 32,
                        height: 32,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            const SizedBox(width: 32, height: 32),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      localizedField(
                        base: alt.nameEn ?? '',
                        arabic: alt.nameAr,
                        localeCode: locale,
                      ),
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                  if (localizedField(
                    base: alt.muscleGroup ?? '',
                    arabic: alt.muscleGroupAr,
                    localeCode: locale,
                  ).isNotEmpty)
                    Text(
                      localizedField(
                        base: alt.muscleGroup ?? '',
                        arabic: alt.muscleGroupAr,
                        localeCode: locale,
                      ),
                      style: TextStyle(fontSize: 11, color: muted),
                    ),
                ],
              ),
            ),
        ],
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
