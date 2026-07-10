import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/forms/forms_repository.dart';
import '../../features/notifications/notifications_repository.dart';
import '../../features/nutrition/nutrition_repository.dart';
import '../../features/training/training_repository.dart';
import '../../shared/models/form.dart';
import 'last_seen_store.dart';

const _nutritionModule = 'nutrition';
const _trainingModule = 'training';
const _formsModule = 'forms';

/// A plan's identity for "have I seen this?" purposes: its id plus
/// `activated_at`. Changes on activation/restart (a coach "publishing a new
/// plan"), not on ordinary content edits to the same active plan.
String _planKey(String id, String? activatedAt) => '$id|${activatedAt ?? ''}';

/// Base for the two plan-seen controllers (Nutrition/Training): identical
/// load/save logic, only the storage module name differs.
abstract class _PlanSeenController extends Notifier<String?> {
  String get module;
  bool _disposed = false;
  // Guards against the async storage read resolving *after* markSeen() has
  // already set a fresher value — without this, a slow-to-load persisted
  // value could briefly clobber a value the user just set (e.g. by opening
  // the tab right as the app starts).
  bool _loaded = false;

  @override
  String? build() {
    ref.onDispose(() => _disposed = true);
    // Loads asynchronously; state starts null (briefly reads as "unseen"
    // until the persisted value arrives, same pattern as LocaleController).
    // `ref.read` happens synchronously, inside build() — only the
    // SharedPreferences round-trip after it is actually async — so a
    // container disposed before this resolves never touches a dead ref.
    unawaited(_load());
    return null;
  }

  Future<void> _load() async {
    final key = await ref.read(lastSeenStoreProvider).getPlanKey(module);
    if (!_disposed && !_loaded) {
      _loaded = true;
      state = key;
    }
  }

  Future<void> markSeen(String key) async {
    _loaded = true;
    if (state == key) return;
    state = key;
    await ref.read(lastSeenStoreProvider).setPlanKey(module, key);
  }
}

class NutritionPlanSeenController extends _PlanSeenController {
  @override
  String get module => _nutritionModule;
}

class TrainingPlanSeenController extends _PlanSeenController {
  @override
  String get module => _trainingModule;
}

final nutritionPlanSeenProvider =
    NotifierProvider<NutritionPlanSeenController, String?>(
        NutritionPlanSeenController.new);
final trainingPlanSeenProvider =
    NotifierProvider<TrainingPlanSeenController, String?>(
        TrainingPlanSeenController.new);

/// True when the active nutrition plan was activated/restarted since the
/// client last opened the Nutrition tab.
final nutritionUnreadProvider = Provider.autoDispose<bool>((ref) {
  final plan = ref.watch(activeNutritionPlanProvider).asData?.value;
  if (plan == null) return false;
  final seen = ref.watch(nutritionPlanSeenProvider);
  return _planKey(plan.id, plan.activatedAt) != seen;
});

/// True when the active training plan was activated/restarted since the
/// client last opened the Training tab.
final trainingUnreadProvider = Provider.autoDispose<bool>((ref) {
  final plan = ref.watch(activeTrainingPlanProvider).asData?.value;
  if (plan == null) return false;
  final seen = ref.watch(trainingPlanSeenProvider);
  return _planKey(plan.id, plan.activatedAt) != seen;
});

/// Holds the set of pending/scheduled form-request ids the client has
/// already been shown (i.e. opened the Forms tab since). New request ids
/// outside this set mean "a new request appeared since I last looked."
class FormsSeenController extends Notifier<Set<String>> {
  bool _disposed = false;
  bool _loaded = false;

  @override
  Set<String> build() {
    ref.onDispose(() => _disposed = true);
    unawaited(_load());
    return const {};
  }

  Future<void> _load() async {
    final ids = await ref.read(lastSeenStoreProvider).getSeenIds(_formsModule);
    if (!_disposed && !_loaded) {
      _loaded = true;
      state = ids;
    }
  }

  Future<void> markSeen(Set<String> ids) async {
    _loaded = true;
    state = ids;
    await ref.read(lastSeenStoreProvider).setSeenIds(_formsModule, ids);
  }
}

final formsSeenProvider =
    NotifierProvider<FormsSeenController, Set<String>>(FormsSeenController.new);

/// True when there's at least one pending/scheduled form request the client
/// hasn't been shown yet (opening Forms clears this even if the request is
/// still unfilled — the dot means "new," not "incomplete").
final formsUnreadProvider = Provider.autoDispose<bool>((ref) {
  final requests = ref.watch(formRequestsProvider).asData?.value ?? const [];
  final seen = ref.watch(formsSeenProvider);
  return requests.any((r) => formRequestNeedsAction(r) && !seen.contains(r.id));
});

/// True when there's an unread `message.received` notification — see
/// [hasUnreadMessageProvider] in notifications_repository.dart for why this
/// reuses the notifications substrate instead of its own tracking.
final messagesUnreadProvider = Provider.autoDispose<bool>((ref) {
  return ref.watch(hasUnreadMessageProvider);
});
